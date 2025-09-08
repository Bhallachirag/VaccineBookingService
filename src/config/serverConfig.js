const dotenv = require('dotenv');

dotenv.config();

module.exports = {
    PORT: process.env.PORT,
    VACCINE_SERVICE_PATH: process.env.VACCINE_SERVICE_PATH,
    AUTH_SERVICE_PATH: process.env.AUTH_SERVICE_PATH,
    REMINDER_SERVICE_PATH: process.env.REMINDER_SERVICE_PATH,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    VACCINE_FRONTEND_PATH: process.env.VACCINE_FRONTEND_PATH,
}