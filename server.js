// ==========================================
// SERVER.JS - ORMIDIA CAR ACCESSORIES
// ==========================================

const dotenv = require('dotenv');
const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

const app = express();

// ==========================================
// RATE LIMITING MIDDLEWARE
// ==========================================

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many login attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/api/', apiLimiter);

// ==========================================
// SUPABASE CLIENT
// ==========================================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ==========================================
// ADMIN CREDENTIALS
// ==========================================
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'ormidiadatabaseaccess';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'accessdb1234Ormidia!';

// ==========================================
// ADMIN AUTH ENDPOINTS
// ==========================================

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
        return res.json({
            success: true,
            token: token,
            username: username,
            message: 'Admin login successful'
        });
    }
    
    return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/admin/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ authenticated: false, error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        if (decoded.includes('ormidiadatabaseaccess')) {
            return res.json({ authenticated: true, isAdmin: true });
        }
    } catch (e) {}
    return res.status(401).json({ authenticated: false, isAdmin: false });
});

app.post('/api/admin/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});

function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Admin token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        if (decoded.includes('ormidiadatabaseaccess')) {
            return next();
        }
    } catch (e) {
        console.error('Token verification error:', e);
    }
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid admin token' });
}

// ==========================================
// ADMIN PROTECTED ROUTES
// ==========================================

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'database-admin.html'));
});

app.get('/api/admin/tables', requireAdmin, async (req, res) => {
    try {
        const knownTables = ['products', 'product_variants', 'orders', 'users', 'categories', 'cart_reservations', 'wishlist', 'reviews'];
        const existingTables = [];
        for (const table of knownTables) {
            try {
                const { error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true })
                    .limit(1);
                if (!error) existingTables.push(table);
            } catch (e) {}
        }
        if (existingTables.length === 0) {
            res.json({ tables: ['products', 'orders', 'users'] });
            return;
        }
        res.json({ tables: existingTables });
    } catch (err) {
        console.error('Error fetching tables:', err);
        res.json({ tables: ['products', 'orders', 'users'] });
    }
});

