const { Client, Environment, LogLevel, OrdersController } = require('@paypal/paypal-server-sdk');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "TON_CLIENT_ID_SANDBOX";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "TON_CLIENT_SECRET_SANDBOX";

const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: PAYPAL_CLIENT_ID,
        oAuthClientSecret: PAYPAL_CLIENT_SECRET
    },
    timeout: 0,
    environment: Environment.Sandbox, // Change en Environment.Production pour le vrai site
    logging: { logLevel: LogLevel.Error }
});

const ordersController = new OrdersController(client);

// Créer une commande
async function createOrder(product, returnUrl, cancelUrl) {
    const collect = {
        body: {
            intent: 'CAPTURE',
            purchaseUnits: [{
                reference_id: product.id,
                amount: { currencyCode: 'USD', value: product.price.toFixed(2) },
                description: `${product.name}`
            }],
            applicationContext: {
                returnUrl: returnUrl,
                cancelUrl: cancelUrl,
                userAction: 'PAY_NOW'
            }
        }
    };

    const { body } = await ordersController.createOrder(collect);
    const responseData = typeof body === 'string' ? JSON.parse(body) : body;
    const approvalUrl = responseData.links?.find(link => link.rel === 'approve')?.href;
    
    return { success: true, orderId: responseData.id, approvalUrl };
}

// Capturer le paiement
async function captureOrder(orderId) {
    const { body } = await ordersController.captureOrder({ id: orderId });
    const responseData = typeof body === 'string' ? JSON.parse(body) : body;
    return responseData; // Retourne le statut (COMPLETED, etc.)
}

module.exports = { createOrder, captureOrder };