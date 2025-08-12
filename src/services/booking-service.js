const axios = require('axios');

const { BookingRepository } = require('../repository/index');
const { VACCINE_SERVICE_PATH } = require('../config/serverConfig');
const { AUTH_SERVICE_PATH } = require('../config/serverConfig');
const { ServiceError } = require('../utils/errors');

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
            'Booking Failed',
            'Not enough total stock in all inventories'
        );
    }

    return totalCost;
}

    async validateUserExists(userId) {
        try {
            const userResponse = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/users/${userId}`);
            return userResponse.data.success && userResponse.data.data;
        } catch (error) {
            return false;
        }
    } 
 
    async createBooking(data) {
        try {
          const userExists = await this.validateUserExists(data.userId);
            if (!userExists) {
                throw new ServiceError(
                    'Booking Failed,You are not registered',
                    `User with ID ${data.userId} does not exist`,
                    404
                );
            }
            const vaccineId = data.vaccineId;
            const getVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}`;
            const response = await axios.get(getVaccineRequestURL);
            const vaccineData = response.data.data;
            const priceOfTheVaccine = vaccineData.price;
            if (data.noOfDoses > vaccineData.quantity) {
                throw new ServiceError(
                    'Something went wrong in booking process',
                    'Insufficient quantity in the inventory'
                );
            }

            const totalCost = await this.calculateTotalCost(data.vaccineId, data.noOfDoses);
            const bookingPayload = { ...data, totalCost };

            const booking = await this.bookingRepository.create(bookingPayload);
            const updateVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}/inventories`;
            await axios.patch(updateVaccineRequestURL, {
                quantity: data.noOfDoses
            });

            booking.status = 'Booked';
            await booking.save();

            return { ...booking.dataValues, totalCost };    

        } catch (error) {
            console.log(error);
            if (error.name === 'RepositoryError' || error.name === 'ValidationError') {
                throw error;
            }
            throw new ServiceError('Failed to process booking', error.message);
        }
    }

    async getAllBookingsWithVaccineDetails() {
    const bookings = await this.bookingRepository.findAllBookings();

    const detailedBookings = await Promise.all(
      bookings.map(async (booking) => {
        let vaccineData = {};
        try {
          const response = await axios.get(
            `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${booking.vaccineId}`
          );
          vaccineData = response.data.data;
        } catch (error) {
          console.log(`Vaccine fetch failed for ID ${booking.vaccineId}:`, error.message);
        }
        return {
          id: booking.id,
          userId: booking.userId,
          vaccineId: booking.vaccineId,
          vaccineName: vaccineData?.name || 'N/A',
          noOfDoses: booking.noOfDoses,
          totalCost: booking.totalCost,
          status: booking.status,
          createdAt: booking.createdAt,
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
  try {
    const userRes = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/users/${booking.userId}`);
    console.log("User API response:", userRes.data);
    const user = userRes.data.data;
    booking.dataValues.user = {
      email: user.email,
      phoneNo: user.mobileNumber
    };  
    console.log("Fetched user details in booking:", booking.dataValues.user);
  } catch (err) {
    console.error("Failed to fetch user data:", err.message);
    booking.dataValues.user = null;
  }
    return booking;
  }
}

module.exports = BookingService;