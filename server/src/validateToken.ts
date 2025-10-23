import { generateJwt } from '@coinbase/cdp-sdk/auth';
import type { NextFunction, Request, Response } from 'express';

// TestFlight account constants (matches /constants/TestAccounts.ts)
const TESTFLIGHT_EMAIL = 'reviewer@coinbase-demo.app';
const TESTFLIGHT_PHONE = '+12345678901';

// Cache validated tokens to reduce API calls
const tokenCache = new Map<string, { userId: string, expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function validateAccessToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    console.log('🔒 [MIDDLEWARE] validateAccessToken called');

    // Check for TestFlight account (bypass authentication)
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const isTestFlightToken = token?.includes('testflight');
    const isTestFlightEmail = req.body?.email === TESTFLIGHT_EMAIL;
    const isTestFlightPhone = req.body?.phoneNumber === TESTFLIGHT_PHONE;

    if (isTestFlightToken || isTestFlightEmail || isTestFlightPhone) {
      console.log('🧪 [MIDDLEWARE] TestFlight account detected - bypassing authentication');
      req.userId = 'testflight-reviewer';
      req.userData = {
        id: 'testflight-reviewer',
        email: TESTFLIGHT_EMAIL,
        testAccount: true
      };
      return next();
    }

    // Check which endpoint is being called
    const targetUrl = req.body?.url || '';
    console.log('🔒 [MIDDLEWARE] Target URL:', targetUrl);

    // ONLY allow these public endpoints without authentication
    const publicEndpoints = [
      '/v1/buy/config',       // Buy configuration (countries, assets, networks) - ONLY
      '/v2/onramp/options'    // Payment options and currencies - ONLY
    ];

    // Check if this is a public endpoint
    const isPublicEndpoint = publicEndpoints.some(endpoint => targetUrl.includes(endpoint));

    if (isPublicEndpoint) {
      console.log('🌐 [MIDDLEWARE] Public endpoint - skipping authentication');
      return next();
    }

    // Protected endpoints - require authentication
    console.log('🔒 [MIDDLEWARE] Protected endpoint - validating authentication');
    console.log('🔒 [MIDDLEWARE] Headers:', {
      authorization: authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING',
      'content-type': req.headers['content-type'],
      origin: req.headers.origin
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [MIDDLEWARE] Missing or invalid Authorization header for protected endpoint');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in to create transactions.'
      });
    }

    // Token already extracted above, just log it
    console.log('🔒 [MIDDLEWARE] Token extracted:', `${token?.substring(0, 20)}...${token?.substring(token?.length - 10)}`);

    // Check cache first
    const cached = tokenCache.get(token as string);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('✅ Token valid (cached)');
      req.userId = cached.userId; // Add userId to request
      return next();
    }

    // Validate with CDP API
    console.log('🔍 Validating token with CDP API...');
    console.log('🔍 [CDP API] Endpoint: https://api.cdp.coinbase.com/platform/v2/end-users/auth/validate-token');
    console.log('🔍 [CDP API] Method: POST');
    console.log('🔍 [CDP API] User token (in body):', `${token?.substring(0, 30)}...`);

    // Generate JWT for CDP API authentication (server credentials)
    const jwtToken = await generateJwt({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      requestMethod: 'POST',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: '/platform/v2/end-users/auth/validate-token',
      expiresIn: 120
    });

    console.log('🔍 [CDP API] JWT generated (in header):', `${jwtToken.substring(0, 30)}...`);

    const response = await fetch(
      'https://api.cdp.coinbase.com/platform/v2/end-users/auth/validate-token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}` // ← JWT token (server credentials)
        },
        body: JSON.stringify({
          accessToken: token  // ← User's access token (to validate)
        })
      }
    );

    console.log('📥 [CDP API] Response status:', response.status);
    console.log('📥 [CDP API] Response ok:', response.ok);
    console.log('📥 [CDP API] Response headers:', {
      'content-type': response.headers.get('content-type'),
      'x-request-id': response.headers.get('x-request-id')
    });

    if (!response.ok) {
      // Try to get error details from response body
      const errorText = await response.text().catch(() => 'Unable to read error body');
      console.error('❌ [CDP API] Token validation FAILED');
      console.error('❌ [CDP API] Status:', response.status);
      console.error('❌ [CDP API] Status Text:', response.statusText);
      console.error('❌ [CDP API] Error body:', errorText);

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired access token'
      });
    }

    const userData = await response.json();
    console.log('✅ [CDP API] Token validation SUCCESS');
    console.log('✅ [CDP API] Response body:', JSON.stringify(userData, null, 2));
    console.log('✅ Token valid, user:', userData.authenticationMethods[0].email);

    // Cache the result
    tokenCache.set(token as string, {
      userId: userData.id,
      expiresAt: Date.now() + CACHE_TTL
    });

    // Add user info to request
    req.userId = userData.id;
    req.userData = userData;

    next();
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token validation failed'
    });
  }
}

// Cleanup expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenCache.entries()) {
    if (data.expiresAt <= now) {
      tokenCache.delete(token);
    }
  }
}, 10 * 60 * 1000);