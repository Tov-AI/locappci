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
  assert.strictEqual(page.total, 10); assert.ok(!page.items.some(i => i.name === 'Produit caché'));
  console.log('list all:', page.items.map(i => i.name).join(' | '));
  assert.ok((await api.listProducts({ universe: 'location' })).items.some(i => i.id === ID.groupe), 'RnB rental type still counts');
  assert.strictEqual((await api.listProducts({ universe: 'vente' })).total, 6);
  const elec = cats.find(c => c.name === 'Électroménager').id;
  assert.strictEqual((await api.listProducts({ categoryId: elec })).total, 4, 'parent includes children');
  assert.deepStrictEqual((await api.listProducts({ search: 'ventilateur' })).items.map(i => i.id), [ID.vent16]);
  assert.deepStrictEqual((await api.listProducts({ minPrice: 13000, maxPrice: 20000, universe: 'vente' })).items.map(i => i.price).sort(), [15000, 18500]);
  const asc = (await api.listProducts({ sort: 'price_asc', universe: 'vente' })).items.map(i => i.price); assert.deepStrictEqual(asc, [...asc].sort((a, b) => a - b));
  const near = (await api.listProducts({ cityId: 'cocody', sort: 'nearest' })).items; console.log('nearest cocody:', near.map(i => i.cityId).join(','));
  assert.ok(near[0].cityId === 'cocody' && near[1].cityId === 'cocody' && near.slice(2).every(i => i.cityId !== 'cocody'));
  // pagination across the two parts
  const p1 = await api.listProducts({ cityId: 'cocody', sort: 'nearest', page: 1, pageSize: 5 });
  const p2 = await api.listProducts({ cityId: 'cocody', sort: 'nearest', page: 2, pageSize: 5 });
  const both = [...p1.items, ...p2.items].map(i => i.id);
  assert.deepStrictEqual([p1.hasMore, p2.hasMore, p1.total, new Set(both).size], [true, false, 10, 10]);
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
  assert.deepStrictEqual((await api.listProducts({ universe: 'location' })).items.map(i => i.id).sort(), [ID.groupe, ID.chaises, ID.tente, ID.locsansprix].sort());
  const ch = await api.getProduct(ID.chaises);
  assert.deepStrictEqual([ch.universe, ch.pricePerDay, ch.deposit, ch.condition, ch.delivery, ch.cityId, ch.minDays, ch.maxDays],
    ['location', 5000, 25000, 'Très bon état', 'Livraison possible à Abidjan', 'plateau', 1, 90]);
  const tente = await api.getProduct(ID.tente); assert.deepStrictEqual([tente.pricePerDay, tente.deposit, tente.condition], [0, 0, null], 'price on request');
  const locCats = await api.listCategories('location');
  assert.deepStrictEqual(locCats.map(c => c.name).sort(), ['Chantier et outillage', 'Location', 'Événementiel'].sort());
  // products the site marks as waiting or hidden are not shown; products without approval fields are
  for (const k of ['pending', 'masked', 'pendingRental']) {
    await assert.rejects(api.getProduct(ID[k]), e => e.code === 'not_found', 'not approved: ' + k);
  }
  for (const word of ['attente', 'masquée']) assert.strictEqual((await api.listProducts({ search: word })).total, 0, 'not approved is not listed: ' + word);
  assert.deepStrictEqual((await api.listProducts({ ids: [ID.pending, ID.vent16, ID.nofields] })).items.map(i => i.id), [ID.vent16, ID.nofields], 'favourites drop unapproved');
  assert.strictEqual((await api.getProduct(ID.nofields)).name, 'Ancien produit sans validation', 'old product without approval fields is shown');
  assert.strictEqual((await api.listProducts({ search: 'Ancien' })).total, 1);
  assert.deepStrictEqual((await api.checkCart([{ productId: ID.pending, quantity: 1, shownPrice: 9000 }])).lines.map(l => l.problem), ['gone']);
  assert.strictEqual((await api.checkStock(ID.masked, 7000).catch(e => e.code)), 'not_found', 'no stock answer for a hidden product');
  assert.ok(!(await api.listCategories()).some(c => c.name === 'En attente seulement'), 'category with only unapproved products');
  assert.strictEqual((await api.getShop(ID.newLoueur)).role, 'vendeur', 'an unapproved rental does not make a loueur');
  // shops: the site's own boutique record first, and what the seller hides stays hidden
  const bazar = await api.getShop(ID.bazar);
  assert.deepStrictEqual([bazar.name, bazar.cityId, bazar.whatsapp], ['Bazar Ivoire Market', 'treichville', '2250722222222'], 'record linked from a product');
  assert.ok(/logo-bazar\.png$/.test(bazar.logoUrl), 'logo from the record');
  assert.strictEqual((await api.getProduct(ID.savon)).cityId, 'treichville', 'product town follows the record');
  assert.strictEqual((await api.listProducts({ cityId: 'treichville', sort: 'nearest' })).items[0].id, ID.savon, 'nearest uses the record town');
  const auteur = await api.getShop(ID.auteur);
  assert.deepStrictEqual([auteur.cityId, auteur.whatsapp, auteur.logoUrl], ['adjame', '2250733333333', null], 'record found by its author, telephone as WhatsApp');
  const att = await api.getShop(ID.attenteb);
  assert.deepStrictEqual([att.cityId, att.whatsapp], ['koumassi', '2250700000004'], 'record not validated: WCFM settings');
  const dis = await api.getShop(ID.discret);
  assert.deepStrictEqual([dis.cityId, dis.whatsapp], ['', null], 'hidden phone and address');
  const dis2 = await api.getShop(ID.discret2);
  assert.deepStrictEqual([dis2.cityId, dis2.whatsapp], ['marcory', null], 'hidden phone wins over the record, record town is public');
  assert.strictEqual((await api.getShop(ID.communev)).cityId, 'port-bouet', 'commune chosen on the record wins over its town');
  assert.strictEqual((await api.getShop(ID.communex)).cityId, 'abobo', 'unknown commune: the town is tried next');
  // for sale without a price (a service posted as a product): not in the app; a rental without a price stays
  for (const k of ['sansprix', 'sansprix2']) await assert.rejects(api.getProduct(ID[k]), e => e.code === 'not_found', 'no price: ' + k);
  assert.strictEqual((await api.listProducts({ search: 'Plombier' })).total, 0);
  assert.deepStrictEqual((await api.checkCart([{ productId: ID.sansprix, quantity: 1, shownPrice: 0 }])).lines.map(l => l.problem), ['gone']);
  assert.strictEqual((await api.getProduct(ID.locsansprix)).universe, 'location', 'rental without a price is still listed');
  // settings and requests
  assert.deepStrictEqual(await api.getConfig(), { whatsapp: '447748039794' });
  await assert.rejects(api.sendRentalRequest({ idempotencyKey: 'k', items: [], contact: { name: 'A', phone: '1' } }), e => e.code === 'unauthorized' && /WhatsApp/.test(e.message));

  // ---- accounts: sign in with the website's account, create, sign out, delete ----
  const { setSessionToken } = require('@/api/token');
  const BASE = (process.env.API_URL || 'http://127.0.0.1:8098/wp-json/locappci/').replace(/\/+$/, '');
  const me = async (token) => { const r = await fetch(BASE + '/v1/account', { headers: token ? { 'X-Locappci-Token': token } : {} }); return [r.status, await r.json()]; };
  const BAD = 'Identifiant ou mot de passe incorrect.';
  const bad = (e) => e.code === 'unauthorized' && e.message === BAD;
  await assert.rejects(api.login({ identifier: 'awa@example.com', password: 'wrong' }), bad, 'wrong password');
  await assert.rejects(api.login({ identifier: 'nobody@example.com', password: 'site-pass-1' }), bad, 'unknown e-mail: same answer');
  await assert.rejects(api.login({ identifier: '2250799999999', password: 'site-pass-1' }), bad, 'unknown number: same answer');
  await assert.rejects(api.login({ identifier: '', password: '' }), bad);
  const s1 = await api.login({ identifier: 'awa@example.com', password: 'site-pass-1' });
  assert.deepStrictEqual(s1.account, { name: 'Awa Koné', phone: '2250708091011', email: 'awa@example.com' });
  assert.ok(/^\d+\.[a-f0-9]{64}$/.test(s1.token));
  assert.strictEqual((await api.login({ identifier: 'uk@example.com', password: 'uk-pass-1234' })).account.phone, '', 'no Ivorian number: empty phone');
  await assert.rejects(api.login({ identifier: '0555555555', password: 'pass-jumeau-1' }), bad, 'two accounts share the number: refused');
  assert.strictEqual((await api.login({ identifier: 'j1@example.com', password: 'pass-jumeau-1' })).account.name, 'Jumeau Un', '…but the e-mail works');
  await assert.rejects(api.login({ identifier: 'a@example.com', password: 'admin-pass-1' }), bad, 'administrators never sign in through the app');
  await assert.rejects(api.login({ identifier: 'admin', password: 'admin-pass-1' }), bad);
  // session: who am I, signed-in endpoints, sign out ends this phone only
  assert.deepStrictEqual(await me(s1.token), [200, s1.account]);
  assert.strictEqual((await me(null))[0], 401);
  assert.strictEqual((await me('1.' + 'a'.repeat(64)))[0], 401, 'made-up token');
  assert.strictEqual((await me(s1.token.replace(/^\d+/, '1')))[0], 401, 'token of one account never opens another');
  const s2 = await api.login({ identifier: 'awa@example.com', password: 'site-pass-1' });
  setSessionToken(s1.token);
  await assert.rejects(api.sendRentalRequest({ idempotencyKey: 'k', items: [], contact: { name: 'A', phone: '1' } }), e => e.code === 'unavailable' && /WhatsApp/.test(e.message), 'signed in: not built yet');
  await api.logout();
  assert.strictEqual((await me(s1.token))[0], 401, 'signed out');
  assert.strictEqual((await me(s2.token))[0], 200, 'the other phone stays signed in');
  for (const typed of ['2250708091011', '07 08 09 10 11', '+225 0708091011', '00225 07 08 09 10 11']) {
    assert.strictEqual((await api.login({ identifier: typed, password: 'site-pass-1' })).account.name, 'Awa Koné', 'phone as typed: ' + typed);
  }
  // at most 5 phones signed in per account: the oldest session ends
  assert.strictEqual((await me(s2.token))[0], 200, 'five sessions: all valid');
  await api.login({ identifier: 'awa@example.com', password: 'site-pass-1' });
  assert.strictEqual((await me(s2.token))[0], 401, 'a sixth sign-in ends the oldest session');
  // create an account
  setSessionToken(null);
  const val = (re) => (e) => e.code === 'validation' && re.test(e.message);
  await assert.rejects(api.createAccount({ name: 'A', phone: '2250712121212', password: 'longenough1' }), val(/nom/));
  await assert.rejects(api.createAccount({ name: 'Yao Bi', phone: '0612121212', password: 'longenough1' }), val(/Numéro/));
  await assert.rejects(api.createAccount({ name: 'Yao Bi', phone: '2250712121212', password: 'short' }), val(/8 caractères/));
  await assert.rejects(api.createAccount({ name: 'Yao Bi', phone: '2250712121212', password: 'longenough1', email: 'not-an-email' }), val(/e-mail/));
  await assert.rejects(api.createAccount({ name: 'Yao Bi', phone: '2250708091011', password: 'longenough1' }), val(/existe déjà pour ce numéro/));
  await assert.rejects(api.createAccount({ name: 'Yao Bi', phone: '2250712121212', password: 'longenough1', email: 'awa@example.com' }), val(/existe déjà pour cette adresse/));
  const created = await api.createAccount({ name: '  Yao   <b>Bi</b> ', phone: '2250712121212', password: 'longenough1' });
  assert.deepStrictEqual(created.account, { name: 'Yao Bi', phone: '2250712121212', email: null }, 'no e-mail needed; name cleaned');
  assert.strictEqual((await me(created.token))[0], 200);
  await assert.rejects(api.createAccount({ name: 'Yao Bi', phone: '07 12 12 12 12', password: 'longenough1' }), val(/existe déjà/), 'same number typed another way');
  assert.strictEqual((await api.login({ identifier: '0712121212', password: 'longenough1' })).account.name, 'Yao Bi', 'new account signs in by phone');
  const withMail = await api.createAccount({ name: 'Mariam Touré', phone: '2250513131313', password: 'longenough2', email: 'Mariam@Example.com' });
  assert.strictEqual(withMail.account.email.toLowerCase(), 'mariam@example.com');
  // delete: needs the session and the password again
  setSessionToken(null);
  await assert.rejects(api.deleteAccount({ password: 'longenough1' }), e => e.code === 'unauthorized', 'not signed in');
  setSessionToken(created.token);
  await assert.rejects(api.deleteAccount({ password: 'wrong-password' }), e => e.code === 'unauthorized' && /Mot de passe incorrect/.test(e.message));
  assert.strictEqual((await me(created.token))[0], 200, 'a wrong password does not sign out');
  await api.deleteAccount({ password: 'longenough1' });
  assert.strictEqual((await me(created.token))[0], 401, 'deleted: session gone');
  await assert.rejects(api.login({ identifier: '0712121212', password: 'longenough1' }), bad, 'deleted: cannot sign in');
  const vend = await api.login({ identifier: 'vendeur@example.com', password: 'vend-pass-1' });
  setSessionToken(vend.token);
  await assert.rejects(api.deleteAccount({ password: 'vend-pass-1' }), val(/boutique/), 'a seller account is not deleted from the app');
  assert.strictEqual((await me(vend.token))[0], 200);
  // too many wrong passwords: locked for a while, even with the right one
  setSessionToken(null);
  for (let i = 0; i < 5; i++) await assert.rejects(api.login({ identifier: 'bloque@example.com', password: 'nope' + i }), bad);
  await assert.rejects(api.login({ identifier: 'bloque@example.com', password: 'bloque-pass-1' }), e => e.code === 'rate_limited', 'sixth try is refused');
  assert.strictEqual((await api.login({ identifier: 'awa@example.com', password: 'site-pass-1' })).account.name, 'Awa Koné', 'other accounts are not locked');
  console.log('ALL GATEWAY CONTRACT TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
