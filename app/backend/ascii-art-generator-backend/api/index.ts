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
  
  // Simplified CORS - always allow Vercel domains and configured origins
  app.enableCors({
    origin: (origin, callback) => {
      // Always allow requests with no origin
      if (!origin) {
        console.log('[CORS] Allowing request with no origin');
        return callback(null, true);
      }
      
      console.log(`[CORS] Request from origin: ${origin}`);
      
      // Allow configured origins
      if (allowedOrigins.includes(origin)) {
        console.log(`[CORS] ✓ Allowed (configured origin)`);
        return callback(null, true);
      }
      
      // ALWAYS allow Vercel domains (simplified check)
      if (origin.includes('vercel.app') || origin.includes('vercel.com')) {
        console.log(`[CORS] ✓ Allowed (Vercel domain)`);
        return callback(null, true);
      }
      
      // Allow localhost in development
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        console.log(`[CORS] ✓ Allowed (localhost)`);
        return callback(null, true);
      }
      
      // For now, allow all origins in production to debug
      // TODO: Restrict this after confirming CORS works
      console.log(`[CORS] ⚠ Allowing origin (debug mode): ${origin}`);
      return callback(null, true);
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
  console.log(`[Handler] ${req.method} ${req.url} from origin: ${req.headers.origin}`);
  
  // Handle OPTIONS preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log('[Handler] Handling OPTIONS preflight');
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  try {
    console.log('[Handler] Creating/getting app...');
    const app = await createApp();
    console.log('[Handler] App ready, processing request...');
    
    // Set CORS headers BEFORE processing request
    const origin = req.headers.origin;
    if (origin) {
      console.log(`[Handler] Setting CORS headers for origin: ${origin}`);
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // Handle the request through Express/NestJS
    // Use a promise to ensure the handler waits for the response
    return new Promise<void>((resolve) => {
      // Set up response finish handler
      res.on('finish', () => {
        console.log('[Handler] Response finished');
        resolve();
      });
      
      res.on('close', () => {
        console.log('[Handler] Response closed');
        resolve();
      });
      
      // Process the request
      app(req, res, () => {
        // If response hasn't finished yet, this callback means Express is done processing
        // but response might still be sending
        if (!res.headersSent) {
          console.log('[Handler] Express done, but response not sent yet');
        }
      });
    });
  } catch (error: any) {
    console.error('[Handler Error]', error);
    console.error('[Handler Error Stack]', error?.stack);
    // Set CORS headers even on error
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(500).json({ 
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}

