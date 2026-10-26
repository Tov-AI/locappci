/**
 * LOCAPPCI API contract — the agreement between the app and the gateway.
 *
 * The app only ever talks to the gateway through these types. The gateway turns
 * WordPress / WooCommerce data into exactly these shapes. Changing this file needs
 * both the app owner and the gateway owner to approve the pull request.
 *
 * Human-readable version with endpoints: docs/API.md
 */

/** Prices are whole West African CFA francs (no decimals). */
export type Fcfa = number;

/** ISO 8601 date-time string, e.g. "2026-10-24T14:32:00Z". */
export type IsoDateTime = string;

export type Universe = 'vente' | 'location';

export type City = {
  id: string; // e.g. "cocody"
  name: string; // "Cocody"
  region: string; // "Abidjan"
};

export type Category = {
  id: string;
  name: string;
  universe: Universe;
  parentId: string | null;
};

export type Shop = {
  id: string;
  name: string;
  /** Initials shown in the avatar when there is no logo. */
  initials: string;
  logoUrl: string | null;
  cityId: string;
  /** International format, digits only, e.g. "2250700000000". Used for WhatsApp. */
  whatsapp: string | null;
  role: 'vendeur' | 'loueur';
};

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

type ProductBase = {
  id: string;
  name: string;
  description: string;
  images: string[]; // URLs, first = cover. May be empty.
  categoryId: string;
  shopId: string;
  cityId: string;
  /** Public page on locappci.fr, used for sharing. */
  webUrl: string;
  updatedAt: IsoDateTime;
};

export type SaleProduct = ProductBase & {
  universe: 'vente';
  price: Fcfa;
  stock: { status: StockStatus; quantity: number | null };
};

export type RentalProduct = ProductBase & {
  universe: 'location';
  pricePerDay: Fcfa;
  deposit: Fcfa;
  minDays: number;
  maxDays: number;
};

export type Product = SaleProduct | RentalProduct;

/** Lightweight version used in lists and grids (smaller downloads on mobile data). */
export type ProductSummary = {
  id: string;
  universe: Universe;
  name: string;
  coverUrl: string | null;
  /** Lets the app suggest "Affiner par catégorie" from the results. */
  categoryId: string;
  /** Sale price, or price per day for rentals. */
  price: Fcfa;
  cityId: string;
  shopName: string;
  stockStatus: StockStatus | null; // null for rentals
};

export type SortOrder = 'nearest' | 'price_asc' | 'newest';

export type ProductQuery = {
  universe?: Universe;
  cityId?: string;
  categoryId?: string;
  search?: string;
  minPrice?: Fcfa;
  maxPrice?: Fcfa;
  sort?: SortOrder;
  /** Only these products (e.g. favourites). The order of `ids` is kept. */
  ids?: string[];
  page?: number; // starts at 1
  pageSize?: number; // default 20
};

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

/** Live re-check before adding to cart and before payment. */
export type StockCheck = {
  productId: string;
  available: boolean;
  status: StockStatus;
  price: Fcfa;
  /** True when the price differs from what the app showed. */
  priceChanged: boolean;
};

/** Standard error body returned by the gateway. Messages are user-safe French. */
export type ApiErrorBody = {
  /** `cart_changed`: stock, dates or prices changed since the cart check; check again. */
  code: 'not_found' | 'unavailable' | 'validation' | 'unauthorized' | 'server_error' | 'cart_changed';
  message: string;
};

/** Calendar date "YYYY-MM-DD" (Côte d'Ivoire time = GMT). */
export type IsoDate = string;

/** Days already booked for a rental item, from today on. */
export type RentalCalendar = {
  productId: string;
  bookedDates: IsoDate[];
};

/** Asked when the person taps "Réserver". */
export type RentalRequest = {
  startDate: IsoDate;
  /** Number of days, between minDays and maxDays. Return is on startDate + days. */
  days: number;
  /** Price per day the app displayed, to detect a price change. */
  shownPricePerDay: Fcfa;
};

/** Live answer for a rental request. Never cached. */
export type RentalCheck = {
  productId: string;
  available: boolean;
  /** Requested days that are already booked (empty when available). */
  conflicts: IsoDate[];
  pricePerDay: Fcfa;
  /** Refundable, paid on top of the rental. */
  deposit: Fcfa;
  /** pricePerDay × days. */
  total: Fcfa;
  priceChanged: boolean;
};

/** One cart line sent for the check before payment. */
export type CartCheckLine =
  | { productId: string; quantity: number; shownPrice: Fcfa }
  | { productId: string; rental: RentalRequest };

/** What can be wrong with a line. */
export type CartProblem =
  | 'gone' // product removed from the site
  | 'out_of_stock'
  | 'not_enough_stock' // fewer units than asked: see maxQuantity
  | 'dates_taken' // see conflicts
  | 'invalid_dates'; // start in the past or duration out of limits

export type CartCheckResult = {
  productId: string;
  /** True when the line can be paid as it is (a price change alone keeps it true). */
  ok: boolean;
  problem?: CartProblem;
  /** Current unit price (sale) or price per day (rental). */
  price: Fcfa;
  priceChanged: boolean;
  /** Sale: units available (null = no limit). */
  maxQuantity?: number | null;
  /** Rental: current deposit and clashing days. */
  deposit?: Fcfa;
  conflicts?: IsoDate[];
};

