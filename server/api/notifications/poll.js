import app from '../../src/app.js';

export default function handler(req, res) {
  req.url = '/notifications/poll' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  return app(req, res);
}
