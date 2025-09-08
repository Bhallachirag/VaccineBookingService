const axios = require("axios");

const { BookingRepository } = require("../repository/index");
const { VACCINE_SERVICE_PATH } = require("../config/serverConfig");
const { AUTH_SERVICE_PATH } = require("../config/serverConfig");
const { ServiceError } = require("../utils/errors");

class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
  }

  async calculateTotalCost(vaccineId, noOfDoses) {
    const url = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}/inventories`;
    const response = await axios.get(url);
    const inventories = response.data.data;

    inventories.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    let remainingDoses = noOfDoses;
    let totalCost = 0;

    for (const inv of inventories) {
      if (remainingDoses <= 0) break;

      const available = inv.quantity;
      const usedFromThisBatch = Math.min(remainingDoses, available);

      totalCost += usedFromThisBatch * inv.price;
      remainingDoses -= usedFromThisBatch;
    }

    if (remainingDoses > 0) {
      throw new ServiceError(
        "Booking Failed",
        "Not enough total stock in all inventories"
      );
    }

    return totalCost;
  }

  async createCartBooking(cartData) {
    try {
      let grandTotal = 0;
      const itemDetails = [];

      for (const item of cartData.items) {
        const getVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${item.vaccineId}`;
        const response = await axios.get(getVaccineRequestURL);
        const vaccineData = response.data.data;

        if (item.noOfDoses > vaccineData.quantity) {
          throw new ServiceError(
            "Insufficient Stock",
            `Not enough quantity for ${vaccineData.name}. Available: ${vaccineData.quantity}, Requested: ${item.noOfDoses}`
          );
        }

        const itemCost = await this.calculateTotalCost(
          item.vaccineId,
          item.noOfDoses
        );
        grandTotal += itemCost;

        itemDetails.push({
          vaccineId: item.vaccineId,
          vaccineName: vaccineData.name,
          noOfDoses: item.noOfDoses,
          itemCost: itemCost,
        });
      }

      const cartBookingPayload = {
        userId: cartData.userId,
        vaccineId: cartData.items[0].vaccineId,
        noOfDoses: cartData.items.reduce(
          (total, item) => total + item.noOfDoses,
          0
        ),
        totalCost: grandTotal,
        status: "Booked",
        notes: JSON.stringify({
          isCartOrder: true,
          cartItems: itemDetails,
          cartId: `CART_${Date.now()}_${cartData.userId}`,
        }),
      };

      const booking = await this.bookingRepository.create(cartBookingPayload);

      return {
        bookingId: booking.id,
        totalCost: grandTotal,
        itemDetails: itemDetails,
      };
    } catch (error) {
      console.log(error);
      if (
        error.name === "RepositoryError" ||
        error.name === "ValidationError"
      ) {
        throw error;
      }
      throw new ServiceError("Failed to create cart booking", error.message);
    }
  }

  async processCartPayment(bookingId, paymentId) {
    try {
      const booking = await this.bookingRepository.get(bookingId);
      if (!booking) {
        throw new Error("Booking not found");
      }

      const cartData = JSON.parse(booking.notes);

      if (!cartData.isCartOrder) {
        throw new Error("This is not a cart order");
      }

      for (const item of cartData.cartItems) {
        const updateVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${item.vaccineId}/inventories`;
        await axios.patch(updateVaccineRequestURL, {
          quantity: item.noOfDoses,
        });
        console.log(
          `Updated inventory for ${item.vaccineName}: -${item.noOfDoses} doses`
        );
      }
      booking.status = "Booked";

      const updatedNotes = {
        ...cartData,
        paymentId: paymentId,
        paidAt: new Date().toISOString(),
        paymentStatus: "COMPLETED",
      };
      booking.notes = JSON.stringify(updatedNotes);
      console.log(
        `Cart payment processed successfully. Updated inventory for ${cartData.cartItems.length} items.`
      );

      return {
        success: true,
        booking: booking,
        itemsProcessed: cartData.cartItems.length,
        totalCost: booking.totalCost,
      };
    } catch (error) {
      console.error("Failed to process cart payment:", error);
      throw new ServiceError("Failed to process cart payment", error.message);
    }
  }

  async createBooking(data) {
    try {
      const vaccineId = data.vaccineId;
      const getVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}`;
      const response = await axios.get(getVaccineRequestURL);
      const vaccineData = response.data.data;
      const priceOfTheVaccine = vaccineData.price;
      if (data.noOfDoses > vaccineData.quantity) {
        throw new ServiceError(
          "Something went wrong in booking process",
          "Insufficient quantity in the inventory"
        );
      }

      const totalCost = await this.calculateTotalCost(
        data.vaccineId,
        data.noOfDoses
      );
      const bookingPayload = { ...data, totalCost };

      const booking = await this.bookingRepository.create(bookingPayload);
      const updateVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}/inventories`;
      await axios.patch(updateVaccineRequestURL, {
        quantity: data.noOfDoses,
      });

      booking.status = "Booked";
      return { ...booking.dataValues, totalCost };
    } catch (error) {
      console.log(error);
      if (
        error.name === "RepositoryError" ||
        error.name === "ValidationError"
      ) {
        throw error;
      }
      throw new ServiceError("Failed to process booking", error.message);
    }
  }

  async getAllBookingsWithVaccineDetails() {
    const bookings = await this.bookingRepository.findAllBookings();

    const detailedBookings = await Promise.all(
      bookings.map(async (booking) => {
        let cartItems = [];
        let vaccineName = "N/A";

        // 🔹 Parse cart data from notes
        try {
          const parsedNotes = JSON.parse(booking.notes || "{}");
          if (parsedNotes.isCartOrder) {
            cartItems = parsedNotes.cartItems || [];
            vaccineName = cartItems.map((i) => i.vaccineName).join(", ");
          }
        } catch (err) {
          console.error("Failed to parse notes:", err.message);
        }

        // 🔹 For single-vaccine bookings, fetch vaccine details
        if (!cartItems.length && booking.vaccineId) {
          try {
            const response = await axios.get(
              `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${booking.vaccineId}`
            );
            vaccineName = response.data.data?.name || "N/A";
          } catch (error) {
            console.log(
              `Vaccine fetch failed for ID ${booking.vaccineId}:`,
              error.message
            );
          }
        }

        return {
          id: booking.id,
          userId: booking.userId,
          vaccineId: booking.vaccineId,
          vaccineName,
          noOfDoses: booking.noOfDoses,
          totalCost: booking.totalCost,
          status: booking.status,
          createdAt: booking.createdAt,
          cartItems, // 🔹 include cartItems for frontend
        };
      })
    );

    return detailedBookings;
  }

  async findOrderById(id) {
    const booking = await this.bookingRepository.get(id);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // 🔹 Parse notes for cart orders
    let cartItems = [];
    try {
      const parsedNotes = JSON.parse(booking.notes || "{}");
      if (parsedNotes.isCartOrder) {
        cartItems = parsedNotes.cartItems || [];
      }
    } catch (err) {
      console.error("Failed to parse notes:", err.message);
    }

    // 🔹 Fetch user data
    try {
      const userRes = await axios.get(
        `${AUTH_SERVICE_PATH}/api/v1/users/${booking.userId}`
      );
      const user = userRes.data.data;
      booking.dataValues.user = {
        email: user.email,
        phoneNo: user.mobileNumber,
      };
    } catch (err) {
      console.error("Failed to fetch user data:", err.message);
      booking.dataValues.user = null;
    }

    return {
      ...booking.dataValues,
      cartItems,
    };
  }

  async getBookingsByUser(userId) {
    try {
      const bookings = await this.bookingRepository.findByUser(userId);
      return bookings;
    } catch (error) {
      console.error("Error in getBookingsByUser:", error.message);
      throw error;
    }
  }
}

module.exports = BookingService;
