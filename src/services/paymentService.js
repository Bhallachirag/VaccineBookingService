const razorpay = require("../config/razorpayInstance");
const { REMINDER_SERVICE_PATH, VACCINE_FRONTEND_PATH, AUTH_SERVICE_PATH } = require("../config/serverConfig");
const axios = require("axios");
const BookingService = require("./booking-service");

const bookingService = new BookingService();

const createCartPaymentLink = async (cartData, user) => {
    const cartBooking = await bookingService.createCartBooking(cartData);
    
    const paymentLinkRequest = {
        amount: cartBooking.totalCost * 100,
        currency: "INR",
        customer: {
            email: user.email,
            contact: user.mobileNumber
        },
        notify: {
            sms: true,
            email: true
        },
        reference_id: `CART_${cartBooking.bookingId}`,
        callback_url: `${VACCINE_FRONTEND_PATH}/`,
        callback_method: 'get',
        notes: {
            booking_id: cartBooking.bookingId,
            cart_id: cartBooking.cartId,
            total_items: cartBooking.itemDetails.length,
            is_cart_order: true
        },
        description: `Cart Payment - ${cartBooking.itemDetails.length} vaccines for ₹${cartBooking.totalCost}`
    };

    const response = await razorpay.paymentLink.create(paymentLinkRequest);
    
    return {
        paymentLink: response,
        bookingId: cartBooking.bookingId,
        totalAmount: cartBooking.totalCost,
        itemDetails: cartBooking.itemDetails
    };
};

// Original single item payment (keep for backward compatibility)
const createPaymentLink = async (orderId, user) => {
    const order = await bookingService.findOrderById(orderId);

    const paymentLinkRequest = {
        amount: order.totalCost * 100,
        currency: "INR",
        notify: {
            sms: true,
            email: true
        },
        reference_id: `ORDER_${orderId}`,
        callback_url: VACCINE_FRONTEND_PATH,
        callback_method: 'get',
        notes: {
            order_id: orderId
        }
    };

    const response = await razorpay.paymentLink.create(paymentLinkRequest);
    return response;
};

// Updated payment verification - handles both cart and single payments
const updatePaymentInformation = async (reqData) => {
    const paymentId = reqData.payment_id;
    const referenceId = reqData.reference_id || `ORDER_${reqData.order_id}`;

    try {
        const payment = await razorpay.payments.fetch(paymentId);
        if (payment.status === "captured" || payment.status === "authorized") {
            
            if (referenceId.startsWith('CART_')) {
                const bookingId = referenceId.replace('CART_', '');
                
                // Process cart payment and update inventory for all items
                const result = await bookingService.processCartPayment(bookingId, paymentId);
                await axios.post(`${REMINDER_SERVICE_PATH}/api/v1/send-confirmation-from-order`, {
                    orderId: bookingId,
                    isCartOrder: true
                });
                
                console.log(`Cart payment confirmed. Inventory updated for ${result.itemsProcessed} items.`);
                
                return {
                    message: `Your cart order with ${result.itemsProcessed} vaccines is confirmed!`,
                    success: true,
                    bookingId: bookingId,
                    totalAmount: result.totalCost,
                    type: 'cart_order',
                    itemsProcessed: result.itemsProcessed
                };
            } else {
                const orderId = referenceId.replace('ORDER_', '');
                const order = await bookingService.findOrderById(orderId);
                
                order.paymentDetails = order.paymentDetails || {};
                order.paymentDetails.paymentId = paymentId;
                order.paymentDetails.status = "COMPLETED";
                order.status = "PLACED";

                await axios.post(`${REMINDER_SERVICE_PATH}/api/v1/send-confirmation-from-order`, {
                    orderId: order.id
                });
                
                return {
                    message: "Your order is placed successfully",
                    success: true,
                    orderId: order.id,
                    totalAmount: order.totalCost,
                    type: 'single_order'
                };
            }
        }

        throw new Error("Payment not captured");

    } catch (error) {
        console.error("Error in updatePaymentInformation:", error.message);
        throw new Error(error.message);
    }
};

const processCartCheckout = async (cartData) => {
    try {
        const userResponse = await axios.get(`${AUTH_SERVICE_PATH}/api/v1/users/${cartData.userId}`);
        const user = userResponse.data.data;
        const paymentResult = await createCartPaymentLink(cartData, user);

        return {
            success: true,
            paymentLink: paymentResult.paymentLink.short_url,
            paymentLinkId: paymentResult.paymentLink.id,
            bookingId: paymentResult.bookingId,
            totalAmount: paymentResult.totalAmount,
            items: paymentResult.itemDetails,
            message: `Payment link created for cart with ${paymentResult.itemDetails.length} vaccines`
        };

    } catch (error) {
        console.error("Error in processCartCheckout:", error);
        throw new Error(error.message);
    }
};

module.exports = {
    createPaymentLink,         
    updatePaymentInformation,   
    createCartPaymentLink,      
    processCartCheckout        
};