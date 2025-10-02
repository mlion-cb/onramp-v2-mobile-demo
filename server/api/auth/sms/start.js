import app from '../../../src/app.js';
export default function handler(req, res) {
  req.url = '/auth/sms/start';
  return app(req, res);
}