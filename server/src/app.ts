import express from 'express';
import { z } from 'zod';

import { generateJwt } from '@coinbase/cdp-sdk/auth';
import twilio from 'twilio';
import { resolveClientIp } from './ip.js';
import { validateAccessToken } from './validateToken.js';
import { verifyWebhookSignature, verifyLegacySignature } from './verifyWebhookSignature.js';

let twilioClient: ReturnType<typeof import('twilio')> | null = null;
function getTwilio() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('Twilio env not configured');
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

// On Vercel, trust proxy to read x-forwarded-for
app.set('trust proxy', true);

// For webhook signature verification, we need raw body
// Use express.raw() for webhook routes before JSON parsing
app.use('/webhooks/onramp', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inbound request logging (webhooks only)
app.use((req, _res, next) => {
  if (req.path.startsWith('/webhooks')) {
    console.log('📥 Webhook:', req.path);
  }
  next();
});

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

// 🔒 GLOBAL AUTHENTICATION MIDDLEWARE
// All routes except /health and /webhooks require valid CDP access token
app.use((req, res, next) => {
  // Skip authentication for health check and webhooks only
  if (req.path === '/health' || req.path.startsWith('/webhooks')) {
    return next();
  }

  // Apply authentication to all other routes (including /push-tokens and /notifications/poll)
  return validateAccessToken(req, res, next);
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
 *
 * Note: Authentication handled by global middleware above
 */
app.post("/server/api", async (req, res) => {

  try {
    const clientIp = await resolveClientIp(req);
    
    // Validate the request structure
    const requestSchema = z.object({
      url: z.string(), // Must be a valid URL
      method: z.enum(['GET', 'POST']).optional(),
      body: z.any().optional(), // Any JSON body
      headers: z.record(z.string(), z.string()).optional() // Optional additional headers
    });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { url: targetUrl, method: method, body: targetBody, headers: additionalHeaders } = parsed.data;


    // Generate JWT for Coinbase API calls (if needed)
    const urlObj = new URL(targetUrl);
    let authToken = null;

    const isOnrampRequest = targetUrl.includes('/onramp/');
    const finalBody = isOnrampRequest ? { ...targetBody, clientIp } : targetBody;
    
    console.log('finalBody', finalBody);
    
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
      ...(method === 'POST' && finalBody && { body: JSON.stringify(finalBody) })
    });

    const data = await response.json();
      
    console.log('📤 Proxied request', {
      url: targetUrl,
      method: method || 'POST',
      status: response.status,
      ok: response.ok,
      dataPreview: data ? JSON.stringify(data).slice(0, 700) : 'No data'
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


// Twilio SMS endpoints
// Note: Authentication handled by global middleware above
app.post('/auth/sms/start', async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone required' });

    console.log('📱 [TWILIO] SMS start request - User:', req.userId, 'Phone:', phone);

    const r = await getTwilio().verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phone, channel: 'sms' });

    console.log('✅ [TWILIO] SMS sent successfully - Status:', r.status);
    res.json({ status: r.status });
  } catch (e: any) {
    console.error('❌ [TWILIO] SMS start error:', e.message);
    res.status(500).json({ error: e.message || 'twilio start error' });
  }
});

app.post('/auth/sms/verify', async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });

    console.log('🔐 [TWILIO] SMS verify request - User:', req.userId, 'Phone:', phone);

    const r = await getTwilio().verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phone, code });

    console.log('✅ [TWILIO] SMS verification result - Status:', r.status, 'Valid:', r.valid);
    return res.json({ status: r.status, valid: r.valid });
  } catch (e:any) {
    console.error('❌ [TWILIO] SMS verify error:', e.message);
    return res.status(500).json({ error: e.message || 'twilio verify error' });
  }
});

/**
 * EVM Token Balance Endpoint
 * GET /balances/evm?address=0x...&network=base
 *
 * Supported networks: base, ethereum (mainnet only)
 * Returns token balances with USD prices from Coinbase Price API
 */
