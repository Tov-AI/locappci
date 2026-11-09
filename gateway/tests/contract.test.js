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
// Product ids printed by seed.php (pass them as SEED_IDS when they differ from a first install).
const ID = Object.fromEntries(Object.entries(JSON.parse(process.env.SEED_IDS || '{"vent16":10,"clim":11,"mix":12,"pagne":13,"groupe":14,"hidden":15,"song":16,"chaises":17,"tente":18}')).map(([k, v]) => [k, String(v)]));
(async () => {
  const cities = await api.listCities(); assert.ok(cities.length >= 7 && cities.every(c => isStr(c.id) && isStr(c.name)));
  const cats = await api.listCategories(); assert.ok(cats.every(c => isStr(c.id) && (c.parentId === null || isStr(c.parentId))));
  let page = await api.listProducts({}); page.items.forEach(checkSummary);
  assert.strictEqual(page.total, 7); assert.ok(!page.items.some(i => i.name === 'Produit caché'));
  console.log('list all:', page.items.map(i => i.name).join(' | '));
  assert.ok((await api.listProducts({ universe: 'location' })).items.some(i => i.id === ID.groupe), 'RnB rental type still counts');
  assert.strictEqual((await api.listProducts({ universe: 'vente' })).total, 4);
  const elec = cats.find(c => c.name === 'Électroménager').id;
  assert.strictEqual((await api.listProducts({ categoryId: elec })).total, 4, 'parent includes children');
  assert.deepStrictEqual((await api.listProducts({ search: 'ventilateur' })).items.map(i => i.id), [ID.vent16]);
  assert.deepStrictEqual((await api.listProducts({ minPrice: 13000, maxPrice: 20000, universe: 'vente' })).items.map(i => i.price).sort(), [15000, 18500]);
  const asc = (await api.listProducts({ sort: 'price_asc', universe: 'vente' })).items.map(i => i.price); assert.deepStrictEqual(asc, [...asc].sort((a, b) => a - b));
  const near = (await api.listProducts({ cityId: 'cocody', sort: 'nearest' })).items; console.log('nearest cocody:', near.map(i => i.cityId).join(','));
  assert.ok(near[0].cityId === 'cocody' && near[1].cityId === 'cocody' && near.slice(2).every(i => i.cityId !== 'cocody'));
  // pagination across the two parts
  const p1 = await api.listProducts({ cityId: 'cocody', sort: 'nearest', page: 1, pageSize: 4 });
  const p2 = await api.listProducts({ cityId: 'cocody', sort: 'nearest', page: 2, pageSize: 4 });
  const both = [...p1.items, ...p2.items].map(i => i.id);
  assert.deepStrictEqual([p1.hasMore, p2.hasMore, p1.total, new Set(both).size], [true, false, 7, 7]);
  assert.deepStrictEqual(both, near.map(i => i.id));
  assert.deepStrictEqual((await api.listProducts({ ids: [ID.pagne, ID.vent16, '999'] })).items.map(i => i.id), [ID.pagne, ID.vent16]);
  // detail
  const sale = await api.getProduct(ID.vent16);
  assert.ok(sale.universe === 'vente' && sale.price === 18500 && sale.stock.status === 'in_stock' && sale.stock.quantity === 4);
  assert.ok(!/</.test(sale.description) && /&/.test(sale.description), 'plain text description');
  assert.ok(/^https?:\/\//.test(sale.webUrl) && /T.*Z$/.test(sale.updatedAt));
  const rent = await api.getProduct(ID.groupe);
  assert.deepStrictEqual([rent.universe, rent.pricePerDay, rent.deposit, rent.minDays, rent.maxDays], ['location', 15000, 50000, 1, 30]);
  await assert.rejects(api.getProduct(ID.hidden), e => e.code === 'not_found', 'hidden product');
  assert.strictEqual((await api.listProducts({ search: 'Chanson' })).total, 0, 'downloads are not listed');
  await assert.rejects(api.getProduct(ID.song), e => e.code === 'not_found', 'download detail');
  await assert.rejects(api.getProduct('99999'), e => e.code === 'not_found' && /plus disponible/.test(e.message));
  // shop
  const shop = await api.getShop(sale.shopId);
  assert.deepStrictEqual([shop.name, shop.initials, shop.cityId, shop.whatsapp, shop.role], ['Boutique Koné Électro', 'BK', 'yopougon', '2250700000001', 'vendeur']);
  const loueur = await api.getShop(rent.shopId); assert.deepStrictEqual([loueur.role, loueur.whatsapp], ['loueur', null]);
  assert.strictEqual((await api.getShop((await api.getProduct(ID.pagne)).shopId)).whatsapp, '2250700000002');
  // stock + cart
  let c = await api.checkStock(ID.vent16, 18500); assert.deepStrictEqual([c.available, c.priceChanged], [true, false]);
  c = await api.checkStock(ID.mix, 12000); assert.strictEqual(c.available, false);
  c = await api.checkStock(ID.vent16, 17000); assert.strictEqual(c.priceChanged, true);
  const cart = await api.checkCart([
    { productId: ID.vent16, quantity: 2, shownPrice: 18500 },
    { productId: ID.clim, quantity: 5, shownPrice: 185000 },
    { productId: ID.mix, quantity: 1, shownPrice: 12000 },
    { productId: '999', quantity: 1, shownPrice: 1 },
    { productId: ID.groupe, quantity: 1, shownPrice: 15000 },
    { productId: ID.chaises, quantity: 1, shownPrice: 5000 },
  ]);
  assert.deepStrictEqual(cart.lines.map(l => l.problem ?? 'ok'), ['ok', 'not_enough_stock', 'out_of_stock', 'gone', 'gone', 'gone'], 'rentals are never bought');
  assert.strictEqual(cart.lines[1].maxQuantity, 2);
  // locappci.fr rentals: products in the "location" category, with the site's own fields
  assert.deepStrictEqual((await api.listProducts({ universe: 'location' })).items.map(i => i.id).sort(), [ID.groupe, ID.chaises, ID.tente].sort());
  const ch = await api.getProduct(ID.chaises);
  assert.deepStrictEqual([ch.universe, ch.pricePerDay, ch.deposit, ch.condition, ch.delivery, ch.cityId, ch.minDays, ch.maxDays],
    ['location', 5000, 25000, 'Très bon état', 'Livraison possible à Abidjan', 'plateau', 1, 90]);
  const tente = await api.getProduct(ID.tente); assert.deepStrictEqual([tente.pricePerDay, tente.deposit, tente.condition], [0, 0, null], 'price on request');
  const locCats = await api.listCategories('location');
  assert.deepStrictEqual(locCats.map(c => c.name).sort(), ['Chantier et outillage', 'Location', 'Événementiel'].sort());
  // only products the team has validated and left visible (the site's _locappci_* approval fields)
  for (const k of ['pending', 'masked', 'nofields', 'pendingRental']) {
    await assert.rejects(api.getProduct(ID[k]), e => e.code === 'not_found', 'not approved: ' + k);
  }
  for (const word of ['attente', 'masquée', 'Ancien']) assert.strictEqual((await api.listProducts({ search: word })).total, 0, 'not approved is not listed: ' + word);
  assert.deepStrictEqual((await api.listProducts({ ids: [ID.pending, ID.vent16, ID.nofields] })).items.map(i => i.id), [ID.vent16], 'favourites drop unapproved');
  assert.deepStrictEqual((await api.checkCart([{ productId: ID.pending, quantity: 1, shownPrice: 9000 }])).lines.map(l => l.problem), ['gone']);
  assert.strictEqual((await api.checkStock(ID.masked, 7000).catch(e => e.code)), 'not_found', 'no stock answer for a hidden product');
  assert.ok(!(await api.listCategories()).some(c => c.name === 'En attente seulement'), 'category with only unapproved products');
  assert.strictEqual((await api.getShop(ID.newLoueur)).role, 'vendeur', 'an unapproved rental does not make a loueur');
  // settings and requests
  assert.deepStrictEqual(await api.getConfig(), { whatsapp: '447748039794' });
  await assert.rejects(api.sendRentalRequest({ idempotencyKey: 'k', items: [], contact: { name: 'A', phone: '1' } }), e => e.code === 'unauthorized' && /WhatsApp/.test(e.message));
  console.log('ALL GATEWAY CONTRACT TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
