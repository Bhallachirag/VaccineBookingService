const { BookingService }  = require('../services/index');
const { StatusCodes } = require('http-status-codes');

const { VACCINE_SERVICE_PATH, REMINDER_SERVICE_PATH, AUTH_SERVICE_PATH } = require('../config/serverConfig');

const bookingService = new BookingService();

const create = async (req,res) => {
    try {
        const response = await bookingService.createBooking(req.body);
        return res.status(StatusCodes.OK).json({
            message: 'Successfully completed booking',
            success: true,
            err: {},
            data: response
        });
    } catch (error) {
            return res.status(error.statusCodes).json({
            message: error.message,
            success: false,
            err: error.explanation, 
            data: {}
        });
    }
}

const getAllBookingsWithVaccineDetails = async (req, res) => {
  try {
    const result = await bookingService.getAllBookingsWithVaccineDetails();
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Successfully fetched all bookings',
      data: result,
      err: {}
    });
  } catch (err) {
    console.error(err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch bookings with vaccine details',
      data: {},
      err: err.message
    });
  }
};

const getBookingById = async (req, res) => {
  try {
    const booking = await bookingService.findOrderById(req.params.id);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Successfully fetched booking with user details',
      data: booking,
      err: {}
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch booking',
      data: {},
      err: error.message
    });
  }
};


module.exports = {
    create,
    getAllBookingsWithVaccineDetails,
    getBookingById
}