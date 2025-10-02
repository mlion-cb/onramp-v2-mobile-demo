import app from '../../src/app.js';
export default function handler(req, res) {
  req.url = '/server/api';           // your Express route
  return app(req, res);
}