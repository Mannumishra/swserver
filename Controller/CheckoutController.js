const Checkout = require("../Models/CheckoutModel");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const axios = require("axios")

const razorpayInstance = new Razorpay({
    key_id: 'rzp_live_FjN3xa6p5RsEl6',
    key_secret: 'CrSeAmgW4PgPIKzsNOaqL7QB',
});

exports.checkout = async (req, res) => {
    console.log(req.body)
    const { userId, products, shippingAddress, paymentMethod } = req.body;

    const pincode = shippingAddress.postalCode;
    const subtotal = products.reduce((total, item) => total + (item.price * item.quantity), 0);
    let shippingCost = 500;
    if (pincode) {
        try {
            const response = await axios.get("http://localhost:8000/api/all-pincode");
            const pinCodeData = response.data.find(item => item.pincode === parseInt(pincode));
            if (pinCodeData) {
                shippingCost = pinCodeData.shippingCharge;
            }
        } catch (error) {
            console.error("Error fetching shipping charge:", error);
        }
    }

    const totalAmount = subtotal + shippingCost;
    try {
        const checkout = new Checkout({
            userId,
            products: products.map(item => ({
                productName: item.productName,
                productImage: item.productImage,
                price: item.price,
                quantity: item.quantity,
                productId: item.productId
            })),
            shippingAddress,
            paymentMethod,
            totalAmount,
            shippingCost,
        });
        if (paymentMethod === 'Online') {
            const razorpayOrder = await razorpayInstance.orders.create({
                amount: totalAmount * 100,
                currency: 'INR',
                receipt: checkout._id.toString(),
                payment_capture: 1,
            });
            console.log("", razorpayOrder)
            checkout.paymentInfo = {
                transactionId: razorpayOrder.id,
                orderId: razorpayOrder.receipt,
            };
            await checkout.save();
            return res.status(201).json({
                message: 'Checkout successful. Payment initiated via Razorpay.',
                checkout,
                razorpayOrder,
            });
        }

        await checkout.save();
        res.status(201).json({ message: 'Checkout successful', checkout });

    } catch (error) {
        console.error('Error processing checkout:', error);
        res.status(500).json({ error: 'Server error during checkout process' });
    }
};


exports.verifyPayment = async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id } = req.body;
    console.log(req.body)
    const checkout = await Checkout.findById(order_id);
    console.log(checkout)
    if (!checkout) {
        return res.status(400).json({ error: 'Order not found' });
    }
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', razorpayInstance.key_secret)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        checkout.paymentStatus = 'Successfull';
        checkout.paymentInfo.paymentId = razorpay_payment_id;
        checkout.paymentInfo.razorpaySignature = razorpay_signature;
        await checkout.save();

        return res.status(200).json({ message: 'Payment verified successfully', checkout });
    } else {
        return res.status(400).json({ error: 'Payment verification failed' });
    }
};

exports.getData = async (req, res) => {
    try {
        const data = await Checkout.find()
        if (!data && data.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order Not Found"
            })
        }
        res.status(200).json({
            success: true,
            data: data.reverse()
        })
    } catch (error) {
        console.log(error)
    }
}


exports.getDataSingle = async (req, res) => {
    try {
        const data = await Checkout.findById(req.params.id)
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Order Not Found"
            })
        }
        res.status(200).json({
            success: true,
            data: data
        })
    } catch (error) {
        console.log(error)
    }
}

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderStatus, paymentStatus } = req.body;
        const existingOrder = await Checkout.findById(req.params.id);
        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        // Prepare the update object
        const updatedData = {};
        if (orderStatus) updatedData.orderStatus = orderStatus;
        if (paymentStatus) updatedData.paymentStatus = paymentStatus;

        // Update the order
        const updatedOrder = await Checkout.findByIdAndUpdate(
            req.params.id,
            { $set: updatedData },
            { new: true } // Return the updated document
        );

        res.status(200).json({
            success: true,
            message: "Order updated successfully",
            data: updatedOrder,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "An error occurred while updating the order",
        });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const data = await Checkout.findById(req.params.id)
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Order Not Found"
            })
        }
        await data.deleteOne()
        res.status(200).json({
            success: true,
            message: "Order Delete Successfully"
        })
    } catch (error) {
        console.log(error)
    }
}


exports.getorderByUserID = async (req, res) => {
    try {
        const data = await Checkout.find({ userId: req.params.id })
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Order Not Found"
            })
        }
        res.status(200).json({
            success: true,
            message: "Order Found Successfully",
            data: data.reverse()
        })
    } catch (error) {
        console.log(error)
    }
}