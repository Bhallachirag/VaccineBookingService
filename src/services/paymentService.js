const razorpay = require("../config/razorpayInstance");
const { REMINDER_SERVICE_PATH } = require("../config/serverConfig");
const axios = require("axios"); 

const createPaymentLink = async (orderId, user) => {
  const order = await bookingService.findOrderById(orderId);

  const paymentLinkRequest = {
    amount: order.totalCost * 100,
    currency: "INR",
    // customer: {
    //   email: user.email,
    //   contact: user.mobileNumber
    // },
    notify: {
      sms: true,
      email: true
    },
    reference_id: `ORDER_${orderId}`,
    callback_url: 'http://your-callback-url',
    callback_method: 'get',
    notes: { 
      order_id: orderId
    }
  };

  const response = await razorpay.paymentLink.create(paymentLinkRequest);
  return response;
};


const updatePaymentInformation = async(reqData) =>{
    const paymentId = reqData.payment_id;
    const orderId = reqData.order_id;

    try {
        const order = await bookingService.findOrderById(orderId);
        console.log("Fetched Order:",order);
        const payment = await razorpay.payments.fetch(paymentId);
        console.log("Payment info:", payment);

        if(payment.status == "captured" || payment.status === "authorized"){
            order.paymentDetails.paymentId = paymentId;
            order.paymentDetails.status="COMPLETED";
            order.orderStatus="PLACED";

            await order.save(); 

            await axios.post(`${REMINDER_SERVICE_PATH}/api/v1/send-confirmation-from-order`, {
                orderId: order.id
            });
            console.log("Calling reminder service with order ID:", order.id);
        }

        const resData = {
            message: "Your order is placed", 
            success:true
        }
        return resData;
    } catch (error) {
        console.error("Error in updatePaymentInformation:", error.message);
        throw new Error(error.message);
    }
}


module.exports={
    createPaymentLink,
    updatePaymentInformation,
}