app.get('/api/admin/data/:tableName', requireAdmin, async (req, res) => {
    const { tableName } = req.params;
    try {
        const { error: checkError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true })
            .limit(1);
        if (checkError) {
            return res.status(404).json({ error: `Table '${tableName}' not found` });
        }
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(100);
        if (error) throw error;
        let columns = [];
        if (data && data.length > 0) {
            columns = Object.keys(data[0]).map(key => ({
                name: key,
                type: typeof data[0][key]
            }));
        } else {
            columns = [
                { name: 'id', type: 'number' },
                { name: 'created_at', type: 'string' }
            ];
        }
        res.json({
            columns: columns,
            rows: data || [],
            count: data?.length || 0
        });
    } catch (err) {
        console.error('Error fetching table data:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/data/:tableName', requireAdmin, async (req, res) => {
    const { tableName } = req.params;
    const { row } = req.body;
    try {
        const { data, error } = await supabase
            .from(tableName)
            .insert([row])
            .select();
        if (error) throw error;
        res.json({ success: true, row: data?.[0] });
    } catch (err) {
        console.error('Insert error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/data/:tableName/:id', requireAdmin, async (req, res) => {
    const { tableName, id } = req.params;
    const { row, idColumn } = req.body;
    try {
        const { error } = await supabase
            .from(tableName)
            .update(row)
            .eq(idColumn || 'id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/data/:tableName/:id', requireAdmin, async (req, res) => {
    const { tableName, id } = req.params;
    const { idColumn } = req.body;
    try {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq(idColumn || 'id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ORDERS
// ==========================================

app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        const emailService = require('./email-service');
        
        if (!orderData.items || orderData.items.length === 0) {
            return res.status(400).json({ error: 'Order must contain items' });
        }
        if (!orderData.customer_email) {
            return res.status(400).json({ error: 'Customer email is required' });
        }
        
        let stockErrors = [];
        for (const item of orderData.items) {
            const variantId = item.variant_id;
            const quantity = item.quantity;
            if (variantId) {
                const { data: variant, error: fetchError } = await supabase
                    .from('product_variants')
                    .select('stock_quantity')
                    .eq('id', variantId)
                    .single();
                if (fetchError) {
                    stockErrors.push({ variantId, error: 'Variant not found', available: 0, requested: quantity });
                    continue;
                }
                const currentStock = variant.stock_quantity || 0;
                if (currentStock < quantity) {
                    stockErrors.push({ variantId, error: 'Insufficient stock', available: currentStock, requested: quantity });
                }
            }
        }
        
        if (stockErrors.length > 0) {
            return res.status(400).json({ 
                error: 'Stock availability issue',
                stockErrors: stockErrors,
                message: 'Some items do not have enough stock'
            });
        }
        
        const { data: order, error } = await supabase
            .from('orders')
            .insert([{
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone,
                customer_email: orderData.customer_email,
                delivery_address: orderData.delivery_address,
                notes: orderData.notes || null,
                items: orderData.items,
                total: orderData.total,
                status: 'pending',
                user_id: orderData.user_id
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Order creation error:', error);
            return res.status(500).json({ error: error.message });
        }
        
        let stockUpdateErrors = [];
        for (const item of orderData.items) {
            const variantId = item.variant_id;
            const quantity = item.quantity;
            if (variantId) {
                const { data: variant, error: fetchError } = await supabase
                    .from('product_variants')
                    .select('stock_quantity')
                    .eq('id', variantId)
                    .single();
                if (fetchError) {
                    stockUpdateErrors.push({ variantId, error: fetchError.message });
                    continue;
                }
                const currentStock = variant.stock_quantity || 0;
                const newStock = Math.max(0, currentStock - quantity);
                const { error: updateError } = await supabase
                    .from('product_variants')
                    .update({ stock_quantity: newStock })
                    .eq('id', variantId);
                if (updateError) {
                    stockUpdateErrors.push({ variantId, error: updateError.message });
                } else {
                    console.log(`✅ Stock updated: Variant ${variantId} (${currentStock} → ${newStock})`);
                }
            }
        }
        
        let customerEmailSent = false;
        let adminEmailSent = false;
        if (orderData.customer_email) {
            const emailResult = await emailService.sendOrderConfirmation(order, orderData.customer_email);
            customerEmailSent = emailResult.success;
        }
        const adminResult = await emailService.sendAdminNotification(order, orderData.customer_email);
        adminEmailSent = adminResult.success;
        
        res.json({ 
            success: true, 
            order: order,
            emails: { customer: customerEmailSent, admin: adminEmailSent },
            stockUpdated: stockUpdateErrors.length === 0,
            stockErrors: stockUpdateErrors.length > 0 ? stockUpdateErrors : null
        });
        
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: error.message || 'Failed to create order' });
    }
});

app.put('/api/orders/:orderId/status', requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes } = req.body;
        const emailService = require('./email-service');
        const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', parseInt(orderId))
            .single();
        if (fetchError || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const updateData = { status: status };
        if (notes) updateData.notes = notes;
        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', parseInt(orderId))
            .select()
            .single();
        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(500).json({ error: updateError.message });
        }
        let emailSent = false;
        let emailError = null;
        if (order.customer_email) {
            try {
                const emailResult = await emailService.sendOrderStatusUpdate(
                    updatedOrder,
                    order.customer_email,
                    order.status || 'pending',
                    status
                );
                emailSent = emailResult.success;
                if (!emailResult.success) emailError = emailResult.error;
            } catch (emailErr) {
                emailError = emailErr.message;
            }
        }
        res.json({ 
            success: true, 
            order: updatedOrder,
            emailSent: emailSent,
            emailError: emailError
        });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// PASSWORD RESET
// ==========================================

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        const emailService = require('./email-service');
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .maybeSingle();
        if (userError || !user) {
            return res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
        }
        const resetToken = Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');
        const expiresAt = new Date(Date.now() + 3600000);
        await supabase
            .from('users')
            .update({ reset_token: resetToken, reset_token_expires: expiresAt })
            .eq('id', user.id);
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const resetLink = `${baseUrl}/reset-password.html?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;
        const result = await emailService.sendEmail({
            to: email,
            subject: '🔐 Reset Your Password - Ormidia Car Accessories',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; color: #1e293b; }
                        .container { max-width: 500px; margin: 0 auto; padding: 20px; }
                        .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .header span { color: #E30613; }
                        .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
                        .btn { display: inline-block; background: #E30613; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; margin: 15px 0; font-weight: 600; }
                        .footer { text-align: center; padding: 15px; color: #94a3b8; font-size: 0.85rem; border-top: 1px solid #e2e8f0; margin-top: 15px; }
                        .warning { color: #64748b; font-size: 0.85rem; }
                        .expiry { color: #94a3b8; font-size: 0.8rem; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Ormidia <span>CA</span></h1>
                            <p style="margin:5px 0 0;opacity:0.8;">Password Reset Request</p>
                        </div>
                        <div class="content">
                            <p>Hi ${user.name || 'Customer'},</p>
                            <p>We received a request to reset your password for your Ormidia account.</p>
                            <p>Click the button below to set a new password:</p>
                            <div style="text-align:center;">
                                <a href="${resetLink}" class="btn">🔑 Reset Password</a>
                            </div>
                            <p class="expiry">⏰ This link will expire in <strong>1 hour</strong>.</p>
                            <p class="warning">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2026 Ormidia Car Accessories. All rights reserved.</p>
                            <p style="font-size:0.75rem;">This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Ormidia Car Accessories - Password Reset\n\nHi ${user.name || 'Customer'},\n\nWe received a request to reset your password.\n\nClick this link to reset your password:\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.`
        });
        if (result.success) {
            console.log(`✅ Password reset email sent to ${email}`);
        } else {
            console.error('❌ Password reset email failed:', result.error);
        }
        res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Failed to send reset link. Please try again.' });
    }
});

app.post('/api/auth/verify-reset-token', async (req, res) => {
    try {
        const { token, email, password } = req.body;
        if (!token || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email, reset_token, reset_token_expires')
            .eq('email', email)
            .eq('reset_token', token)
            .maybeSingle();
        if (userError || !user) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }
        if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: password, reset_token: null, reset_token_expires: null })
            .eq('id', user.id);
        if (updateError) throw updateError;
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }
});

// ==========================================
// WISHLIST
// ==========================================

app.get('/api/wishlist', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        const { data, error } = await supabase
            .from('wishlist')
            .select(`
                id,
                product_id,
                variant_id,
                created_at,
                products:product_id (id, name, base_price, image_url),
                product_variants:variant_id (id, variant_name, price, stock_quantity)
            `)
            .eq('user_id', userId);
        if (error) throw error;
        res.json({ wishlist: data || [] });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/wishlist', async (req, res) => {
    try {
        const { userId, productId, variantId } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ error: 'User ID and Product ID required' });
        }
        const { data: existing } = await supabase
            .from('wishlist')
            .select('id')
            .eq('user_id', userId)
            .eq('product_id', productId)
            .maybeSingle();
        if (existing) {
            return res.status(400).json({ error: 'Item already in wishlist' });
        }
        const { data, error } = await supabase
            .from('wishlist')
            .insert([{ user_id: userId, product_id: productId, variant_id: variantId || null }])
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, wishlistItem: data });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/wishlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        const { error } = await supabase
            .from('wishlist')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        if (error) throw error;
        res.json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// REVIEWS
