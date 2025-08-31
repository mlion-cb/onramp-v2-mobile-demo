import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { z } from 'zod';

import { generateJwt } from '@coinbase/cdp-sdk/auth';

config({ path: '.env.local' });
config({ path: '.env' });

const app = express();
const PORT = Number(process.env.PORT || 3001);
console.log(PORT);

app.use(cors({
    origin: true,
    credentials: true
  }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inbound request logging
app.use((req, _res, next) => {
    console.log('Inbound request', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      body: req.body
    });
    next();
  });

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

app.post("/server/api", async (req, res) => {
  try {
    // Validate the request structure
    const requestSchema = z.object({
      url: z.string(), // Must be a valid URL
      body: z.any().optional(), // Any JSON body
      headers: z.record(z.string(), z.string()).optional() // Optional additional headers
    });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    const { url: targetUrl, body: targetBody, headers: additionalHeaders } = parsed.data;


    // Generate JWT for Coinbase API calls (if needed)
    const urlObj = new URL(targetUrl);
    let authToken = null;
    
    // Only generate JWT for Coinbase API calls
    if (urlObj.hostname === "api.developer.coinbase.com") {
      authToken = await generateJwt({
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!,
        requestMethod: "POST",
        requestHost: urlObj.hostname,
        requestPath: urlObj.pathname,
        expiresIn: 120
      });
    }

    // Build headers
    const headers = {
      "Content-Type": "application/json",
      ...(authToken && { "Authorization": `Bearer ${authToken}` }),
      ...(additionalHeaders || {}) // Merge client-provided headers
    };

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: headers,
      ...(targetBody && { body: JSON.stringify(targetBody) })
    });


    // Capture response safely
    const data = await response.json().catch(async () => {
      const raw = await response.text();
      console.log('Non-JSON response:', raw);
      return { raw };
    }); 
      
    console.log('Proxied request:', {
      url: targetUrl,
      status: response.status,
      ok: response.ok,
      dataPreview: JSON.stringify(data).slice(0, 1000)
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
