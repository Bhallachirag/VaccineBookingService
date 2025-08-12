const paymentService = require("../services/paymentService");
const BookingService = require("../services/booking-service");
const bookingService = new BookingService();
const axios = require('axios');
const { REMINDER_SERVICE_PATH } = require('../config/serverConfig');

const  createPaymentLink = async(req,res) => {
    try {
        const paymentLink = await paymentService.createPaymentLink(req.params.id);

        return res.status(200).send(paymentLink);   
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const  updatePaymentInformation = async(req,res) => {
    try {
        await paymentService.updatePaymentInformation(req.query);

        return res.status(200).send({
            message: "payment information updated",
            status : true  
        }); 
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {
    createPaymentLink,
    updatePaymentInformation,
}