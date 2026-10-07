// End-to-end check of the admin Delete path against the real MongoDB, using a
// throwaway product only. Also reports product names that would break the inline
// onclick handler in the admin watches table.
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const BASE = 'http://localhost:5000';

function req(method, urlPath, body, passkey) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${urlPath}`, { method, headers: {
      'Content-Type': 'application/json',
      'Content-Length': data ? Buffer.byteLength(data) : 0,
      ...(passkey ? { 'x-admin-passkey': passkey } : {}) } }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(c).toString('utf8') }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} | ${n}${extra ? ' | ' + extra : ''}`); ok ? pass++ : fail++; };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 25000 });
  const brand = await mongoose.connection.collection('brandings').findOne({}, { projection: { adminPasskey: 1 } });
  const key = String(brand.adminPasskey || '');
  await mongoose.disconnect();

  const before = JSON.parse((await req('GET', '/api/products')).text);
  const beforeCount = before.length;
  console.log(`catalog before: ${beforeCount} products`);

  const broken = before.filter((p) => /['"`\\]/.test(`${p.brand} ${p.model}`));
  console.log(`products whose brand/model contain a quote or backslash (these break the inline onclick): ${broken.length}`);
  broken.forEach((p) => console.log('   ->', JSON.stringify(`${p.brand} ${p.model}`)));

  const zero = before.filter((p) => !(typeof p.price === 'number' && p.price > 0));
  console.log(`products with missing/zero price: ${zero.length}`, zero.map((p) => `${p.id}:${p.price}`).join(' '));

  // Create a throwaway product, then delete it through the same route the button uses
  const make = await req('POST', '/api/products', {
    brand: 'ZZTEST', model: 'Delete Me Please', price: 111, originalPrice: 222, stock: 1,
  }, key);
  check('POST creates a product', make.status === 201, `http ${make.status}`);
  const created = JSON.parse(make.text).product;
  const id = created && created.id;
  console.log(`   throwaway id: ${id}`);

  const mid = JSON.parse((await req('GET', '/api/products')).text);
  check('throwaway is present in the API before delete', mid.some((p) => p.id === id));

  const unauth = await req('DELETE', `/api/products/${id}`);
  check('DELETE without passkey is refused', unauth.status === 401, `http ${unauth.status}`);

  const stillThere = JSON.parse((await req('GET', '/api/products')).text);
  check('refused DELETE did not remove the product', stillThere.some((p) => p.id === id));

  const del = await req('DELETE', `/api/products/${id}`, null, key);
  check('DELETE with passkey succeeds', del.status === 200, `http ${del.status} ${del.text.slice(0, 60)}`);

  const after = JSON.parse((await req('GET', '/api/products')).text);
  check('deleted product is gone from the API', !after.some((p) => p.id === id));
  check('catalog count back to the original', after.length === beforeCount, `${after.length} vs ${beforeCount}`);

  const again = await req('DELETE', `/api/products/${id}`, null, key);
  check('second delete reports 404, not a crash', again.status === 404, `http ${again.status}`);

  const ids = new Set(after.map((p) => p.id));
  check('no unrelated product was touched', before.every((p) => ids.has(p.id)));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
