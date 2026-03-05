const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

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
                url: 'http://localhost:4000/api/campaigns', // Pointing to API Gateway
                description: 'API Gateway (Local)',
            },
        ],
    },
    apis: ['./routes/*.js', './controllers/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = {
    swaggerUi,
    specs,
};
