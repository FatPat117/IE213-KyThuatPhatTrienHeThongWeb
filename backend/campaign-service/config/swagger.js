const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Campaign Service API',
            version: '1.0.0',
            description: 'API documentation for the Campaign Service in the Crowdfunding platform.',
        },
        servers: [
            {
                url: `http://localhost:${process.env.GATEWAY_PORT || 5000}/api/campaigns`,
                description: 'API Gateway (Local)',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Nhập JWT token nhận được từ POST /api/auth/verify',
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: [
        path.join(__dirname, '../routes/*.js'),
        path.join(__dirname, '../controllers/*.js'),
    ],
};

let specs;
try {
    specs = swaggerJsdoc(options);
} catch (error) {
    console.error('[swagger] Failed to build docs, fallback to minimal spec:', error.message);
    specs = {
        openapi: '3.0.0',
        info: {
            title: 'Campaign Service API',
            version: '1.0.0',
            description: 'Swagger build failed due to resource limits. Service is still running.',
        },
        paths: {},
    };
}

module.exports = {
    swaggerUi,
    specs,
};