/** One request for the whole cart: fewer round trips on mobile data. Never cached. */
export type CartCheck = { lines: CartCheckResult[] };

export type DeliveryOption = {
  id: string;
  kind: 'home' | 'pickup';
  /** "À domicile", "Retrait en boutique", "Retrait chez le loueur". */
  label: string;
  price: Fcfa;
  /** Short, shown under the price: "24–48 h", "Yopougon". */
  detail: string;
};

/** Delivery choices of one shop (each shop delivers or hands over its own items). */
export type ShopDelivery = { shopId: string; options: DeliveryOption[] };

/** 'cash' stays in the contract for later; the client said no cash on delivery for v1. */
export type PaymentMethod = 'wave' | 'orange_money' | 'cash';

export type Customer = {
  name: string;
  /** Digits only, with country code: "2250700000000". */
  phone: string;
  /** Commune, district, landmark. Required for home delivery. */
  address: string;
};

export type OrderRequest = {
  /**
   * Same key for retries of the same checkout: the gateway returns the existing order
   * instead of creating a second one (double tap, lost connection, payment retry).
   */
  idempotencyKey: string;
  customer: Customer;
  lines: CartCheckLine[];
  deliveries: { shopId: string; optionId: string }[];
  /** Commune to deliver to: home delivery is priced by distance from each shop. */
  deliveryCityId?: string;
  paymentMethod: PaymentMethod;
};

export type OrderStatus =
  | 'pending_payment' // waiting for Wave / Orange Money
  | 'awaiting_confirmation' // transfer reference sent; the team checks it
  | 'paid'
  | 'confirmed' // cash on delivery: accepted, paid later
  | 'payment_failed'
  | 'cancelled';

/** Where the order is, as shown in "Suivi". */
export type OrderStep = 'confirmed' | 'preparing' | 'delivered';

/** What one shop has to hand over, for the confirmation and tracking text. */
export type OrderShop = {
  shopId: string;
  shopName: string;
  whatsapp: string | null;
  delivery: { kind: 'home' | 'pickup'; label: string; detail: string };
  lines: { name: string; quantity: number; rental?: { startDate: IsoDate; days: number; deposit: Fcfa } }[];
};

export type Order = {
  id: string;
  /** Shown to people: "LOC-24817". */
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  itemsTotal: Fcfa;
  deliveryTotal: Fcfa;
  /** itemsTotal + deliveryTotal: what is paid now (or on delivery for cash). */
  total: Fcfa;
  /** Refundable deposits, handed over at pickup; not in total. */
  depositTotal: Fcfa;
  /** Wave / Orange Money page to open (merchant accounts, later), or null. */
  paymentUrl: string | null;
  /**
   * v1 without merchant accounts: send the amount to this number by transfer,
   * then give the transaction reference. null when paymentUrl is used instead.
   */
  transferTo: { number: string; name: string } | null;
  /** Reference typed by the customer after the transfer. */
  paymentReference: string | null;
  createdAt: IsoDateTime;
  step: OrderStep;
  customer: Customer;
  shops: OrderShop[];
};

/** "Gardez le suivi": turns the guest order into an account (name and phone from the order). */
export type AccountRequest = { orderId: string; password: string };
export type Account = { name: string; phone: string };

/** Sign in on another phone, or again after "Se déconnecter". Session tokens come with Feature 14. */
export type LoginRequest = { phone: string; password: string };

export type ReportReason = 'scam' | 'forbidden' | 'wrong_info' | 'other';

/** "Signaler cette annonce": the gateway forwards it to the LOCAPPCI team (e.g. by email). */
export type ProductReport = {
  reason: ReportReason;
  /** Optional free text, at most 500 characters. */
  details?: string;
};

/** Everything the app can ask the gateway for. More endpoints arrive with later features. */
export interface LocappciApi {
  listCities(): Promise<City[]>;
  listCategories(universe?: Universe): Promise<Category[]>;
  listProducts(query: ProductQuery): Promise<Page<ProductSummary>>;
  getProduct(id: string): Promise<Product>;
  getShop(id: string): Promise<Shop>;
  checkStock(productId: string, shownPrice: Fcfa): Promise<StockCheck>;
  reportProduct(productId: string, report: ProductReport): Promise<void>;
  getRentalCalendar(productId: string): Promise<RentalCalendar>;
  checkRental(productId: string, request: RentalRequest): Promise<RentalCheck>;
  checkCart(lines: CartCheckLine[]): Promise<CartCheck>;
  /** `cityId`: where to deliver, for the distance-based price. */
  getDeliveryOptions(shopIds: string[], cityId?: string): Promise<ShopDelivery[]>;
  /** "J'ai payé": sends the Wave / Orange Money transaction reference. */
  submitPaymentReference(orderId: string, reference: string): Promise<Order>;
  createOrder(request: OrderRequest): Promise<Order>;
  getOrder(id: string): Promise<Order>;
  createAccount(request: AccountRequest): Promise<Account>;
  login(request: LoginRequest): Promise<Account>;
  /** Store rules (Apple, Google): people must be able to delete their account from the app. */
  deleteAccount(request: LoginRequest): Promise<void>;
}
