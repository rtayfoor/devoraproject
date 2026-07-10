// payment-routes.js - Place in root directory
const express = require('express');
const router = express.Router();
const paymentService = require('./paymentService');

// ==========================================
// CREATE ORDER WITH BANK TRANSFER
// ==========================================
router.post('/create-order', async (req, res) => {
    try {
        console.log('📥 Payment create-order request received');
        const orderData = req.body;
        
        // Validate
        if (!orderData.items || orderData.items.length === 0) {
            console.log('❌ No items in order');
            return res.status(400).json({ 
                error: 'Order must contain at least one item' 
            });
        }

        if (!orderData.customer_email) {
            console.log('❌ No customer email');
            return res.status(400).json({ 
                error: 'Customer email is required' 
            });
        }

        if (!orderData.customer_name) {
            console.log('❌ No customer name');
            return res.status(400).json({ 
                error: 'Customer name is required' 
            });
        }

        console.log('✅ Order validation passed');

        // Create order
        const result = await paymentService.createBankTransferOrder(orderData);
        
        console.log('✅ Order created successfully, ID:', result.order.id);
        
        res.json({
            success: true,
            order: result.order,
            paymentInstructions: result.paymentInstructions
        });

    } catch (error) {
        console.error('❌ Error creating order:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to create order. Please try again.',
            details: error.stack
        });
    }
});

// ==========================================
// GET PAYMENT INSTRUCTIONS
// ==========================================
router.get('/instructions/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Get Supabase client
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', parseInt(orderId))
            .single();

        if (error || !order) {
            console.log('❌ Order not found:', orderId);
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

// ==========================================
// ADMIN: CONFIRM PAYMENT
// ==========================================
router.post('/admin/confirm/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { adminNotes } = req.body;
        
        const updatedOrder = await paymentService.confirmPayment(orderId, adminNotes);
        
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

// ==========================================
// ADMIN: REJECT PAYMENT
// ==========================================
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

// ==========================================
// ADMIN: GET PENDING PAYMENTS
// ==========================================
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

module.exports = router;