// ==========================================

app.get('/api/reviews/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { data, error } = await supabase
            .from('reviews')
            .select(`
                id,
                rating,
                title,
                comment,
                created_at,
                users:user_id (id, name)
            `)
            .eq('product_id', parseInt(productId))
            .order('created_at', { ascending: false });
        if (error) throw error;
        let averageRating = 0;
        if (data && data.length > 0) {
            const total = data.reduce((sum, r) => sum + r.rating, 0);
            averageRating = total / data.length;
        }
        res.json({
            reviews: data || [],
            averageRating: averageRating,
            totalReviews: data?.length || 0
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { userId, productId, rating, title, comment } = req.body;
        if (!userId || !productId || !rating) {
            return res.status(400).json({ error: 'User ID, Product ID, and Rating required' });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        const { data: existing } = await supabase
            .from('reviews')
            .select('id')
            .eq('user_id', userId)
            .eq('product_id', parseInt(productId))
            .maybeSingle();
        if (existing) {
            return res.status(400).json({ error: 'You have already reviewed this product' });
        }
        const { data, error } = await supabase
            .from('reviews')
            .insert([{
                user_id: userId,
                product_id: parseInt(productId),
                rating: rating,
                title: title || null,
                comment: comment || null
            }])
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, review: data });
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// PAYMENT ROUTES
// ==========================================

const paymentRoutes = require('./payment-routes');
app.use('/api/payment', paymentRoutes);

app.get('/api/payment/config', (req, res) => {
    try {
        const bankConfig = require('./bank-config');
        res.json({
            bankDetails: {
                bankName: bankConfig.bankDetails.bankName,
                accountName: bankConfig.bankDetails.accountName,
                iban: bankConfig.bankDetails.iban,
                swift: bankConfig.bankDetails.swift,
                currency: bankConfig.bankDetails.currency
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Bank config not available' });
    }
});

// ==========================================
// PUBLIC ROUTES
// ==========================================

app.get('/api/supabase/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

app.get('/api/test-email', async (req, res) => {
    try {
        const emailService = require('./email-service');
        const testOrder = {
            id: 'TEST-001',
            customer_name: 'Test Customer',
            customer_email: process.env.SMTP_USER || 'test@example.com',
            items: [{ product_name: 'Test Product', quantity: 1, price: 19.99 }],
            total: 19.99,
            delivery_address: '123 Test Street',
            status: 'pending',
            created_at: new Date().toISOString()
        };
        const result = await emailService.sendOrderConfirmation(testOrder, process.env.ADMIN_EMAIL || process.env.SMTP_USER);
        if (result.success) {
            res.json({ success: true, message: '✅ Test email sent successfully!' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// PUBLIC PAGES
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/products.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'products.html'));
});

app.get('/product.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'product.html'));
});

app.get('/cart.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cart.html'));
});

app.get('/checkout.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'checkout.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/auth.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/reset-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'reset-password.html'));
});

app.get('/payment-instructions.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment-instructions.html'));
});

// ==========================================
// 404 Handler
// ==========================================
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ==========================================
// VERCEl EXPORT
// ==========================================
module.exports = app;

// ==========================================
// START SERVER (Local Development Only)
// ==========================================
if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`\n🚀 ========================================`);
        console.log(`✅ Server Running!`);
        console.log(`🌐 Open: http://localhost:${port}`);
        console.log(`🔒 Admin Login: http://localhost:${port}/admin-login.html`);
        console.log(`📧 Test Email: http://localhost:${port}/api/test-email`);
        console.log(`========================================\n`);
    });
}
