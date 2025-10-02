import app from '../../../src/app.js';
export default function handler(req, res) {
  req.url = '/auth/sms/verify';
  return app(req, res);
}