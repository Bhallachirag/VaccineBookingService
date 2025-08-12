const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const paymentController = require('../../controllers/payment_controller');
const { RAZORPAY_WEBHOOK_SECRET } = require('../../config/serverConfig');

router.post('/:id', paymentController.createPaymentLink);
router.get('/', paymentController.updatePaymentInformation);

module.exports = router;