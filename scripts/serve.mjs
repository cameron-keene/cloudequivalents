// Local preview for dist/. Honors site.config.json baseUrl path prefix (GitHub project Pages).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist'); const port = Number(process.argv[2] || 4173);
const config = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
let PREFIX = '';
try {
  const pathname = new URL(config.baseUrl.replace(/\/$/, '') + '/').pathname.replace(/\/$/, '');
  PREFIX = pathname === '/' ? '' : pathname;
} catch {}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (PREFIX && (p === PREFIX || p.startsWith(PREFIX + '/'))) p = p.slice(PREFIX.length) || '/';
  let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { location: (PREFIX + p + '/').replace(/\/+/g, '/') }); return res.end(); }
    f = path.join(f, 'index.html');
  }
  if (!fs.existsSync(f)) {
    // Convenience: redirect bare / to prefixed home when a prefix is configured.
    if (p === '/' && PREFIX) { res.writeHead(302, { location: PREFIX + '/' }); return res.end(); }
    res.writeHead(404, { 'content-type': types['.html'] }); return res.end(fs.readFileSync(path.join(root, '404.html')));
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`Preview: http://localhost:${port}${PREFIX}/`));