app.get('/balances/evm', async (req, res) => {
  try {
    const { address, network = 'base' } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'address query parameter required' });
    }

    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid EVM address format' });
    }

    const validNetworks = ['base', 'ethereum'];
    if (!validNetworks.includes(network as string)) {
      return res.status(400).json({ error: `Invalid network. Supported: ${validNetworks.join(', ')}` });
    }

    console.log(`💰 [BALANCES] Fetching EVM balances - Address: ${address}, Network: ${network}`);

    const balancesPath = `/platform/v2/evm/token-balances/${network}/${address}`;
    const balancesUrl = `https://api.cdp.coinbase.com${balancesPath}`;

    console.log(`🔗 [BALANCES] Full URL: ${balancesUrl}`);

    const authToken = await generateJwt({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      requestMethod: 'GET',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: balancesPath,
      expiresIn: 120
    });

    const balancesResponse = await fetch(balancesUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log(`📡 [BALANCES] Response status: ${balancesResponse.status} ${balancesResponse.statusText}`);

    if (!balancesResponse.ok) {
      const errorText = await balancesResponse.text();
      console.error('❌ [BALANCES] CDP API error response:', errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error('❌ [BALANCES] CDP API error details:', errorData);
      return res.status(balancesResponse.status).json({
        error: 'Failed to fetch balances from CDP',
        details: errorData
      });
    }

    const balancesData = await balancesResponse.json();
    const balances = balancesData.balances || [];

    console.log(`✅ [BALANCES] Fetched ${balances.length} token balances`);

    // Filter zero balances and enrich with USD prices
    const enrichedBalances = await Promise.all(
      balances
        .filter((b: any) => parseFloat(b.amount?.amount || '0') > 0)
        .map(async (balance: any) => {
          const symbol = balance.token?.symbol || 'UNKNOWN';
          let usdPrice = null;
          let usdValue = null;

          if (symbol && symbol !== 'UNKNOWN') {
            try {
              const priceUrl = `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`;
              console.log(`💵 [PRICE] Fetching USD price for ${symbol}: ${priceUrl}`);

              const priceResponse = await fetch(priceUrl);

              if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                usdPrice = parseFloat(priceData.data?.amount || '0');

                const tokenAmount = parseFloat(balance.amount?.amount || '0');
                const decimals = parseInt(balance.amount?.decimals || '0');
                const actualAmount = tokenAmount / Math.pow(10, decimals);
                usdValue = actualAmount * usdPrice;

                console.log(`✅ [PRICE] ${symbol} = $${usdPrice} | Balance: ${actualAmount.toFixed(6)} ${symbol} = $${usdValue.toFixed(2)}`);
              } else {
                console.warn(`⚠️ [PRICE] Price API returned ${priceResponse.status} for ${symbol}`);
              }
            } catch (e) {
              console.warn(`⚠️ [PRICE] Could not fetch price for ${symbol}:`, e instanceof Error ? e.message : e);
            }
          }

          return {
            token: balance.token,
            amount: balance.amount,
            usdPrice,
            usdValue
          };
        })
    );

    console.log(`💵 [BALANCES] Enriched ${enrichedBalances.length} balances with USD prices`);

    res.json({
      address,
      network,
      balances: enrichedBalances,
      totalBalances: enrichedBalances.length
    });

  } catch (error) {
    console.error('❌ [BALANCES] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch token balances',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Solana Token Balance Endpoint
 * GET /balances/solana?address=...
 *
 * Returns SPL token balances with USD prices from Coinbase Price API
 */
app.get('/balances/solana', async (req, res) => {
  try {
    const { address } = req.query;
    const network = 'solana';

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'address query parameter required' });
    }

    // Basic Solana address validation (base58, 32-44 chars)
    if (!address.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      return res.status(400).json({ error: 'Invalid Solana address format' });
    }

    console.log(`💰 [BALANCES] Fetching Solana balances - Address: ${address}`);

    const balancesPath = `/platform/v2/solana/token-balances/${network}/${address}`;
    const balancesUrl = `https://api.cdp.coinbase.com${balancesPath}`;

    console.log(`🔗 [BALANCES] Full URL: ${balancesUrl}`);

    const authToken = await generateJwt({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      requestMethod: 'GET',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: balancesPath,
      expiresIn: 120
    });

    const balancesResponse = await fetch(balancesUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log(`📡 [BALANCES] Response status: ${balancesResponse.status} ${balancesResponse.statusText}`);

    if (!balancesResponse.ok) {
      const errorText = await balancesResponse.text();
      console.error('❌ [BALANCES] CDP API error response:', errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error('❌ [BALANCES] CDP API error details:', errorData);
      return res.status(balancesResponse.status).json({
        error: 'Failed to fetch Solana balances from CDP',
        details: errorData
      });
    }

    const balancesData = await balancesResponse.json();
    const balances = balancesData.balances || [];

    console.log(`✅ [BALANCES] Fetched ${balances.length} Solana token balances`);

    // Filter zero balances and enrich with USD prices
    const enrichedBalances = await Promise.all(
      balances
        .filter((b: any) => parseFloat(b.amount?.amount || '0') > 0)
        .map(async (balance: any) => {
          const symbol = balance.token?.symbol || 'UNKNOWN';
          let usdPrice = null;
          let usdValue = null;

          if (symbol && symbol !== 'UNKNOWN') {
            try {
              const priceUrl = `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`;
              console.log(`💵 [PRICE] Fetching USD price for ${symbol}: ${priceUrl}`);

              const priceResponse = await fetch(priceUrl);

              if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                usdPrice = parseFloat(priceData.data?.amount || '0');

                const tokenAmount = parseFloat(balance.amount?.amount || '0');
                const decimals = parseInt(balance.amount?.decimals || '0');
                const actualAmount = tokenAmount / Math.pow(10, decimals);
                usdValue = actualAmount * usdPrice;

                console.log(`✅ [PRICE] ${symbol} = $${usdPrice} | Balance: ${actualAmount.toFixed(6)} ${symbol} = $${usdValue.toFixed(2)}`);
              } else {
                console.warn(`⚠️ [PRICE] Price API returned ${priceResponse.status} for ${symbol}`);
              }
            } catch (e) {
              console.warn(`⚠️ [PRICE] Could not fetch price for ${symbol}:`, e instanceof Error ? e.message : e);
            }
          }

          return {
            token: balance.token,
            amount: balance.amount,
            usdPrice,
            usdValue
          };
        })
    );

    console.log(`💵 [BALANCES] Enriched ${enrichedBalances.length} Solana balances with USD prices`);

    res.json({
      address,
      network,
      balances: enrichedBalances,
      totalBalances: enrichedBalances.length
    });

  } catch (error) {
    console.error('❌ [BALANCES] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch Solana token balances',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Push Token Storage
 * POST /push-tokens
 *
 * Stores user's Expo push token for sending notifications
 * Called when user opens app and registers for notifications
 */
const pushTokenStore = new Map<string, { token: string; platform: string; updatedAt: number }>();

// Store pending notifications for polling (simulator support)
interface PendingNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data: any;
  createdAt: number;
}
const pendingNotifications = new Map<string, PendingNotification[]>();

app.post('/push-tokens', async (req, res) => {
  try {
    const { userId, pushToken, platform } = req.body;

    if (!userId || !pushToken) {
      return res.status(400).json({ error: 'userId and pushToken are required' });
    }

    // Security: Verify the authenticated user matches the userId they're trying to register
    if (req.userId !== userId) {
      console.error('❌ [PUSH] Unauthorized token registration attempt');
      return res.status(403).json({ error: 'Forbidden: Cannot register push token for another user' });
    }

    pushTokenStore.set(userId, {
      token: pushToken,
      platform: platform || 'unknown',
      updatedAt: Date.now(),
    });

    console.log('✅ [PUSH] Token registered for user:', userId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [PUSH] Error:', error);
    res.status(500).json({ error: 'Failed to store push token' });
  }
});

/**
 * Poll for pending notifications (simulator support)
 * GET /notifications/poll?userId=USER_ID
 */
app.get('/notifications/poll', (req, res) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Security: Verify the authenticated user matches the userId they're polling for
    if (req.userId !== userId) {
      console.error('❌ [POLL] Unauthorized poll attempt');
      return res.status(403).json({ error: 'Forbidden: Cannot poll notifications for another user' });
    }

    // Get pending notifications for this user
    const userNotifications = pendingNotifications.get(userId) || [];

    // Debug logging
    console.log(`🔍 [POLL] Checking for userId: ${userId}`);
    console.log(`🔍 [POLL] Found ${userNotifications.length} notification(s)`);
    console.log(`🔍 [POLL] All pending users in memory:`, Array.from(pendingNotifications.keys()));

    // Clear the notifications after fetching
    if (userNotifications.length > 0) {
      pendingNotifications.delete(userId);
      console.log(`🔔 [POLL] Delivered ${userNotifications.length} notification(s)`);
    }

    res.json({ notifications: userNotifications });
  } catch (error) {
    console.error('❌ [POLL] Error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * Onramp Webhook Endpoint
 * POST /webhooks/onramp
 *
 * Receives transaction status updates from Coinbase
 * Events: onramp.transaction.created, onramp.transaction.updated, onramp.transaction.success, onramp.transaction.failed
 *
 * Security: Verifies webhook signature using CDP API key
 * Use case: Send push notifications when transactions complete
 *
 * Note: This endpoint is PUBLIC (no auth middleware) because Coinbase servers call it
 */
app.post('/webhooks/onramp', async (req, res) => {
  try {
    // Get raw body (from express.raw middleware)
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    // Parse JSON from raw body
    const webhookData = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;

    const eventType = webhookData.eventType || webhookData.event;
    console.log('🔔 [WEBHOOK] Received:', eventType);

    // Verify webhook signature (security check)
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret) {
      // Try X-Hook0-Signature (new format)
      const hook0Signature = req.headers['x-hook0-signature'] as string;

      if (hook0Signature) {
        const isValid = verifyWebhookSignature(hook0Signature, req.headers, rawBody, webhookSecret);
        if (!isValid) {
          console.error('❌ [WEBHOOK] Invalid signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('✅ [WEBHOOK] Signature verified');
      }
      // Fallback: Try x-coinbase-signature (legacy format)
      else {
        const coinbaseSignature = req.headers['x-coinbase-signature'] as string;
        const timestamp = req.headers['x-coinbase-timestamp'] as string;

        if (coinbaseSignature && timestamp) {
          const isValid = verifyLegacySignature(coinbaseSignature, timestamp, rawBody, webhookSecret);
          if (!isValid) {
            console.error('❌ [WEBHOOK] Invalid x-coinbase-signature');
            return res.status(401).json({ error: 'Invalid signature' });
          }
          console.log('✅ [WEBHOOK] x-coinbase-signature verified');
        } else {
          console.warn('⚠️ [WEBHOOK] No signature headers found - rejecting webhook');
          return res.status(401).json({ error: 'Missing signature headers' });
        }
      }
    } else {
      console.warn('⚠️ [WEBHOOK] WEBHOOK_SECRET not set - skipping verification (INSECURE!)');
    }

    // Extract transaction ID (different field names)
    const txId = webhookData.transactionId || webhookData.orderId || webhookData.data?.transaction?.id;

    // Handle different webhook events
    switch (eventType) {
      case 'onramp.transaction.created':
        console.log('📝 [WEBHOOK] Transaction created:', txId);
        // Transaction initiated - could send "processing" notification
        break;

      case 'onramp.transaction.updated':
        console.log('🔄 [WEBHOOK] Transaction updated:', txId);
        // Transaction status changed - could track intermediate states
        break;

      case 'onramp.transaction.success':
      case 'onramp.transaction.completed': // Support both event names
        console.log('✅ [WEBHOOK] Transaction completed:', txId);

        // Extract fields (handle both Apple Pay and Widget formats)
        // Apple Pay: { purchaseAmount: "100.000000", purchaseCurrency: "USDC", destinationNetwork: "base" }
        // Widget: { purchaseAmount: { value: "4.81", currency: "USDC" }, purchaseCurrency: "USDC", purchaseNetwork: "ethereum" }

        const amount = typeof webhookData.purchaseAmount === 'object'
          ? webhookData.purchaseAmount?.value
          : webhookData.purchaseAmount;

        const currency = webhookData.purchaseCurrency;

        const network = webhookData.destinationNetwork || webhookData.purchaseNetwork;

        const partnerUserRef = webhookData.partnerUserRef;

        console.log('💰 [WEBHOOK] User received:', {
          amount,
          currency,
          network,
          address: webhookData.destinationAddress || webhookData.walletAddress,
          partnerUserRef
        });

        // Send push notification via Expo Push API (user-specific)
        try {
          if (!partnerUserRef) {
            console.log('⚠️ [WEBHOOK] No partnerUserRef in transaction - cannot send notification');
            break;
          }

          // Prepare notification content
          const title = '🎉 Crypto Purchase Complete!';
          const body = `Your ${amount} ${currency} has been delivered to your ${network} wallet!`;
          const notificationData = {
            transactionId: txId,
            type: 'onramp_complete',
            partnerUserRef
          };

          // ALWAYS store notification for polling (works even if push token not found)
          const notification: PendingNotification = {
            id: `${Date.now()}-${Math.random()}`,
            userId: partnerUserRef,
            title,
            body,
            data: notificationData,
            createdAt: Date.now()
          };

          const userPendingNotifs = pendingNotifications.get(partnerUserRef) || [];
          userPendingNotifs.push(notification);
          pendingNotifications.set(partnerUserRef, userPendingNotifs);
          console.log('✅ [WEBHOOK] Notification queued for polling');

          // Also try to send real push notification (for physical devices with registered tokens)
          const userTokenData = pushTokenStore.get(partnerUserRef);

          if (userTokenData) {
            try {
              const message = {
                to: userTokenData.token,
                sound: 'default',
                title,
                body,
                data: notificationData,
              };

              const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
              });

              const pushResult = await pushResponse.json();
              console.log('📤 [WEBHOOK] Push notification response:', JSON.stringify(pushResult));

              // Check if push failed due to credentials
              if (pushResult.data?.status === 'error') {
                console.error('❌ [WEBHOOK] Push delivery error:', pushResult.data.message);
                console.error('💡 [WEBHOOK] Hint: Configure APNs credentials with "eas credentials"');
              } else {
                console.log('✅ [WEBHOOK] Push notification sent for transaction:', txId);
              }
            } catch (pushError) {
              console.error('❌ [WEBHOOK] Failed to send push notification:', pushError);
            }
          } else {
            console.log('ℹ️ [WEBHOOK] No push token - notification will be delivered via polling');
          }
        } catch (error) {
          console.error('❌ [WEBHOOK] Failed to process notification:', error);
        }
        break;

      case 'onramp.transaction.failed':
        console.log('❌ [WEBHOOK] Transaction failed:', txId);

        // Extract failure fields (handle both formats)
        const failedAmount = typeof webhookData.paymentAmount === 'object'
          ? webhookData.paymentAmount?.value
          : webhookData.paymentAmount;

        const failedCurrency = typeof webhookData.paymentAmount === 'object'
          ? webhookData.paymentAmount?.currency
          : webhookData.paymentCurrency;

        const failureReason = webhookData.failureReason || 'Unknown error';
        const failedPartnerUserRef = webhookData.partnerUserRef;

        console.log('⚠️ [WEBHOOK] Failure details:', {
          amount: failedAmount,
          currency: failedCurrency,
          reason: failureReason,
          partnerUserRef: failedPartnerUserRef
        });

        // Send notification for failed transaction (user-specific)
        try {
          if (!failedPartnerUserRef) {
            console.log('⚠️ [WEBHOOK] No partnerUserRef in failed transaction - cannot send notification');
            break;
          }

          // Prepare notification content
          const failTitle = '❌ Transaction Failed';
          const failBody = `Your purchase failed: ${failureReason}. Please try again.`;
          const failData = {
            transactionId: txId,
            type: 'onramp_failed',
            partnerUserRef: failedPartnerUserRef
          };

          // ALWAYS store notification for polling (works even if push token not found)
          const failNotification: PendingNotification = {
            id: `${Date.now()}-${Math.random()}`,
            userId: failedPartnerUserRef,
            title: failTitle,
            body: failBody,
            data: failData,
            createdAt: Date.now()
          };

          const failUserPendingNotifs = pendingNotifications.get(failedPartnerUserRef) || [];
          failUserPendingNotifs.push(failNotification);
          pendingNotifications.set(failedPartnerUserRef, failUserPendingNotifs);
          console.log('✅ [WEBHOOK] Failure notification queued for polling');

          // Also try to send real push notification (for physical devices with registered tokens)
          const failedUserTokenData = pushTokenStore.get(failedPartnerUserRef);

          if (failedUserTokenData) {
            try {
              const failureMessage = {
                to: failedUserTokenData.token,
                sound: 'default',
                title: failTitle,
                body: failBody,
                data: failData,
              };

              const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(failureMessage),
              });

              const pushResult = await pushResponse.json();
              console.log('✅ [WEBHOOK] Failure push notification sent for transaction:', txId);
            } catch (pushError) {
              console.error('❌ [WEBHOOK] Failed to send failure push notification:', pushError);
            }
          } else {
            console.log('ℹ️ [WEBHOOK] No push token - failure notification will be delivered via polling');
          }
        } catch (error) {
          console.error('❌ [WEBHOOK] Error processing failure notification:', error);
        }
        break;

      default:
        console.log('ℹ️ [WEBHOOK] Unknown event type:', event);
    }

    // Always return 200 to acknowledge receipt
    // Coinbase will retry if we don't respond with 2xx
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    // Still return 200 to prevent retries on parsing errors
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default app;