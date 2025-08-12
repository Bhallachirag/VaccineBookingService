const express = require('express');

const v1ApiRoutes = require('./v1/index');
const paymentRouter = require("./v1/payment_routes");

const router = express.Router();

router.use('/v1', v1ApiRoutes);
router.use('/payments', paymentRouter);

module.exports = router;