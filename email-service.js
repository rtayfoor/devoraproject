// email-service.js - Email notification service
const nodemailer = require('nodemailer');

// Email configuration from environment variables
const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
};

const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ormidia.com';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport(SMTP_CONFIG);
    }
    return transporter;
}

async function sendEmail({ to, subject, html, text }) {
    try {
        const transporter = getTransporter();
        
        const mailOptions = {
            from: `"Ormidia Car Accessories" <${FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '')
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return { success: false, error: error.message };
    }
}

async function sendOrderConfirmation(order, customerEmail) {
    const orderItemsHtml = (order.items || []).map(item => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${item.product_name || item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">€${(item.price || 0).toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">€${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
        </tr>
    `).join('');

    const total = order.total || (order.items || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : new Date().toLocaleDateString();

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .header h1 { margin: 0; font-size: 24px; }
                .header h1 span { color: #E30613; }
                .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
                .order-details { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .order-details p { margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 600; }
                .total-row { font-weight: 700; font-size: 1.1rem; }
                .total-row td { padding-top: 15px; border-top: 2px solid #E30613; }
                .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 0.85rem; }
                .btn { display: inline-block; background: #E30613; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; }
                .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; background: #fef3c7; color: #92400e; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ormidia <span>CA</span></h1>
                    <p style="margin:5px 0 0;opacity:0.8;">Order Confirmation</p>
                </div>
                <div class="content">
                    <h2 style="color:#1e293b;margin-top:0;">Thank You for Your Order! 🎉</h2>
                    <p>Hi ${order.customer_name || 'Customer'},</p>
                    <p>We're excited to confirm that we've received your order. Here are the details:</p>

                    <div class="order-details">
                        <p><strong>Order ID:</strong> #${order.id}</p>
                        <p><strong>Date:</strong> ${orderDate}</p>
                        <p><strong>Status:</strong> <span class="status">${order.status || 'Pending'}</span></p>
                        <p><strong>Delivery Address:</strong> ${order.delivery_address || 'N/A'}</p>
                        ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
                    </div>

                    <h3 style="margin:20px 0 10px;">Order Items</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th style="text-align:center;">Qty</th>
                                <th style="text-align:right;">Price</th>
                                <th style="text-align:right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orderItemsHtml || '<tr><td colspan="4" style="text-align:center;">No items</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="3" style="text-align:right;">Total:</td>
                                <td style="text-align:right;color:#E30613;">€${total.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div style="text-align:center;margin:25px 0;">
                        <a href="${process.env.BASE_URL || 'http://localhost:3000'}/profile.html" class="btn">View Your Orders</a>
                    </div>

                    <p style="color:#64748b;font-size:0.9rem;">We'll send you a confirmation once your order is processed. If you have any questions, please contact us at <a href="mailto:support@ormidia.com" style="color:#E30613;">support@ormidia.com</a></p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Ormidia Car Accessories. All rights reserved.</p>
                    <p style="font-size:0.75rem;">This is an automated message, please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
Ormidia Car Accessories - Order Confirmation

Thank You for Your Order!

Order ID: #${order.id}
Date: ${orderDate}
Status: ${order.status || 'Pending'}

Order Items:
${(order.items || []).map(item => `  - ${item.product_name || item.name} × ${item.quantity} = €${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`).join('\n')}

Total: €${total.toFixed(2)}

Delivery Address: ${order.delivery_address || 'N/A'}

Visit your profile to view your orders: ${process.env.BASE_URL || 'http://localhost:3000'}/profile.html

Thank you for shopping with Ormidia!
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Order Confirmation #${order.id} - Ormidia Car Accessories`,
        html: html,
        text: text
    });
}

async function sendAdminNotification(order, customerEmail) {
    const orderItemsHtml = (order.items || []).map(item => `
        <tr>
            <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${item.product_name || item.name}</td>
            <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.quantity}</td>
            <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:right;">€${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
        </tr>
    `).join('');

    const total = order.total || (order.items || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const orderDate = order.created_at ? new Date(order.created_at).toLocaleString() : new Date().toLocaleString();

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1a1a2e; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; }
                .header h2 { margin: 0; }
                .content { background: white; padding: 25px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
                .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; background: #fef3c7; color: #92400e; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th { background: #f1f5f9; padding: 8px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
                .total { font-weight: 700; font-size: 1.1rem; border-top: 2px solid #E30613; }
                .admin-actions { margin-top: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; }
                .btn { display: inline-block; background: #E30613; color: white; padding: 8px 18px; border-radius: 6px; text-decoration: none; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🛍️ New Order Received</h2>
                </div>
                <div class="content">
                    <p><strong>Order ID:</strong> #${order.id}</p>
                    <p><strong>Date:</strong> ${orderDate}</p>
                    <p><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
                    <p><strong>Email:</strong> <a href="mailto:${customerEmail}">${customerEmail}</a></p>
                    <p><strong>Phone:</strong> ${order.customer_phone || 'N/A'}</p>
                    <p><strong>Delivery Address:</strong> ${order.delivery_address || 'N/A'}</p>
                    <p><strong>Status:</strong> <span class="badge">${order.status || 'Pending'}</span></p>
                    ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}

                    <h4 style="margin:15px 0 10px;">Order Items</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th style="text-align:center;">Qty</th>
                                <th style="text-align:right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orderItemsHtml || '<tr><td colspan="3" style="text-align:center;">No items</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr class="total">
                                <td colspan="2" style="text-align:right;">Total:</td>
                                <td style="text-align:right;color:#E30613;">€${total.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="admin-actions">
                        <p style="margin:0 0 10px;"><strong>🔔 Admin Actions:</strong></p>
                        <a href="${process.env.BASE_URL || 'http://localhost:3000'}/admin" class="btn">View in Admin Panel</a>
                        <a href="${process.env.BASE_URL || 'http://localhost:3000'}/database-admin.html" class="btn" style="background:#1e293b;">Manage Orders</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
NEW ORDER RECEIVED - Ormidia Car Accessories

Order ID: #${order.id}
Date: ${orderDate}
Customer: ${order.customer_name || 'N/A'}
Email: ${customerEmail}
Phone: ${order.customer_phone || 'N/A'}
Status: ${order.status || 'Pending'}

Items:
${(order.items || []).map(item => `  - ${item.product_name || item.name} × ${item.quantity}`).join('\n')}

Total: €${total.toFixed(2)}

View in Admin Panel: ${process.env.BASE_URL || 'http://localhost:3000'}/admin
    `;

    return sendEmail({
        to: ADMIN_EMAIL,
        subject: `🔔 New Order #${order.id} - Action Required`,
        html: html,
        text: text
    });
}

async function sendOrderStatusUpdate(order, customerEmail, oldStatus, newStatus) {
    const statusMessages = {
        'processing': 'Your order is being processed and prepared for shipment.',
        'shipped': 'Your order has been shipped and is on its way!',
        'completed': 'Your order has been delivered. We hope you enjoy your purchase!',
        'cancelled': 'Your order has been cancelled.'
    };

    const statusEmojis = {
        'processing': '📦',
        'shipped': '🚚',
        'completed': '✅',
        'cancelled': '❌'
    };

    const message = statusMessages[newStatus] || `Your order status has been updated to ${newStatus}.`;
    const emoji = statusEmojis[newStatus] || '📋';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; }
                .container { max-width: 500px; margin: 0 auto; padding: 20px; }
                .header { background: #1a1a2e; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 25px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
                .status-update { text-align: center; padding: 15px; }
                .status-update .emoji { font-size: 3rem; }
                .status-update .status { display: inline-block; padding: 4px 16px; border-radius: 20px; font-weight: 600; background: #dcfce7; color: #166534; }
                .btn { display: inline-block; background: #E30613; color: white; padding: 8px 20px; border-radius: 6px; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 style="margin:0;">Order Status Update</h2>
                </div>
                <div class="content">
                    <div class="status-update">
                        <div class="emoji">${emoji}</div>
                        <h3 style="margin:10px 0 5px;">Order #${order.id}</h3>
                        <p style="margin:0;">Status: <span class="status">${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</span></p>
                    </div>
                    <p>${message}</p>
                    <div style="text-align:center;margin:20px 0;">
                        <a href="${process.env.BASE_URL || 'http://localhost:3000'}/profile.html" class="btn">View Your Orders</a>
                    </div>
                    <p style="color:#94a3b8;font-size:0.85rem;text-align:center;">Thank you for shopping with Ormidia!</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
Order Status Update - Order #${order.id}

Status: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}

${message}

View your orders: ${process.env.BASE_URL || 'http://localhost:3000'}/profile.html
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Order #${order.id} - Status Updated to ${newStatus}`,
        html: html,
        text: text
    });
}

module.exports = {
    sendEmail,
    sendOrderConfirmation,
    sendAdminNotification,
    sendOrderStatusUpdate,
    getTransporter
};