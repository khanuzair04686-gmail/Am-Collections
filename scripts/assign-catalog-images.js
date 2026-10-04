// Assigns self-hosted product photos (uploads/watch-<id>.jpg) to catalog products,
// then re-reads the API to prove MongoDB kept them. Uses the local .env passkey.
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:5000';
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('ADMIN_PASSKEY='));
const PASSKEY = line ? line.slice(line.indexOf('=') + 1).trim() : '';

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(`${BASE}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
        'x-admin-passkey': PASSKEY,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const list = JSON.parse((await req('GET', '/api/products')).text);
  const assigned = [];
  for (const p of list) {
    const file = path.join(ROOT, 'uploads', `watch-${p.id}.jpg`);
    if (!fs.existsSync(file)) continue;
    const target = `/uploads/watch-${p.id}.jpg`;
    if (p.image === target) { assigned.push({ id: p.id, skipped: 'already assigned' }); continue; }
    const res = await req('PUT', `/api/products/${p.id}`, { imageUrl: target });
    const ok = res.status === 200;
    assigned.push({ id: p.id, ok, status: res.status, note: ok ? '' : res.text.slice(0, 120) });
  }
  assigned.forEach((a) => console.log(JSON.stringify(a)));

  // Re-read from MongoDB and check every served image actually resolves
  const fresh = JSON.parse((await req('GET', '/api/products')).text);
  const report = [];
  for (const p of fresh) {
    const img = p.image || '';
    let status = 'external', bytes = 0;
    if (img.startsWith('/uploads/')) {
      const r = await req('GET', img);
      status = r.status;
      bytes = Buffer.byteLength(r.text);
    } else if (img.startsWith('data:image/svg')) {
      status = 'SVG PLACEHOLDER';
    } else if (img.startsWith('data:image')) {
      status = 'EMBEDDED JPEG';
    }
    report.push({ id: p.id, status, bytes, kind: img.slice(0, 22) });
  }
  console.log('--- VERIFY ---');
  report.forEach((r) => console.log(JSON.stringify(r)));
  const urls = fresh.map((p) => p.image);
  console.log('products', fresh.length, 'unique images', new Set(urls).size,
    'placeholders', report.filter((r) => r.status === 'SVG PLACEHOLDER').length);
})();
