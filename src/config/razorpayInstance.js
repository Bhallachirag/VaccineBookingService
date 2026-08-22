const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_kTVzbBdLTSinii',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'DO6aXiVrJce3jKx7jJJD2O44',
});

module.exports = razorpay;