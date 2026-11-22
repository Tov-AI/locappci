// Owner's dashboard against a real WordPress. Run after: reset, options, orders.test.js (a payment and a contact
// unlock waiting), sellers.test.js 1 (a seller request waiting), and `wp user meta update <uk> _locappci_app_manager 1`.
const Module = require('module'); const path = require('path'); const OUT = process.env.OUT_DIR || path.join(__dirname, 'out'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(OUT, req.slice(2)); return orig.call(this, req, ...a); };
const assert = require('assert');
const { createHttpApi } = require('@/api/http');
const { setSessionToken } = require('@/api/token');
const api = createHttpApi(process.env.API_URL || 'http://127.0.0.1:8098/wp-json/locappci/');
(async () => {
  // a normal customer: refused, and no « manager » flag on the account
  const awa = await api.login({ identifier: 'awa@example.com', password: 'site-pass-1' });
  assert.strictEqual(awa.account.manager, undefined);
  setSessionToken(awa.token);
  await assert.rejects(api.getManagerDashboard(), e => e.code === 'validation' && /propriétaire/.test(e.message));
  // the owner's account
  const uk = await api.login({ identifier: 'uk@example.com', password: 'uk-pass-1234' });
  assert.strictEqual(uk.account.manager, true);
  setSessionToken(uk.token);
  let d = await api.getManagerDashboard();
  assert.deepStrictEqual(d.toValidate, { payments: 2, sellers: 1, articles: 0, reports: 0 });
  assert.ok(d.totals.buyers >= 1 && d.week.sales.count === 0);
  const q = await api.getManagerQueue();
  assert.deepStrictEqual(q.payments.map(p => p.kind).sort(), ['contact', 'order']);
  const order = q.payments.find(p => p.kind === 'order'); const unlock = q.payments.find(p => p.kind === 'contact');
  assert.ok(order.reference === 'MP2611.1234.A5' && order.total === 18500 && order.customerName === 'Awa Koné');
  assert.ok(/Coordonnées/.test(unlock.label) && unlock.total === 2000);
  const req = q.sellers[0];
  assert.deepStrictEqual([req.shopName, req.commune, req.cityId, req.hasPhoto, /^\d{4}$/.test(req.verifyCode)], ['Awa Pagnes Wax', 'Cocody', 'cocody', true, true]);
  const photo = await api.getSellerPhoto(req.id); assert.ok(photo.base64.length > 20 && photo.mime === 'image/png');
  // decisions
  await api.decidePayment(order.id, { decision: 'approve' });
  await assert.rejects(api.decidePayment(order.id, { decision: 'approve' }), e => /déjà/.test(e.message), 'once only');
  await api.decidePayment(unlock.id, { decision: 'refuse' });
  assert.strictEqual((await api.decideSeller(req.id, { decision: 'approve' })).message, 'Boutique validée.');
  await assert.rejects(api.getSellerPhoto(req.id), e => e.code === 'not_found', 'photo deleted after the decision');
  d = await api.getManagerDashboard();
  assert.deepStrictEqual(d.toValidate, { payments: 0, sellers: 0, articles: 0, reports: 0 });
  assert.deepStrictEqual([d.week.sales.count, d.week.sales.total, d.week.sales.commission, d.week.earnings, d.week.contacts.count], [1, 18500, 1850, 1850, 0]);
  assert.ok(d.week.newShops >= 1, 'the shop just validated');
  // the buyer side sees it
  setSessionToken(awa.token);
  assert.strictEqual((await api.getSellerApplication()).status, 'approved');
  console.log('MANAGER OK');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
