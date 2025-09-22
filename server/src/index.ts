import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import twilio from 'twilio';
import { z } from 'zod';

import { generateJwt } from '@coinbase/cdp-sdk/auth';

config({ path: '.env.local' });
config({ path: '.env' });

const app = express();
const PORT = Number(process.env.PORT || 3001);
console.log(`Port: ${PORT}; Env: ${process.env.NODE_ENV}`);

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);


app.use(cors({
    origin: true,
    credentials: true
  }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inbound request logging
app.use((req, _res, next) => {
    console.log('📥 Inbound request', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      body: req.body ? JSON.stringify(req.body).slice(0, 200) : 'No body'
    });
    next();
  });

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

/**
 * Generic proxy server for Coinbase API calls:
 * - Handles JWT authentication and forwards requests to avoid CORS issues
 * - JWT generation requires server-side CDP secrets
 * - Centralizes authentication logic
 * 
 * Usage: POST /server/api with { url, method, body }
 * Usage Pattern: Frontend → POST /server/api → Coinbase API → Response
 *  
 * Automatically handles:
 * - JWT generation for api.developer.coinbase.com
 * - Method switching (GET for options, POST for orders)
 * - Error forwarding with proper status codes
 */
app.post("/server/api", async (req, res) => {
  try {
    // Validate the request structure
    const requestSchema = z.object({
      url: z.string(), // Must be a valid URL
      method: z.enum(['GET', 'POST']).optional(),
      body: z.any().optional(), // Any JSON body
      headers: z.record(z.string(), z.string()).optional() // Optional additional headers
    });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    const { url: targetUrl, method: method, body: targetBody, headers: additionalHeaders } = parsed.data;


    // Generate JWT for Coinbase API calls (if needed)
    const urlObj = new URL(targetUrl);
    let authToken = null;
    
    // Auto-generate JWT for Coinbase API calls only
    if (urlObj.hostname === "api.developer.coinbase.com" || urlObj.hostname === "api.cdp.coinbase.com") {
      authToken = await generateJwt({
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!,
        requestMethod: method || 'POST',
        requestHost: urlObj.hostname,
        requestPath: urlObj.pathname,
        expiresIn: 120
      });
    }

    // Build headers
    const headers = {
      ...(method === 'POST' && { "Content-Type": "application/json" }),
      ...(authToken && { "Authorization": `Bearer ${authToken}` }),
      ...(additionalHeaders || {}) // Merge client-provided headers
    };

    // Forward request with authentication
    const response = await fetch(targetUrl, {
      method: method || 'POST',
      headers: headers,
      ...(method === 'POST' && targetBody && { body: JSON.stringify(targetBody) })
    });

    const data = await response.json();
      
    console.log('📤 Proxied request', {
      url: targetUrl,
      method: method || 'POST',
      status: response.status,
      ok: response.ok,
      dataPreview: data ? JSON.stringify(data).slice(0, 500) : 'No data'
    });

    // Return the upstream response (preserve status code)
    res.status(response.status).json(data);
  
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: "Proxy request failed", 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});


app.post('/auth/sms/start', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    const r = await twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phone, channel: 'sms' });

    return res.json({ status: r.status }); // pending
  } catch (e:any) {
    return res.status(500).json({ error: e.message || 'twilio start error' });
  }
});

app.post('/auth/sms/verify', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });

    const r = await twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phone, code });

    return res.json({ status: r.status, valid: r.valid }); // approved / pending
  } catch (e:any) {
    return res.status(500).json({ error: e.message || 'twilio verify error' });
  }
});