import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Express is provided by @nestjs/platform-express
const express = require('express');

let cachedApp: any;
let appInitializing = false;
let initError: Error | null = null;

// Helper function to set CORS headers
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

async function createApp() {
  // If already cached, return it
  if (cachedApp) {
    return cachedApp;
  }

  // If currently initializing, wait for it
  if (appInitializing) {
    while (appInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (initError) {
      throw initError;
    }
    return cachedApp;
  }

  appInitializing = true;
  initError = null;

  try {
    console.log('[Serverless] Initializing NestJS app...');
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
    appInitializing = false;
    
    console.log('[Serverless] App initialized successfully');
    return cachedApp;
  } catch (error: any) {
    appInitializing = false;
    initError = error;
    console.error('[Serverless] Failed to initialize app:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ALWAYS set CORS headers first, before anything else
  setCorsHeaders(req, res);
  
  console.log(`[Handler] ${req.method} ${req.url} from origin: ${req.headers.origin}`);
  console.log(`[Handler] Headers:`, JSON.stringify(req.headers, null, 2));
  
  // Simple health check route (before NestJS initialization)
  if (req.url === '/health' || req.url === '/api/health') {
    console.log('[Handler] Health check requested');
    return res.status(200).json({ 
      status: 'ok', 
      handler: 'working',
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle OPTIONS preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log('[Handler] Handling OPTIONS preflight');
    return res.status(200).end();
  }

  try {
    console.log('[Handler] Creating/getting app...');
    const app = await createApp();
    console.log('[Handler] App ready, processing request:', req.url);
    
    // Handle the request through Express/NestJS
    return new Promise<void>((resolve) => {
      let resolved = false;
      
      const finishHandler = () => {
        if (!resolved) {
          resolved = true;
          console.log('[Handler] Response finished');
          resolve();
        }
      };
      
      res.once('finish', finishHandler);
      res.once('close', finishHandler);
      
      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('[Handler] Timeout - resolving anyway');
          if (!res.headersSent) {
            setCorsHeaders(req, res);
            res.status(504).json({ error: 'Request timeout' });
          }
          resolve();
        }
      }, 29000); // 29 second timeout (Vercel has 30s limit)
      
      // Process the request
      app(req, res, (err?: any) => {
        clearTimeout(timeout);
        if (err && !resolved) {
          resolved = true;
          console.error('[Handler] Express error:', err);
          setCorsHeaders(req, res);
          if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Internal server error' });
          }
          resolve();
        }
      });
    });
  } catch (error: any) {
    console.error('[Handler Error]', error);
    console.error('[Handler Error Stack]', error?.stack);
    // CORS headers already set at the beginning
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error?.message || 'Internal server error',
        handler: 'error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }
}

