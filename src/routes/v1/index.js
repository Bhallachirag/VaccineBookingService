const express = require('express');

const { BookingController } = require('../../controllers/index');

const router = express.Router();

router.post('/bookings', BookingController.create);
router.get('/bookings/all', BookingController.getAllBookingsWithVaccineDetails);


module.exports = router;