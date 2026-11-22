// Orders, delivery options and paid seller contacts against a real WordPress + WooCommerce (after seed.php).
// Needs: wp option update locappci_transfer_number 2250700000099; locappci_contact_fee 2000; locappci_commission_rate 10
const Module = require('module'); const path = require('path'); const OUT = process.env.OUT_DIR || path.join(__dirname, 'out'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(OUT, req.slice(2)); return orig.call(this, req, ...a); };
const assert = require('assert');
const { createHttpApi } = require('@/api/http');
const api = createHttpApi(process.env.API_URL || 'http://127.0.0.1:8098/wp-json/locappci/');
const ID = Object.fromEntries(Object.entries(JSON.parse(process.env.SEED_IDS)).map(([k, v]) => [k, String(v)]));
(async () => {
  assert.strictEqual((await api.getConfig()).contactFee, 2000);
  const p = await api.getProduct(ID.vent16);
  const opts = await api.getDeliveryOptions([p.shopId], 'cocody');
  assert.deepStrictEqual(opts[0].options.map(o => [o.id, o.price, !!o.toConfirm]), [['home', 0, true], ['pickup', 0, false]]);
  const req = (key, extra = {}) => ({
    idempotencyKey: key, paymentMethod: 'wave', deliveryCityId: 'cocody',
    customer: { name: 'Awa Koné', phone: '+44 7700 900123', address: 'Cocody, Riviera 2' },
    lines: [{ productId: ID.vent16, quantity: 1, shownPrice: p.price }],
    deliveries: [{ shopId: p.shopId, optionId: 'home' }], ...extra });
  await assert.rejects(api.createOrder(req('o-bad', { lines: [{ productId: ID.vent16, quantity: 1, shownPrice: 1 }] })), e => e.code === 'cart_changed');
  await assert.rejects(api.createOrder(req('o-cash', { paymentMethod: 'cash' })), e => e.code === 'validation');
  const o = await api.createOrder(req('o-1'));
  assert.ok(/^\d+-wc_order_/.test(o.id) && o.status === 'pending_payment' && o.total === p.price && o.deliveryTotal === 0);
  assert.strictEqual((await api.createOrder(req('o-1'))).id, o.id, 'idempotent');
  assert.strictEqual(o.shops[0].whatsapp, null, 'no seller WhatsApp before payment');
  await assert.rejects(api.getOrder(o.id.replace(/wc_order_.*/, 'wc_order_WRONG')), e => e.code === 'not_found');
  const o2 = await api.submitPaymentReference(o.id, 'MP2611.1234.A5');
  assert.strictEqual(o2.status, 'awaiting_confirmation');
  console.log('ORDER', o.id, o.number);
  // paid contacts
  await assert.rejects(api.createContactUnlock({ idempotencyKey: 'c-x', shopId: '999999', customer: { name: 'Awa', phone: '+447700900123' }, paymentMethod: 'wave' }), e => e.code === 'not_found');
  const u = await api.createContactUnlock({ idempotencyKey: 'c-1', shopId: p.shopId, customer: { name: 'Awa', phone: '+447700900123' }, paymentMethod: 'orange_money' });
  assert.ok(u.status === 'pending_payment' && u.total === 2000 && u.contact === null && u.shopId === p.shopId);
  const u2 = await api.submitContactUnlockReference(u.id, 'OM2611.9999.B7');
  assert.strictEqual(u2.status, 'awaiting_confirmation');
  console.log('UNLOCK', u.id);
  require('fs').writeFileSync('/tmp/e2e-ids.json', JSON.stringify({ order: o.id, unlock: u.id }));
  console.log('PART 1 OK');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
