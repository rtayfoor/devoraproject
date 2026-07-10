// bank-config.js - Place in root directory
module.exports = {
    bankDetails: {
        bankName: 'Hellenic Bank',
        accountName: 'Ormidia Car Accessories Ltd',
        accountNumber: '357042518854',
        iban: 'CY63002001950000357042518854',
        swift: 'BCYPCY2N',
        currency: 'EUR',
        country: 'Cyprus'
    },
    orderPrefix: 'ORD-',
    paymentInstructions: {
        reference: 'Please use your Order ID as payment reference',
        notes: [
            'Payment must be made within 48 hours of placing the order.',
            'Send us the payment confirmation receipt via email.',
            'Orders are processed after payment confirmation.',
            'Contact us at support@ormidia.com for any questions.'
        ]
    },
    autoConfirm: {
        enabled: false,
        delayHours: 24
    }
};