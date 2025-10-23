import app from '../../src/app.js';

export default function handler(req, res) {
  req.url = '/webhooks/onramp';
  return app(req, res);
}
