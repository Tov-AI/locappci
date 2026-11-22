// « Mes articles » against a real WordPress (after seed.php and sellers.test.js 1 + approve for awa@example.com).
const Module = require('module'); const path = require('path'); const OUT = process.env.OUT_DIR || path.join(__dirname, 'out'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(OUT, req.slice(2)); return orig.call(this, req, ...a); };
const assert = require('assert');
const { createHttpApi } = require('@/api/http');
const { setSessionToken } = require('@/api/token');
const api = createHttpApi(process.env.API_URL || 'http://127.0.0.1:8098/wp-json/locappci/');
const photo = require('fs').readFileSync('/tmp/id.b64', 'utf8');
const fs = require('fs');
(async () => {
  const part = process.argv[2] || '1';
  if (part === 'notseller') {
    const s = await api.login({ identifier: 'uk@example.com', password: 'uk-pass-1234' }); setSessionToken(s.token);
    await assert.rejects(api.listSellerProducts(), e => e.code === 'validation' && /validée/.test(e.message));
    return console.log('NOT SELLER OK');
  }
  const s = await api.login({ identifier: 'awa@example.com', password: 'site-pass-1' }); setSessionToken(s.token);
  const cat = (await api.listCategories('vente'))[0].id;
  if (part === '1') {
    assert.deepStrictEqual(await api.listSellerProducts(), []);
    await assert.rejects(api.createSellerProduct({ name: 'Pa', price: 5000, categoryId: cat, photos: [photo] }), e => /nom/.test(e.message), 'name too short');
    await assert.rejects(api.createSellerProduct({ name: 'Pagne wax 6 yards', price: 50, categoryId: cat, photos: [photo] }), e => /Prix/.test(e.message));
    await assert.rejects(api.createSellerProduct({ name: 'Pagne wax 6 yards', price: 5000, categoryId: cat, photos: [] }), e => /photos/.test(e.message));
    await assert.rejects(api.createSellerProduct({ name: 'Pagne wax 6 yards', price: 5000, categoryId: cat, photos: ['bm9wZQ=='] }), e => /illisible/.test(e.message));
    const p = await api.createSellerProduct({ name: 'Pagne wax 6 yards', price: 5000, categoryId: cat, description: 'Coton.\nNeuf.', stockQuantity: 3, photos: [photo, photo] });
    assert.deepStrictEqual([p.status, p.price, p.stockQuantity, p.photos.length, p.description], ['pending', 5000, 3, 2, 'Coton.\nNeuf.']);
    assert.strictEqual((await api.listProducts({ search: 'Pagne wax 6' })).total, 0, 'not public before validation');
    fs.writeFileSync('/tmp/sp.json', JSON.stringify({ id: p.id }));
    console.log('SELLER PRODUCTS PART 1 OK', p.id);
  } else {
    const { id } = JSON.parse(fs.readFileSync('/tmp/sp.json', 'utf8'));
    const pub = await api.listProducts({ search: 'Pagne wax 6' });
    assert.strictEqual(pub.total, 1, 'public once validated');
    let p = await api.updateSellerProduct(id, { price: 4500, stockQuantity: 2 });
    assert.deepStrictEqual([p.status, p.price, p.stockQuantity], ['approved', 4500, 2], 'price and stock: no new check');
    assert.strictEqual((await api.getProduct(id)).price, 4500);
    p = await api.updateSellerProduct(id, { name: 'Pagne wax 6 yards bleu' });
    assert.strictEqual(p.status, 'pending', 'new name: checked again');
    assert.strictEqual((await api.listProducts({ search: 'Pagne wax 6' })).total, 0);
    p = await api.updateSellerProduct(id, { hidden: true });
    assert.strictEqual(p.status, 'hidden');
    await assert.rejects(api.updateSellerProduct('11', { price: 1 }), e => e.code === 'not_found' || e.code === 'validation', "someone else's product");
    await assert.rejects(api.updateSellerProduct('11', { price: 1000 }), e => e.code === 'not_found', "someone else's product");
    console.log('SELLER PRODUCTS PART 2 OK');
  }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
