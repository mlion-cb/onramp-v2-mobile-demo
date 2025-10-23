import app from '../../src/app.js';

export default function handler(req, res) {
  // Preserve query parameters
  req.url = '/balances/evm' + (req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  return app(req, res);
}
