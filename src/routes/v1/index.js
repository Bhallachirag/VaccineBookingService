const express = require('express');
const axios = require('axios');

const { BookingController } = require('../../controllers/index');
const BookingService = require('../../services/booking-service');
const bookingService = new BookingService();
const { REMINDER_SERVICE_PATH, AUTH_SERVICE_PATH } = require('../../config/serverConfig');
const { createCartPaymentLink, updatePaymentInformation } = require('../../services/paymentService');

const router = express.Router();

router.get('/info', (req,res) => {
    return res.json({message: 'Response from routes'})
})
router.post('/bookings', BookingController.create);
router.get('/bookings/all', BookingController.getAllBookingsWithVaccineDetails);
router.get('/bookings/:id', BookingController.getBookingById);
router.get('/test-reminder/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  try {
    const order = await bookingService.findOrderById(orderId);

    const result = await axios.post(`${REMINDER_SERVICE_PATH}/api/v1/send-confirmation-email`, {
      email: order.dataValues.user.email,
      phoneNo: order.dataValues.user.mobileNumber,
      bookingId: order.id,
      date: order.date,
      time: order.time
    });

    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cart/checkout', async (req, res) => {
  try {
    let { userId, cartItems } = req.body;

    if (!userId || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request: userId and cartItems are required."
      });
    }

    if (isNaN(userId)) {
      try {
        const userRes = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/users/email/${userId}`);
        if (!userRes.data || !userRes.data.data) {
          return res.status(404).json({ success: false, message: "User not found" });
        }
        userId = userRes.data.data.id;
      } catch (err) {
        console.error("Failed to resolve email:", err.message);
        return res.status(500).json({ success: false, message: "User resolution failed" });
      }
    }

    const cartData = {
      userId,
      items: cartItems.map(item => ({
        vaccineId: item.id || item.vaccineId,
        noOfDoses: item.quantity || item.noOfDoses
      }))
    };

    let userDetails;
    try {
      const userRes = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/users/${userId}`);
      userDetails = userRes.data.data;
    } catch (err) {
      console.error("Failed to fetch user:", err.message);
      return res.status(500).json({ success: false, message: "User fetch failed" });
    }

    const paymentResult = await createCartPaymentLink(cartData, {
      email: userDetails.email,
      mobileNumber: userDetails.mobileNumber
    });

    res.json({
      success: true,
      paymentUrl: paymentResult.paymentLink.short_url,
      bookingId: paymentResult.bookingId,
      totalAmount: paymentResult.totalAmount,
      message: `Payment link created for ${cartItems.length} vaccines`,
    });

  } catch (error) {
    console.error("Cart checkout error details:", error);
    res.status(500).json({
      success: false,
      message: error.message || error.explanation || "Internal server error during checkout",
      errorDetails: error
    });
  }
});

router.get('/bookings/user/:userId', async (req, res) => {
  try {
    let userId = req.params.userId;

    if (isNaN(userId)) {
      try {
        const userRes = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/users/email/${userId}`);
        if (userRes.data && userRes.data.data) {
          userId = userRes.data.data.id;
        }
      } catch (err) {
        console.warn("Could not resolve email to userId:", err.message);
      }
    }

    const bookings = await bookingService.getBookingsByUser(userId);

    res.json({
      success: true,
      message: `Fetched ${bookings.length} bookings for user ${userId}`,
      data: bookings
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/verify-payment', async (req, res) => {
  try {
    const result = await updatePaymentInformation(req.body);
    res.json({ success: true, message: result.message, data: result });
  } catch (error) {
    console.error("Verify payment error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/razorpay-webhook', async (req, res) => {
  try {
    const event = req.body;
    if (event.event === 'payment_link.paid' || event.event === 'payment.captured') {
      const entity = event.payload?.payment_link?.entity || event.payload?.payment?.entity;
      if (entity) {
        const paymentId = entity.payment_id || entity.id;
        const referenceId = entity.reference_id;
        await updatePaymentInformation({ payment_id: paymentId, reference_id: referenceId });
        return res.json({ status: 'ok', message: 'Payment confirmed & booking status updated to Booked' });
      }
    }
    res.json({ status: 'ok', message: 'Event logged' });
  } catch (error) {
    console.error("Razorpay webhook error:", error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;