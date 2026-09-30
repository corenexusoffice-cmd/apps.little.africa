// server.js — tiny adapter that runs the Vercel-style /api functions
// as a normal Node HTTP server on Render (or any Node host).
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

const PORT = process.env.PORT || 3000;
const API_DIR = path.join(__dirname, 'api');

// Load all handlers from /api/*.js (skip _lib and subfolders)
const handlers = {};
for (const file of fs.readdirSync(API_DIR)) {
  if (!file.endsWith('.js')) continue;
  const name = file.replace(/\.js$/, '');
  try {
    handlers[name] = require(path.join(API_DIR, file));
  } catch (e) {
    console.error('Failed to load api/' + file, e);
  }
}
console.log('Loaded API handlers:', Object.keys(handlers).join(', '));

// Serve static files (HTML, CSS, JS, images)
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/index.html';
  // cleanUrls: try /foo → /foo.html
  let filePath = path.join(__dirname, p);
  if (!filePath.startsWith(__dirname)) { res.statusCode = 403; return res.end('Forbidden'); }
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) filePath += '.html';
  if (!fs.existsSync(filePath)) { res.statusCode = 404; return res.end('Not found'); }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  if (ext === '.webp' || ext === '.png' || ext === '.jpg' || ext === '.svg' || ext === '.woff' || ext === '.woff2') {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  const match = u.pathname.match(/^\/api\/([a-zA-Z0-9_-]+)\/?$/);

  if (match) {
    const name = match[1];
    const handler = handlers[name];
    if (!handler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Unknown API: ' + name }));
    }
    // Attach query so handlers can read req.query
    req.query = u.query;
    try {
      await handler(req, res);
    } catch (e) {
      console.error('Handler error in /api/' + name, e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    }
    return;
  }

  // Static file
  serveStatic(req, res);
});

server.listen(PORT, () => console.log('Afropiano server running on port ' + PORT));
