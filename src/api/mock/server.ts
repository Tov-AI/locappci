import type {
  Account,
  CartCheckResult,
  OrderShop,
  DeliveryOption,
  Order,
  IsoDate,
  LocappciApi,
  Product,
  ProductQuery,
  ProductSummary,
  StockCheck,
} from '@/api/contract';
import { ApiError, networkError } from '@/api/errors';
import { bookedDayOffsets, categories, cities, products, shops } from '@/api/mock/data';
import { addDays, today } from '@/utils/dates';

/**
 * Developer switches to test loading, error and offline behaviour on a real phone.
 * Changed from the "Données (dev)" screen. They only exist in the mock.
 */
export const mockSettings = {
  /** Extra delay per request, in ms. 'slow' simulates a weak 3G connection. */
  latency: 'normal' as 'fast' | 'normal' | 'slow',
  /** Every request fails as if the network were down. */
  failAll: false,
  /**
   * Answer of the NEXT live stock check or rental check only, then back to 'normal'.
   * Lets us test "sold out / dates taken meanwhile" and "price changed" on the phone.
   */
  nextCheck: 'normal' as 'normal' | 'sold_out' | 'price_up',
};

const delayMs = () => ({ fast: 50, normal: 400, slow: 2500 })[mockSettings.latency];

async function respond<T>(make: () => T): Promise<T> {
  await new Promise((r) => setTimeout(r, delayMs()));
  if (mockSettings.failAll) throw networkError();
  const result = make();
  // Nothing to return (e.g. a report was received).
  if (result === undefined) return result;
  // Return a copy so screens can never change the "server" data by accident.
  return JSON.parse(JSON.stringify(result)) as T;
}

const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? '';

function toSummary(p: Product): ProductSummary {
  return {
    id: p.id,
    universe: p.universe,
    name: p.name,
    coverUrl: p.images[0] ?? null,
    categoryId: p.categoryId,
    price: p.universe === 'vente' ? p.price : p.pricePerDay,
    cityId: p.cityId,
    shopName: shopName(p.shopId),
    stockStatus: p.universe === 'vente' ? p.stock.status : null,
  };
}

