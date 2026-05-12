import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RoadQuest API',
      version: '1.0.0',
      description: 'API REST pour l\'application RoadQuest - Tracking GPS pour motards',
      contact: {
        name: 'CDA Niveau 6'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Serveur de développement'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            xp: { type: 'integer' },
            level: { type: 'integer' }
          }
        },
        Ride: {
          type: 'object',
          properties: {
            ride_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            start_location: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            end_location: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            distance: { type: 'number' },
            duration: { type: 'integer' },
            avg_speed: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        POI: {
          type: 'object',
          properties: {
            poi_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: ['col', 'route_panoramique', 'virage', 'spot_photo', 'monument', 'autre']
            },
            description: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            rating: { type: 'number', minimum: 0, maximum: 5 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
