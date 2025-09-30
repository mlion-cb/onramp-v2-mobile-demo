import app from '../src/app';

export default function handler(req, res) {
  if (req.url && req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '') || '/';
  }
  return app(req, res);
}