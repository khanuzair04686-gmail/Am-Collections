// Probes how price values survive POST and PUT, to locate the ₹0 source.
// Uses throwaway products only and deletes them at the end.
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const BASE = 'http://localhost:5000';

function req(method, urlPath, body, passkey) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(`${BASE}${urlPath}`, { method, headers: {
      'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0,
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

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 25000 });
  const b = await mongoose.connection.collection('brandings').findOne({}, { projection: { adminPasskey: 1 } });
  const key = String(b.adminPasskey || '');
  const col = mongoose.connection.collection('products');
  const ids = [];

  async function probe(label, body) {
    const make = await req('POST', '/api/products', { brand: 'ZZPROBE', model: `probe ${label}`, price: 555, stock: 1 }, key);
    if (make.status !== 201) { console.log(`${label.padEnd(22)} create failed http ${make.status}`); return; }
    const id = JSON.parse(make.text).product.id;
    ids.push(id);
    const created = await col.findOne({ id }, { projection: { price: 1, originalPrice: 1 } });
    const put = await req('PUT', `/api/products/${id}`, body, key);
    const after = await col.findOne({ id }, { projection: { price: 1, originalPrice: 1 } });
    console.log(`${label.padEnd(22)} put=${put.status} price: ${created.price} -> ${JSON.stringify(after.price)} (${typeof after.price}) | mrp ${created.originalPrice} -> ${JSON.stringify(after.originalPrice)}`);
  }

  console.log('create with price 555, then PUT various price inputs:\n');
  await probe('price:""', { price: '' });
  await probe('price:"0"', { price: '0' });
  await probe('price:0', { price: 0 });
  await probe('price:"abc"', { price: 'abc' });
  await probe('price:null', { price: null });
  await probe('price omitted', { tagline: 'untouched price' });
  await probe('price:" 777 "', { price: ' 777 ' });

  const postBlank = await req('POST', '/api/products', { brand: 'ZZPROBE', model: 'probe blank create', price: '' }, key);
  if (postBlank.status === 201) {
    const pid = JSON.parse(postBlank.text).product.id;
    ids.push(pid);
    const doc = await col.findOne({ id: pid }, { projection: { price: 1, originalPrice: 1 } });
    console.log(`\nPOST with blank price  -> saved as price ${doc.price}, originalPrice ${doc.originalPrice} (invented fallback?)`);
  } else {
    console.log(`\nPOST with blank price  -> rejected http ${postBlank.status}`);
  }

  for (const id of ids) await req('DELETE', `/api/products/${id}`, null, key);
  const left = await col.countDocuments({ brand: 'ZZPROBE' });
  console.log(`cleanup: ${left} ZZPROBE rows remaining`);

  await mongoose.disconnect();
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
