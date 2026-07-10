// src/routes/api/payment.js
const express = require('express');
const router = express.Router();
const paymentService = require('../../services/paymentService');
const emailService = require('../../services/emailService');

// Create order with bank transfer
router.post('/create-order', async (req, res) => {
    try {
        const orderData = req.body;
        
        // Validate order data
        if (!orderData.items || orderData.items.length === 0) {
            return res.status(400).json({ 
                error: 'Order must contain at least one item' 
            });
        }

        // Create order with bank transfer
        const result = await paymentService.createBankTransferOrder(orderData);
        
        // Send confirmation email (optional)
        try {
            await emailService.sendOrderConfirmation(result.order, result.paymentInstructions);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the order if email fails
        }

        res.json({
            success: true,
            order: result.order,
            paymentInstructions: result.paymentInstructions
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ 
            error: 'Failed to create order. Please try again.' 
        });
    }
});

// Get order payment instructions
router.get('/instructions/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const instructions = paymentService.generatePaymentInstructions(orderId, order.total);
        
        res.json({
            success: true,
            paymentInstructions: instructions,
            order: {
                id: order.id,
                total: order.total,
                created_at: order.created_at,
                status: order.status,
                payment_status: order.payment_status
            }
        });

    } catch (error) {
        console.error('Error getting payment instructions:', error);
        res.status(500).json({ error: 'Failed to get payment instructions' });
    }
});

// Admin: Confirm payment
router.post('/admin/confirm/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { adminNotes } = req.body;

        // Verify admin authentication here (add your auth middleware)
        
        const updatedOrder = await paymentService.confirmPayment(orderId, adminNotes);
        
        // Send confirmation email to customer
        try {
            await emailService.sendPaymentConfirmedEmail(updatedOrder);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }

        res.json({
            success: true,
            message: 'Payment confirmed successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// Admin: Reject payment
router.post('/admin/reject/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Reason for rejection is required' });
        }

        const updatedOrder = await paymentService.rejectPayment(orderId, reason);
        
        res.json({
            success: true,
            message: 'Payment rejected',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Error rejecting payment:', error);
        res.status(500).json({ error: 'Failed to reject payment' });
    }
});

// Admin: Get pending payments
router.get('/admin/pending', async (req, res) => {
    try {
        const pendingOrders = await paymentService.getPendingPayments();
        
        res.json({
            success: true,
            orders: pendingOrders,
            count: pendingOrders.length
        });

    } catch (error) {
        console.error('Error getting pending payments:', error);
        res.status(500).json({ error: 'Failed to get pending payments' });
    }
});

// Get order status
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const paymentStatus = await paymentService.getOrderPaymentStatus(orderId);
        const history = await paymentService.getOrderHistory(orderId);
        
        res.json({
            success: true,
            status: paymentStatus,
            history: history
        });

    } catch (error) {
        console.error('Error getting order status:', error);
        res.status(500).json({ error: 'Failed to get order status' });
    }
});

module.exports = router;
