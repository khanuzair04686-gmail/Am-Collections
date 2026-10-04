// Verifies admin customer deletion: permanent when there are no orders, soft
// deactivation when order history exists, and that order records survive either way.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const pk = env.split(/\r?\n/).find(l => l.startsWith('ADMIN_PASSKEY=')).slice(14).trim();
const BASE = process.env.BASE || 'http://127.0.0.1:5000';
const H = { 'x-admin-passkey': pk, 'Content-Type': 'application/json' };

let pass = 0, fail = 0;
const t = (n, c, x = '') => { c ? (pass++, console.log('PASS ', n, x)) : (fail++, console.log('FAIL ', n, x)); };

const register = async (name, email) => {
  const r = await fetch(`${BASE}/api/customer/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'QaTest#2026', phone: '9000000001' })
  });
  const j = await r.json();
  return { status: r.status, user: j.user || j.customer || null, raw: j };
};

(async () => {
  const before = await (await fetch(`${BASE}/api/admin/users`, { headers: H })).json();

  // 1. unauthorized deletion must be refused
  const un = await fetch(`${BASE}/api/admin/users/whatever`, { method: 'DELETE' });
  t('unauthorized delete rejected', un.status === 401 || un.status === 403, String(un.status));

  // 2. customer with no orders -> permanent delete
  const a = await register('QA NoOrders', 'qa-noorders@example.test');
  const aId = a.user && a.user.userId;
  t('registered customer A', !!aId, `${a.status} ${aId}`);
  let r = await fetch(`${BASE}/api/admin/users/${aId}`, { method: 'DELETE', headers: H });
  let j = await r.json();
  t('no-order customer permanently deleted', j.mode === 'deleted', `${r.status} ${j.mode}`);
  let list = await (await fetch(`${BASE}/api/admin/users`, { headers: H })).json();
  t('deleted customer gone from list', !list.some(u => u.userId === aId));

  // 3. customer with an order -> soft deactivation, order history preserved
  const b = await register('QA Buyer', 'qa-buyer@example.test');
  const bId = b.user && b.user.userId;
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: bId, customerEmail: 'qa-buyer@example.test', customerName: 'QA Buyer',
      phone: '9000000001', address: 'QA Test Address', city: 'Mumbai', state: 'Maharashtra',
      pincode: '400001', paymentMethod: 'COD', total: 1299,
      items: [{ id: 'amc-06', brand: 'Cartier', model: 'Santos', price: 1299, qty: 1, image: '' }]
    })
  });
  const orderJson = await orderRes.json();
  const orderId = orderJson.orderId || (orderJson.order && orderJson.order.orderId);
  t('test order created', orderRes.status < 300 && !!orderId, `${orderRes.status} ${orderId}`);

  r = await fetch(`${BASE}/api/admin/users/${bId}`, { method: 'DELETE', headers: H });
  j = await r.json();
  t('customer with orders is deactivated, not erased', j.mode === 'deactivated' && j.ordersPreserved >= 1, `${j.mode} kept=${j.ordersPreserved}`);
  list = await (await fetch(`${BASE}/api/admin/users`, { headers: H })).json();
  const bRow = list.find(u => u.userId === bId);
  t('deactivated account still listed with Deleted status', !!bRow && bRow.status === 'Deleted', bRow && bRow.status);
  t('deactivation timestamp recorded', !!(bRow && bRow.deletedAt));

  const orders = await (await fetch(`${BASE}/api/orders`, { headers: H })).json();
  const arr = Array.isArray(orders) ? orders : orders.orders || [];
  t('historical order preserved after deletion', arr.some(o => o.orderId === orderId));

  const login = await fetch(`${BASE}/api/customer/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qa-buyer@example.test', password: 'QaTest#2026' })
  });
  t('deactivated customer cannot log in', login.status === 403, String(login.status));

  // 4. cleanup — remove the test order, then the account becomes permanently deletable
  await fetch(`${BASE}/api/orders/${orderId}`, { method: 'DELETE', headers: H });
  r = await fetch(`${BASE}/api/admin/users/${bId}`, { method: 'DELETE', headers: H });
  j = await r.json();
  t('cleanup: account removed once its order is gone', j.mode === 'deleted', j.mode);

  const after = await (await fetch(`${BASE}/api/admin/users`, { headers: H })).json();
  const afterOrders = await (await fetch(`${BASE}/api/orders`, { headers: H })).json();
  console.log(`\nusers ${before.length} -> ${after.length} | orders ${(Array.isArray(afterOrders) ? afterOrders : afterOrders.orders || []).length}`);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
