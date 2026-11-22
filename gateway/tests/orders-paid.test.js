// After the team set both orders « En cours » (wp eval): the app sees « payée » and the seller's WhatsApp.
const Module = require('module'); const path = require('path'); const OUT = process.env.OUT_DIR || path.join(__dirname, 'out'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(OUT, req.slice(2)); return orig.call(this, req, ...a); };
const assert = require('assert');
const { createHttpApi } = require('@/api/http');
const api = createHttpApi(process.env.API_URL || 'http://127.0.0.1:8098/wp-json/locappci/');
const ids = JSON.parse(require('fs').readFileSync('/tmp/e2e-ids.json', 'utf8'));
(async () => {
  const o = await api.getOrder(ids.order);
  assert.deepStrictEqual([o.status, o.step, o.shops[0].whatsapp], ['paid', 'preparing', '2250700000001']);
  const u = await api.getContactUnlock(ids.unlock);
  assert.deepStrictEqual([u.status, u.contact], ['paid', { whatsapp: '2250700000001' }]);
  await assert.rejects(api.getContactUnlock(ids.order), e => e.code === 'not_found', 'an order is not an unlock');
  console.log('PART 2 OK');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
