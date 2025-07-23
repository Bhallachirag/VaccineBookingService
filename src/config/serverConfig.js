const dotenv = require('dotenv');

dotenv.config();

module.exports = {
    PORT: process.env.PORT,
    VACCINE_SERVICE_PATH: process.env.VACCINE_SERVICE_PATH
}