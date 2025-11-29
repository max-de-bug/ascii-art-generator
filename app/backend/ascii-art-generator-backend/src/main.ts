import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  // Allow multiple origins for development and production
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : ['http://localhost:3000'];
  
  console.log(`[CORS] Allowed origins from FRONTEND_URL: ${allowedOrigins.join(', ')}`);
  console.log(`[CORS] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        console.log('[CORS] Allowing request with no origin');
        return callback(null, true);
      }
      
      console.log(`[CORS] Request from origin: ${origin}`);
      
      // Check if origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        console.log(`[CORS] ✓ Origin allowed (in FRONTEND_URL list)`);
        return callback(null, true);
      }
      
      // Automatically allow any Vercel deployment (both production and preview)
      if (origin.endsWith('.vercel.app')) {
        console.log(`[CORS] ✓ Origin allowed (Vercel deployment)`);
        return callback(null, true);
      }
      
      // Also allow custom domains that might be used
      if (origin.includes('vercel.app') || origin.includes('vercel.com')) {
        console.log(`[CORS] ✓ Origin allowed (Vercel domain)`);
        return callback(null, true);
      }
      
      // Allow localhost in development
      if (process.env.NODE_ENV !== 'production' && 
          (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        console.log(`[CORS] ✓ Origin allowed (localhost in development)`);
        return callback(null, true);
      }
      
      // Reject all other origins
      console.log(`[CORS] ✗ Origin rejected: ${origin}`);
      callback(new Error(`CORS: Origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400, // 24 hours
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend server running on http://localhost:${port}`);
  console.log(`Indexer starting...`);
}
bootstrap();
