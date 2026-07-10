// paymentService.js - Place in root directory
const { createClient } = require('@supabase/supabase-js');
const bankConfig = require('./bank-config');

// Get Supabase config from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class PaymentService {
    // Generate payment instructions with YOUR IBAN
    generatePaymentInstructions(orderId, orderTotal) {
        const reference = `${bankConfig.orderPrefix}${orderId}`;
        
        return {
            bankDetails: {
                bankName: bankConfig.bankDetails.bankName,
                accountName: bankConfig.bankDetails.accountName,
                accountNumber: bankConfig.bankDetails.accountNumber,
                iban: bankConfig.bankDetails.iban,
                swift: bankConfig.bankDetails.swift,
                currency: bankConfig.bankDetails.currency,
                reference: reference
            },
            amount: orderTotal.toFixed(2),
            reference: reference,
            instructions: {
                reference: `Please use reference: ${reference}`,
                steps: [
                    '1. Log in to your online banking or visit your bank branch',
                    '2. Transfer the exact amount to the bank account below',
                    `3. Use the reference: ${reference}`,
                    '4. Email the payment confirmation receipt to support@ormidia.com',
                    '5. Your order will be processed within 24 hours of payment confirmation'
                ],
                notes: bankConfig.paymentInstructions.notes
            },
            orderId: orderId
        };
    }

    // Create order with bank transfer
    async createBankTransferOrder(orderData) {
        try {
            console.log('📦 Creating order with data:', JSON.stringify(orderData, null, 2));

            // Prepare order payload - only include columns that exist in your table
            const orderPayload = {
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone,
                customer_email: orderData.customer_email,
                delivery_address: orderData.delivery_address,
                notes: orderData.notes || null,
                items: orderData.items,
                total: orderData.total,
                status: 'pending',
                user_id: orderData.user_id,
                payment_method: 'bank_transfer',
                payment_status: 'pending'
            };

            console.log('📤 Inserting order:', JSON.stringify(orderPayload, null, 2));

            const { data: order, error } = await supabase
                .from('orders')
                .insert([orderPayload])
                .select()
                .single();

            if (error) {
                console.error('❌ Supabase insert error:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            if (!order) {
                throw new Error('Order creation failed - no data returned');
            }

            console.log('✅ Order created successfully:', order.id);

            // Generate payment instructions
            const instructions = this.generatePaymentInstructions(order.id, order.total);

            return {
                order,
                paymentInstructions: instructions
            };
        } catch (error) {
            console.error('❌ Error creating bank transfer order:', error);
            throw error;
        }
    }

    // Add order history (optional - if table doesn't exist, skip)
    async addOrderHistory(orderId, status, notes = null, updatedBy = 'customer') {
        try {
            // Check if order_status_history table exists
            const { error: checkError } = await supabase
                .from('order_status_history')
                .select('id')
                .limit(1);

            if (checkError && checkError.code === '42P01') {
                // Table doesn't exist, skip
                console.log('ℹ️ order_status_history table not found, skipping history');
                return true;
            }

            const { error } = await supabase
                .from('order_status_history')
                .insert([{
                    order_id: orderId,
                    status: status,
                    notes: notes,
                    updated_by: updatedBy
                }]);

            if (error) {
                console.warn('⚠️ Could not add order history:', error.message);
                return false;
            }
            return true;
        } catch (error) {
            console.warn('⚠️ Error adding order history:', error.message);
            return false;
        }
    }

    // Confirm payment (admin action)
    async confirmPayment(orderId, adminNotes = null) {
        try {
            const { data: order, error } = await supabase
                .from('orders')
                .update({
                    payment_status: 'confirmed',
                    status: 'processing',
                    payment_confirmed_at: new Date().toISOString()
                })
                .eq('id', orderId)
                .select()
                .single();

            if (error) throw error;
            return order;
        } catch (error) {
            console.error('Error confirming payment:', error);
            throw error;
        }
    }

    // Reject payment (admin action)
    async rejectPayment(orderId, reason) {
        try {
            const { data: order, error } = await supabase
                .from('orders')
                .update({
                    payment_status: 'rejected',
                    status: 'cancelled'
                })
                .eq('id', orderId)
                .select()
                .single();

            if (error) throw error;
            return order;
        } catch (error) {
            console.error('Error rejecting payment:', error);
            throw error;
        }
    }

    // Get pending payments
    async getPendingPayments() {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('payment_method', 'bank_transfer')
                .eq('payment_status', 'pending')
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting pending payments:', error);
            return [];
        }
    }

    // Get order payment status
    async getOrderPaymentStatus(orderId) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('payment_status, status, payment_confirmed_at')
                .eq('id', orderId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting order payment status:', error);
            throw error;
        }
    }
}

module.exports = new PaymentService();