const normalise = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function filterProducts(q: ProductQuery): ProductSummary[] {
  const term = q.search ? normalise(q.search.trim()) : '';
  let list = products
    .filter((p) => !q.ids || q.ids.includes(p.id))
    .filter((p) => !q.universe || p.universe === q.universe)
    .filter((p) => !q.categoryId || p.categoryId === q.categoryId || categories.find((c) => c.id === p.categoryId)?.parentId === q.categoryId)
    .filter((p) => !term || normalise(`${p.name} ${p.description}`).includes(term))
    .map(toSummary)
    .filter((s) => q.minPrice == null || s.price >= q.minPrice)
    .filter((s) => q.maxPrice == null || s.price <= q.maxPrice);

  if (q.sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
  if (q.sort === 'newest') {
    const updated = new Map(products.map((p) => [p.id, p.updatedAt]));
    list = [...list].sort((a, b) => (updated.get(b.id) ?? '').localeCompare(updated.get(a.id) ?? ''));
  }
  // "nearest": items in the chosen commune first, then the others.
  if ((q.sort ?? 'nearest') === 'nearest' && q.cityId) {
    list = [...list].sort((a, b) => Number(b.cityId === q.cityId) - Number(a.cityId === q.cityId));
  }
  // Favourites: keep the order the app asked for.
  if (q.ids) list = [...list].sort((a, b) => q.ids!.indexOf(a.id) - q.ids!.indexOf(b.id));
  return list;
}

export const mockApi: LocappciApi = {
  listCities: () => respond(() => cities),

  listCategories: (universe) =>
    respond(() => categories.filter((c) => !universe || c.universe === universe)),

  listProducts: (query) =>
    respond(() => {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const all = filterProducts(query);
      const start = (page - 1) * pageSize;
      return {
        items: all.slice(start, start + pageSize),
        page,
        pageSize,
        total: all.length,
        hasMore: start + pageSize < all.length,
      };
    }),

  getProduct: (id) =>
    respond(() => {
      const p = products.find((x) => x.id === id);
      if (!p) throw new ApiError('not_found', "Cette annonce n'est plus disponible.");
      return p;
    }),

  getShop: (id) =>
    respond(() => {
      const s = shops.find((x) => x.id === id);
      if (!s) throw new ApiError('not_found', "Cette boutique n'existe plus.");
      return s;
    }),

  checkStock: (productId, shownPrice) =>
    respond((): StockCheck => {
      const p = products.find((x) => x.id === productId);
      if (!p) throw new ApiError('not_found', "Cette annonce n'est plus disponible.");
      const forced = mockSettings.nextCheck;
      mockSettings.nextCheck = 'normal';
      const realPrice = p.universe === 'vente' ? p.price : p.pricePerDay;
      const price = forced === 'price_up' ? realPrice + 1000 : realPrice;
      const status = forced === 'sold_out' ? 'out_of_stock' : p.universe === 'vente' ? p.stock.status : 'in_stock';
      return { productId, available: status !== 'out_of_stock', status, price, priceChanged: price !== shownPrice };
    }),

  reportProduct: (productId, report) =>
    respond(() => {
      if (!products.some((x) => x.id === productId)) {
        throw new ApiError('not_found', "Cette annonce n'est plus disponible.");
      }
      if ((report.details?.length ?? 0) > 500) {
        throw new ApiError('validation', 'Le message ne doit pas dépasser 500 caractères.');
      }
      reports.push({ productId, ...report, at: new Date().toISOString() });
    }),

  getRentalCalendar: (productId) =>
    respond(() => {
      const p = products.find((x) => x.id === productId);
      if (!p || p.universe !== 'location') throw new ApiError('not_found', "Cette annonce n'est plus disponible.");
      return { productId, bookedDates: bookedDates(productId) };
    }),

  getDeliveryOptions: (shopIds) =>
    respond(() => shopIds.map((shopId) => ({ shopId, options: deliveryOptionsFor(shopId) }))),

  createOrder: (req) =>
    respond(() => {
      // Same checkout tried again (double tap, retry after a failed payment): same order.
      const existingId = orderByKey.get(req.idempotencyKey);
      if (existingId) {
        const o = orders.get(existingId)!;
        if (o.status === 'payment_failed') {
          const retry = { ...o, status: 'pending_payment' as const, paymentMethod: req.paymentMethod };
          orders.set(o.id, retry);
          return retry;
        }
        return o;
      }

      const { customer } = req;
      if (customer.name.trim().length < 2) throw new ApiError('validation', 'Indiquez votre nom.');
      if (!CI_PHONE.test(customer.phone)) throw new ApiError('validation', 'Numéro de téléphone invalide.');
      if (req.lines.length === 0) throw new ApiError('validation', 'Votre panier est vide.');

      const results = req.lines.map((l) => checkCartLine(l, 'normal'));
      if (results.some((r) => !r.ok || r.priceChanged)) {
        throw new ApiError('cart_changed', 'Votre panier a changé. Vérifiez-le avant de payer.');
      }

      // One delivery choice per shop in the cart.
      const shopOf = (productId: string) => products.find((p) => p.id === productId)?.shopId ?? '';
      const shopIds = [...new Set(req.lines.map((l) => shopOf(l.productId)))];
      let deliveryTotal = 0;
      let homeDelivery = false;
      const orderShops: OrderShop[] = [];
      for (const shopId of shopIds) {
        const choice = req.deliveries.find((d) => d.shopId === shopId);
        const option = deliveryOptionsFor(shopId).find((o) => o.id === choice?.optionId);
        if (!option) throw new ApiError('validation', 'Choisissez une livraison pour chaque boutique.');
        deliveryTotal += option.price;
        homeDelivery ||= option.kind === 'home';
        const shop = shops.find((s) => s.id === shopId)!;
        orderShops.push({
          shopId,
          shopName: shop.name,
          whatsapp: shop.whatsapp,
          delivery: { kind: option.kind, label: option.label, detail: option.detail },
          lines: req.lines
            .filter((l) => shopOf(l.productId) === shopId)
            .map((l) => {
              const p = products.find((x) => x.id === l.productId)!;
              return 'rental' in l && p.universe === 'location'
                ? { name: p.name, quantity: 1, rental: { startDate: l.rental.startDate, days: l.rental.days, deposit: p.deposit } }
                : { name: p.name, quantity: 'quantity' in l ? l.quantity : 1 };
            }),
        });
      }
      if (homeDelivery && customer.address.trim().length < 3) {
        throw new ApiError('validation', 'Indiquez votre adresse de livraison.');
      }

      let itemsTotal = 0;
      let depositTotal = 0;
      req.lines.forEach((l, i) => {
        const r = results[i];
        if ('rental' in l) {
          itemsTotal += r.price * l.rental.days;
          depositTotal += r.deposit ?? 0;
        } else {
          itemsTotal += r.price * l.quantity;
        }
      });

      const order: Order = {
        id: `ord_${nextOrderNumber}`,
        number: `LOC-${nextOrderNumber++}`,
        status: req.paymentMethod === 'cash' ? 'confirmed' : 'pending_payment',
        paymentMethod: req.paymentMethod,
        itemsTotal,
        deliveryTotal,
        total: itemsTotal + deliveryTotal,
        depositTotal,
        paymentUrl: null,
        createdAt: new Date().toISOString(),
        step: 'confirmed',
        customer,
        shops: orderShops,
      };
      orders.set(order.id, order);
      orderByKey.set(req.idempotencyKey, order.id);
      return order;
    }),

  createAccount: ({ orderId, password }) =>
    respond((): Account => {
      const o = orders.get(orderId);
      if (!o) throw new ApiError('not_found', 'Commande introuvable.');
      if (password.length < 8) throw new ApiError('validation', 'Le mot de passe doit faire au moins 8 caractères.');
      if (accounts.has(o.customer.phone)) {
        throw new ApiError('validation', 'Un compte existe déjà pour ce numéro. Connectez-vous depuis l’onglet Compte.');
      }
      const account = { name: o.customer.name, phone: o.customer.phone };
      accounts.set(o.customer.phone, { ...account, password });
      return account;
    }),

  login: ({ phone, password }) =>
    respond((): Account => {
      const a = accounts.get(phone);
      // Same message for both cases: never tell a stranger whether a number has an account.
      if (!a || a.password !== password) throw new ApiError('unauthorized', 'Numéro ou mot de passe incorrect.');
      return { name: a.name, phone: a.phone };
    }),

  deleteAccount: ({ phone, password }) =>
    respond(() => {
      const a = accounts.get(phone);
      if (!a || a.password !== password) throw new ApiError('unauthorized', 'Mot de passe incorrect.');
      accounts.delete(phone);
    }),

  getOrder: (id) =>
    respond(() => {
      const o = orders.get(id);
      if (!o) throw new ApiError('not_found', 'Commande introuvable.');
      return o;
    }),

  checkCart: (lines) =>
    respond(() => {
      const forced = mockSettings.nextCheck;
      mockSettings.nextCheck = 'normal';
      // The simulation applies to the first line only, like a single item changing.
      return { lines: lines.map((l, i) => checkCartLine(l, i === 0 ? forced : 'normal')) };
    }),

  checkRental: (productId, { startDate, days, shownPricePerDay }) =>
    respond(() => {
      const p = products.find((x) => x.id === productId);
      if (!p || p.universe !== 'location') throw new ApiError('not_found', "Cette annonce n'est plus disponible.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < today()) {
        throw new ApiError('validation', 'Choisissez une date à partir d’aujourd’hui.');
      }
      if (!Number.isInteger(days) || days < p.minDays || days > p.maxDays) {
        throw new ApiError('validation', `Durée possible : ${p.minDays} à ${p.maxDays} jours.`);
      }
      const forced = mockSettings.nextCheck;
      mockSettings.nextCheck = 'normal';
      const pricePerDay = forced === 'price_up' ? p.pricePerDay + 1000 : p.pricePerDay;
      const wanted = Array.from({ length: days }, (_, i) => addDays(startDate, i));
      const booked = new Set(bookedDates(productId));
      // 'sold_out' simulates someone booking the first day a moment ago.
      const conflicts = forced === 'sold_out' ? [startDate] : wanted.filter((d) => booked.has(d));
      return {
        productId,
        available: conflicts.length === 0,
        conflicts,
        pricePerDay,
        deposit: p.deposit,
        total: pricePerDay * days,
        priceChanged: pricePerDay !== shownPricePerDay,
      };
    }),
};

function checkCartLine(line: Parameters<LocappciApi['checkCart']>[0][number], forced: typeof mockSettings.nextCheck): CartCheckResult {
  const p = products.find((x) => x.id === line.productId);
  if (!p) return { productId: line.productId, ok: false, problem: 'gone', price: 0, priceChanged: false };

  if ('rental' in line) {
    if (p.universe !== 'location') return { productId: p.id, ok: false, problem: 'gone', price: 0, priceChanged: false };
    const { startDate, days, shownPricePerDay } = line.rental;
    const price = forced === 'price_up' ? p.pricePerDay + 1000 : p.pricePerDay;
    const base = { productId: p.id, price, priceChanged: price !== shownPricePerDay, deposit: p.deposit };
    if (startDate < today() || days < p.minDays || days > p.maxDays) return { ...base, ok: false, problem: 'invalid_dates' };
    const booked = new Set(bookedDates(p.id));
    const wanted = Array.from({ length: days }, (_, i) => addDays(startDate, i));
    const conflicts = forced === 'sold_out' ? [startDate] : wanted.filter((d) => booked.has(d));
    return conflicts.length ? { ...base, ok: false, problem: 'dates_taken', conflicts } : { ...base, ok: true };
  }

  if (p.universe !== 'vente') return { productId: p.id, ok: false, problem: 'gone', price: 0, priceChanged: false };
  const price = forced === 'price_up' ? p.price + 1000 : p.price;
  const status = forced === 'sold_out' ? 'out_of_stock' : p.stock.status;
  const base = { productId: p.id, price, priceChanged: price !== line.shownPrice, maxQuantity: p.stock.quantity };
  if (status === 'out_of_stock') return { ...base, ok: false, problem: 'out_of_stock', maxQuantity: 0 };
  if (p.stock.quantity != null && line.quantity > p.stock.quantity) return { ...base, ok: false, problem: 'not_enough_stock' };
  return { ...base, ok: true };
}

/** Delivery choices: sellers deliver (1 500 FCFA) or hand over in the shop; rental shops hand over only. */
function deliveryOptionsFor(shopId: string): DeliveryOption[] {
  const shop = shops.find((s) => s.id === shopId);
  if (!shop) return [];
  const commune = cities.find((c) => c.id === shop.cityId)?.name ?? '';
  const pickup: DeliveryOption = {
    id: 'pickup',
    kind: 'pickup',
    label: shop.role === 'loueur' ? 'Retrait chez le loueur' : 'Retrait en boutique',
    price: 0,
    detail: commune,
  };
  if (shop.role === 'loueur') return [pickup];
  return [{ id: 'home', kind: 'home', label: 'À domicile', price: 1500, detail: '24–48\u00A0h' }, pickup];
}

/** Orders made in the mock, and which idempotency key created which order. */
const orders = new Map<string, Order>();
const orderByKey = new Map<string, string>();
let nextOrderNumber = 24817;

/**
 * Mock only: what Wave / Orange Money would tell the gateway after the person pays.
 * The real gateway learns it from the payment provider (Feature 15).
 */
export function simulatePayment(orderId: string, outcome: 'paid' | 'payment_failed') {
  const o = orders.get(orderId);
  if (o && o.status === 'pending_payment') orders.set(orderId, { ...o, status: outcome });
}

/** Accounts created in the mock, by phone number. (The real gateway never keeps plain passwords: WordPress hashes them.) */
const accounts = new Map<string, Account & { password: string }>();

const CI_PHONE = /^225(01|05|07|21|25|27)\d{8}$/;

/** Booked days of a rental, worked out from today so the sample data never goes out of date. */
const bookedDates = (productId: string): IsoDate[] =>
  (bookedDayOffsets[productId] ?? []).map((n) => addDays(today(), n));

/** Reports received by the mock, so we can check them in tests. */
export const reports: { productId: string; reason: string; details?: string; at: string }[] = [];
