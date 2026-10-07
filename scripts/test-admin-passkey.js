// Verifies the admin passkey fix without changing the real key: reads the stored
// passkey from MongoDB, proves /api/auth/verify now accepts it (previously the ENV
// value won and the stored one never worked), and proves a no-op change round-trip
// leaves the stored value untouched. Nothing sensitive is printed.
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

const BASE = 'http://localhost:5000';

function post(urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE}${urlPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const col = mongoose.connection.collection('brandings');
  const before = await col.findOne({}, { projection: { adminPasskey: 1, storeName: 1 } });
  const stored = before.adminPasskey || '';
  const envKey = process.env.ADMIN_PASSKEY || '';
  console.log(`stored passkey: ${stored.length} chars, env passkey: ${envKey.length} chars, active doc storeName: ${before.storeName}`);

  const r1 = await post('/api/auth/verify', { passkey: stored });
  check('verify accepts the passkey saved by Change Passkey', r1.status === 200, `http ${r1.status}`);

  const r2 = await post('/api/auth/verify', { passkey: stored + '  ' });
  check('verify ignores a trailing space (typed vs pasted)', r2.status === 200, `http ${r2.status}`);

  const r3 = await post('/api/auth/verify', { passkey: 'definitely-not-the-passkey' });
  check('verify rejects a wrong passkey', r3.status === 401, `http ${r3.status}`);

  const r4 = await post('/api/auth/change-passkey', { currentPasskey: stored, newPasskey: stored }, { 'x-admin-passkey': stored });
  check('change-passkey accepts the stored current passkey', r4.status === 200 && /success/.test(r4.text), `http ${r4.status}`);

  const r5 = await post('/api/auth/change-passkey', { currentPasskey: 'wrong-one', newPasskey: 'zzzz9999' }, { 'x-admin-passkey': stored });
  check('change-passkey rejects a wrong current passkey', r5.status === 401, `http ${r5.status}`);

  const r6 = await post('/api/auth/change-passkey', { currentPasskey: stored, newPasskey: 'abc' }, { 'x-admin-passkey': stored });
  check('change-passkey rejects a passkey shorter than 4', r6.status === 400, `http ${r6.status}`);

  const r7 = await post('/api/auth/change-passkey', { currentPasskey: stored, newPasskey: stored });
  check('change-passkey is unreachable without the header', r7.status === 401, `http ${r7.status}`);

  const after = await col.findOne({}, { projection: { adminPasskey: 1 } });
  check('stored passkey unchanged after the tests', after.adminPasskey === stored);

  const settings = await new Promise((resolve) => {
    http.get(`${BASE}/api/settings`, (res) => {
      const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve(Buffer.concat(c).toString('utf8')));
    });
  });
  check('settings response never leaks the passkey', !settings.includes(stored) && !/"adminPasskey"/.test(settings));

  console.log(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
