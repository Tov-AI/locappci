// « Devenir vendeur » against a real WordPress (after seed.php). Part 1: request; part 2 (after the owner validates): approved.
const Module = require('module'); const path = require('path'); const OUT = process.env.OUT_DIR || path.join(__dirname, 'out'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(OUT, req.slice(2)); return orig.call(this, req, ...a); };
const assert = require('assert');
const { createHttpApi } = require('@/api/http');
const { setSessionToken } = require('@/api/token');
const api = createHttpApi(process.env.API_URL || 'http://127.0.0.1:8098/wp-json/locappci/');
const photo = require('fs').readFileSync('/tmp/id.b64', 'utf8');
(async () => {
  const part = process.argv[2] || '1';
  await assert.rejects(api.getSellerApplication(), e => e.code === 'unauthorized', 'signed in only');
  const s = await api.login(process.env.LOGIN ? JSON.parse(process.env.LOGIN) : { identifier: 'awa@example.com', password: 'site-pass-1' });
  setSessionToken(s.token);
  if (part === '1') {
    assert.strictEqual((await api.getSellerApplication()).status, 'none');
    const base = { shopName: 'Awa Pagnes', cityId: 'cocody', whatsapp: '+225 07 08 09 10 11', description: 'Pagnes wax' };
    await assert.rejects(api.sendSellerApplication(base), e => e.code === 'validation' && /pièce/.test(e.message), 'photo required');
    await assert.rejects(api.sendSellerApplication({ ...base, idPhoto: 'bm90IGFuIGltYWdl' }), e => /illisible/.test(e.message), 'not an image');
    await assert.rejects(api.sendSellerApplication({ ...base, cityId: 'paris', idPhoto: photo }), e => /commune/.test(e.message));
    const a = await api.sendSellerApplication({ ...base, idPhoto: photo });
    assert.deepStrictEqual([a.status, a.shopName, a.cityId, a.whatsapp], ['pending', 'Awa Pagnes', 'cocody', '2250708091011']);
    assert.ok(/^\d{4}$/.test(a.verifyCode));
    const b = await api.sendSellerApplication({ ...base, shopName: 'Awa Pagnes Wax' });
    assert.deepStrictEqual([b.status, b.shopName, b.verifyCode], ['pending', 'Awa Pagnes Wax', a.verifyCode], 'correct without a new photo, same code');
    console.log('SELLERS PART 1 OK');
  } else {
    const a = await api.getSellerApplication();
    assert.deepStrictEqual([a.status, a.verifyCode], [part === 'refused' ? 'refused' : 'approved', null]);
    if (part === 'refused') assert.strictEqual(a.refusalReason, 'Photo floue');
    console.log('SELLERS PART ' + part + ' OK');
  }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
