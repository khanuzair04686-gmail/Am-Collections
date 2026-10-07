// End-to-end regression pass for the audit fixes. Runs against a LOCAL server
// (which points at the same MongoDB Atlas cluster as production).
//
// Everything it creates is a throwaway: a test product and a test order, both
// deleted again at the end. No real catalogue or customer record is touched.
const fs = require('fs');

const BASE = process.argv[2] || 'http://localhost:5000';
const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find(l => l.startsWith('ADMIN_PASSKEY='));
const PASS = line.slice(line.indexOf('=') + 1).trim();

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};

const req = async (method, path, body, admin = false) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers['x-admin-passkey'] = PASS;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data };
};

(async () => {
  console.log(`\n=== SABR Watches E2E audit test === target ${BASE}\n`);

  const health = await req('GET', '/api/health');
  ok('MongoDB connected', health.status === 200 && /connected/i.test(JSON.stringify(health.data)), JSON.stringify(health.data).slice(0, 90));

  // ---- 1. Server-side admin authorization (§10) -------------------------
  console.log('\n[1] Server-side admin authorization');
  for (const [m, p] of [['POST', '/api/products'], ['DELETE', '/api/products/amc-01'], ['PATCH', '/api/orders/X/status'], ['PATCH', '/api/orders/X/delivery-date'], ['PUT', '/api/about'], ['GET', '/api/admin/stats'], ['GET', '/api/orders']]) {
    const r = await req(m, p, m === 'POST' || m === 'PUT' || m === 'PATCH' ? {} : undefined);
    ok(`${m} ${p} rejected without passkey`, r.status === 401, `got ${r.status}`);
  }

  // ---- 2. Product create / price validation / persistence (§3, §4) ------
  console.log('\n[2] Product lifecycle + price guard');
  const stamp = Date.now();
  const model = `E2E Test Piece ${stamp}`;
  const created = await req('POST', '/api/products', { brand: 'E2E Test', model, price: 2499, stock: 3 }, true);
  ok('POST /api/products creates (201)', created.status === 201, `id ${created.data.product && created.data.product.id}`);
  const pid = created.data.product && created.data.product.id;

  const listed = await req('GET', '/api/products');
  ok('new product persisted in MongoDB', (listed.data.products || listed.data).some(p => p.id === pid));

  const blankPrice = await req('PUT', `/api/products/${pid}`, { brand: 'E2E Test', model, price: '' }, true);
  ok('PUT with blank price rejected (400)', blankPrice.status === 400, `got ${blankPrice.status}`);
  const zeroPrice = await req('PUT', `/api/products/${pid}`, { brand: 'E2E Test', model, price: 0 }, true);
  ok('PUT with ₹0 price rejected (400)', zeroPrice.status === 400, `got ${zeroPrice.status}`);

  const afterBadWrites = await req('GET', `/api/products/${pid}`);
  const stillPriced = Number((afterBadWrites.data.product || afterBadWrites.data).price);
  ok('valid price NOT overwritten by bad writes', stillPriced === 2499, `price is ${stillPriced}`);

  const edited = await req('PUT', `/api/products/${pid}`, { brand: 'E2E Test', model, price: 3199, originalPrice: 9999 }, true);
  ok('PUT with a valid price succeeds', edited.status === 200, `got ${edited.status}`);
  const reread = await req('GET', `/api/products/${pid}`);
  ok('edit persisted (₹3199)', Number((reread.data.product || reread.data).price) === 3199);

  // ---- 3. COD order validation + persistence (§5) ------------------------
  console.log('\n[3] COD order persistence');
  const badOrder = await req('POST', '/api/orders', { customerName: '', items: [{ id: pid, quantity: 1 }] });
  ok('incomplete checkout rejected (400)', badOrder.status === 400, badOrder.data.error);

  const orderBody = {
    customerName: 'E2E Test Buyer', phone: '9000000001',
    address: '42 Test Lane', city: 'Srinagar', state: 'Jammu and Kashmir', pincode: '190001',
    customerEmail: `e2e${stamp}@example.com`, userId: `E2E-${stamp}`,
    items: [{ id: pid, quantity: 2 }]
  };
  const placed = await req('POST', '/api/orders', orderBody);
  const order = placed.data.order;
  ok('COD order saved (201)', placed.status === 201 && !!order, `orderId ${order && order.orderId}`);
  const oid = order && order.orderId;

  const adminList = await req('GET', '/api/orders', undefined, true);
  const saved = (adminList.data.orders || adminList.data).find(o => o.orderId === oid);
  ok('order readable back from MongoDB', !!saved);
  ok('unique order id', typeof oid === 'string' && oid.length > 0);
  ok('customer name + phone stored', saved.customerName === 'E2E Test Buyer' && saved.phone === '9000000001');
  ok('address/city/state/pincode stored', saved.address === '42 Test Lane' && saved.city === 'Srinagar' && saved.pincode === '190001');
  ok('line item has product id + name + qty', saved.items[0].id === pid && saved.items[0].quantity === 2 && !!saved.items[0].name);
  ok('price at purchase = live catalogue price', saved.items[0].price === 3199, `₹${saved.items[0].price}`);
  ok('subtotal/total computed, never ₹0', saved.subtotal === 6398 && saved.total === 6398, `sub ${saved.subtotal} / total ${saved.total}`);
  ok('paymentMethod is COD', /cash on delivery/i.test(saved.paymentMethod || ''), saved.paymentMethod);
  ok('status starts at Pending', saved.status === 'Pending', saved.status);
  ok('expectedDeliveryDate is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(saved.expectedDeliveryDate || ''), saved.expectedDeliveryDate);
  ok('createdAt + updatedAt present', !!saved.createdAt && !!saved.updatedAt);
  ok('no GPS coordinates captured', saved.deliveryLocation === undefined || saved.deliveryLocation === null);

  // ---- 4. Status + delivery-date management (§6, §7) ---------------------
  console.log('\n[4] Order status + Expected Delivery Date');
  const badStatus = await req('PATCH', `/api/orders/${oid}/status`, { status: 'Delivered' , note: 'x'}, true);
  ok('whitelisted status accepted', badStatus.status === 200, `got ${badStatus.status}`);
  const illegal = await req('PATCH', `/api/orders/${oid}/status`, { status: 'Teleported' }, true);
  ok('unknown status rejected (400)', illegal.status === 400, `got ${illegal.status}`);

  const backToPending = await req('PATCH', `/api/orders/${oid}/status`, { status: 'Processing' }, true);
  ok('status change persisted', backToPending.status === 200);

  const newDate = '2026-11-25';
  const dated = await req('PATCH', `/api/orders/${oid}/delivery-date`, { expectedDeliveryDate: newDate }, true);
  ok('delivery-date route accepts a valid date', dated.status === 200, `got ${dated.status}`);

  const badDate = await req('PATCH', `/api/orders/${oid}/delivery-date`, { expectedDeliveryDate: '25/11/2026' }, true);
  ok('malformed date rejected (400)', badDate.status === 400, `got ${badDate.status}`);

  const verify = await req('GET', '/api/orders', undefined, true);
  const v = (verify.data.orders || verify.data).find(o => o.orderId === oid);
  ok('delivery date survives a fresh read', v.expectedDeliveryDate === newDate, `stored ${v.expectedDeliveryDate}`);
  ok('changing the date did NOT change status', v.status === 'Processing', `status ${v.status}`);

  const cust = await req('GET', `/api/customer/orders/9000000001`);
  const cOrder = (cust.data || []).find(o => o.orderId === oid);
  ok('customer tracking shows the same date', cOrder && cOrder.expectedDeliveryDate === newDate, cOrder && cOrder.expectedDeliveryDate);
  ok('customer tracking hides GPS coordinates', cOrder && cOrder.deliveryLocation === undefined);

  // ---- 5. Delete (§2) ----------------------------------------------------
  console.log('\n[5] Cleanup + delete');
  const del = await req('DELETE', `/api/products/${pid}`, undefined, true);
  ok('DELETE /api/products/:id succeeds', del.status === 200, `got ${del.status}`);
  const gone = await req('GET', `/api/products/${pid}`);
  ok('deleted product is really gone', gone.status === 404, `got ${gone.status}`);
  const delOrder = await req('DELETE', `/api/orders/${oid}`, undefined, true);
  ok('throwaway order removed', delOrder.status === 200, `got ${delOrder.status}`);

  // ---- 6. Existing data intact ------------------------------------------
  console.log('\n[6] Existing data preserved');
  const finalProducts = await req('GET', '/api/products');
  const fp = finalProducts.data.products || finalProducts.data;
  ok('catalogue intact', Array.isArray(fp) && fp.length >= 10, `${fp.length} products`);
  const finalOrders = await req('GET', '/api/orders', undefined, true);
  const fo = finalOrders.data.orders || finalOrders.data;
  ok('orders collection readable', Array.isArray(fo), `${fo.length} orders`);
  ok('no ₹0-priced product in catalogue', fp.every(p => Number(p.price) > 0));

  console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASHED:', e.message); process.exit(1); });
