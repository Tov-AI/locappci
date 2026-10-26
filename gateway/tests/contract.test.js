const Module = require('module'); const path = require('path'); const OUT = process.env.OUT_DIR || path.join(__dirname, 'out'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(OUT, req.slice(2)); return orig.call(this, req, ...a); };
const assert = require('assert');
const { createHttpApi } = require('@/api/http');
const api = createHttpApi(process.env.API_URL || 'http://127.0.0.1:8098/wp-json/locappci/');
const isStr = (v) => typeof v === 'string', isInt = (v) => Number.isInteger(v);
const checkSummary = (s) => {
  assert.deepStrictEqual(Object.keys(s).sort(), ['categoryId','cityId','coverUrl','id','name','price','shopName','stockStatus','universe']);
  assert.ok(isStr(s.id) && ['vente','location'].includes(s.universe) && isInt(s.price) && isStr(s.cityId));
  assert.ok(s.universe === 'location' ? s.stockStatus === null : ['in_stock','low_stock','out_of_stock'].includes(s.stockStatus));
};
(async () => {
  const cities = await api.listCities(); assert.ok(cities.length >= 7 && cities.every(c => isStr(c.id) && isStr(c.name)));
  const cats = await api.listCategories(); assert.ok(cats.every(c => isStr(c.id) && (c.parentId === null || isStr(c.parentId))));
  let page = await api.listProducts({}); page.items.forEach(checkSummary);
  assert.strictEqual(page.total, 5); assert.ok(!page.items.some(i => i.name === 'Produit caché'));
  console.log('list all:', page.items.map(i => i.name).join(' | '));
  assert.deepStrictEqual((await api.listProducts({ universe: 'location' })).items.map(i => i.id), ['14']);
  assert.strictEqual((await api.listProducts({ universe: 'vente' })).total, 4);
  const elec = cats.find(c => c.name === 'Électroménager').id;
  assert.strictEqual((await api.listProducts({ categoryId: elec })).total, 4, 'parent includes children');
  assert.deepStrictEqual((await api.listProducts({ search: 'ventilateur' })).items.map(i => i.id), ['10']);
  assert.deepStrictEqual((await api.listProducts({ minPrice: 13000, maxPrice: 20000, universe: 'vente' })).items.map(i => i.price).sort(), [15000, 18500]);
  const asc = (await api.listProducts({ sort: 'price_asc', universe: 'vente' })).items.map(i => i.price); assert.deepStrictEqual(asc, [...asc].sort((a, b) => a - b));
  const near = (await api.listProducts({ cityId: 'cocody', sort: 'nearest' })).items; console.log('nearest cocody:', near.map(i => i.cityId).join(','));
  assert.ok(near[0].cityId === 'cocody' && near[1].cityId === 'cocody' && near.slice(2).every(i => i.cityId !== 'cocody'));
  // pagination across the two parts
  const p1 = await api.listProducts({ cityId: 'cocody', sort: 'nearest', page: 1, pageSize: 3 });
  const p2 = await api.listProducts({ cityId: 'cocody', sort: 'nearest', page: 2, pageSize: 3 });
  const both = [...p1.items, ...p2.items].map(i => i.id);
  assert.deepStrictEqual([p1.hasMore, p2.hasMore, p1.total, new Set(both).size], [true, false, 5, 5]);
  assert.deepStrictEqual(both, near.map(i => i.id));
  assert.deepStrictEqual((await api.listProducts({ ids: ['13', '10', '999'] })).items.map(i => i.id), ['13', '10']);
  // detail
  const sale = await api.getProduct('10');
  assert.ok(sale.universe === 'vente' && sale.price === 18500 && sale.stock.status === 'in_stock' && sale.stock.quantity === 4);
  assert.ok(!/</.test(sale.description) && /&/.test(sale.description), 'plain text description');
  assert.ok(/^https?:\/\//.test(sale.webUrl) && /T.*Z$/.test(sale.updatedAt));
  const rent = await api.getProduct('14');
  assert.deepStrictEqual([rent.universe, rent.pricePerDay, rent.deposit, rent.minDays, rent.maxDays], ['location', 15000, 50000, 1, 30]);
  await assert.rejects(api.getProduct('15'), e => e.code === 'not_found', 'hidden product');
  await assert.rejects(api.getProduct('99999'), e => e.code === 'not_found' && /plus disponible/.test(e.message));
  // shop
  const shop = await api.getShop(sale.shopId);
  assert.deepStrictEqual([shop.name, shop.initials, shop.cityId, shop.whatsapp, shop.role], ['Boutique Koné Électro', 'BK', 'yopougon', '2250700000001', 'vendeur']);
  const loueur = await api.getShop(rent.shopId); assert.deepStrictEqual([loueur.role, loueur.whatsapp], ['loueur', null]);
  assert.strictEqual((await api.getShop((await api.getProduct('13')).shopId)).whatsapp, '2250700000002');
  // stock + cart
  let c = await api.checkStock('10', 18500); assert.deepStrictEqual([c.available, c.priceChanged], [true, false]);
  c = await api.checkStock('12', 12000); assert.strictEqual(c.available, false);
  c = await api.checkStock('10', 17000); assert.strictEqual(c.priceChanged, true);
  const today = new Date().toISOString().slice(0, 10);
  const cart = await api.checkCart([
    { productId: '10', quantity: 2, shownPrice: 18500 },
    { productId: '11', quantity: 5, shownPrice: 185000 },
    { productId: '12', quantity: 1, shownPrice: 12000 },
    { productId: '999', quantity: 1, shownPrice: 1 },
    { productId: '14', rental: { startDate: today, days: 3, shownPricePerDay: 15000 } },
    { productId: '14', rental: { startDate: '2020-01-01', days: 3, shownPricePerDay: 15000 } },
    { productId: '14', rental: { startDate: today, days: 40, shownPricePerDay: 15000 } },
  ]);
  assert.deepStrictEqual(cart.lines.map(l => l.problem ?? 'ok'), ['ok', 'not_enough_stock', 'out_of_stock', 'gone', 'ok', 'invalid_dates', 'invalid_dates']);
  assert.strictEqual(cart.lines[1].maxQuantity, 2); assert.strictEqual(cart.lines[4].deposit, 50000);
  console.log('ALL GATEWAY CONTRACT TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
