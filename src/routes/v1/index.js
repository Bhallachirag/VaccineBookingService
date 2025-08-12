const express = require('express');
const axios = require('axios');

const { BookingController } = require('../../controllers/index');
const BookingService = require('../../services/booking-service');
const bookingService = new BookingService();
const { REMINDER_SERVICE_PATH } = require('../../config/serverConfig');

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
      email: 'chiragbhalla73@gmail.com',
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

module.exports = router;