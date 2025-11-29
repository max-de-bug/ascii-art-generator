import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Express is provided by @nestjs/platform-express
const express = require('express');

let cachedApp: any;

async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  // Enable CORS for frontend - CRITICAL for Vercel
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : ['http://localhost:3000'];
  
  console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
  
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      
      console.log(`[CORS] Request from: ${origin}`);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Allow ALL Vercel deployments
      if (origin.includes('.vercel.app') || origin.includes('vercel.com')) {
        console.log(`[CORS] ✓ Allowed Vercel domain`);
        return callback(null, true);
      }
      
      if (process.env.NODE_ENV !== 'production' && 
          (origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:'))) {
        return callback(null, true);
      }
      
      console.log(`[CORS] ✗ Rejected: ${origin}`);
      callback(new Error(`CORS: ${origin} not allowed`));
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
    maxAge: 86400,
  });

  // Initialize app (DO NOT call listen() - this is serverless!)
  await app.init();
  cachedApp = expressApp;
  
  console.log('[Serverless] App initialized');
  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await createApp();
    return app(req, res);
  } catch (error: any) {
    console.error('[Handler Error]', error);
    // Set CORS headers even on error
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}

