# Gateway API — v1

What the gateway must return so the app works unchanged when we switch from mock data to real data.
The source of truth is `src/api/contract.ts`; this page explains it for whoever builds the gateway.

## Basics

- **Base URL:** set in the app with `EXPO_PUBLIC_API_URL`. The gateway is the WordPress plugin in `gateway/locappci-api`, so the value is `https://locappci.fr/wp-json/locappci` (the app adds `/v1/…`). With no value, the app uses the mock in `src/api/mock/`.
- **Implementation status:** plugin 0.1 implements `health`, `cities`, `categories`, `products` (list, `ids`, detail, `stock`), `shops`, `cart/check`. Rental calendar and availability, delivery options, orders, payment reference, accounts and reports come in 0.2.
- **Format:** JSON, UTF-8. Field names in camelCase, exactly as in `contract.ts`.
- **Money:** whole FCFA as integers (`18500`, never `"18 500"` or `18500.00`).
- **Dates:** ISO 8601 UTC strings.
- **Language:** the app sends `Accept-Language: fr`. Error messages must be French and safe to show to users.
- **Errors:** non-2xx status with body `{ "code": "...", "message": "..." }`. Codes: `not_found` (404), `validation` (400), `unauthorized` (401), `unavailable` (503), `server_error` (500).
- **Speed:** lists use `ProductSummary` (small) so they load fast on mobile data. Full `Product` only on the detail endpoint.
- **Keys:** WooCommerce keys stay on the gateway. The app never sees them.

## Endpoints

| Method | Path | Query parameters | Returns |
| --- | --- | --- | --- |
| GET | `/v1/cities` | — | `City[]` |
| GET | `/v1/categories` | `universe` = `vente` \| `location` (optional) | `Category[]` |
| GET | `/v1/products` | `universe`, `city`, `category`, `search`, `min_price`, `max_price`, `sort` = `nearest` \| `price_asc` \| `newest`, `page` (from 1), `page_size` (default 20) | `Page<ProductSummary>` |
| GET | `/v1/products/{id}` | — | `Product` (sale or rental, told apart by `universe`) |
| GET | `/v1/shops/{id}` | — | `Shop` |
| GET | `/v1/products/{id}/stock` | `shown_price` (the price the app displayed) | `StockCheck` |
| GET | `/v1/products/{id}/calendar` | — | `RentalCalendar` (booked days from today, `YYYY-MM-DD`) |
| GET | `/v1/products/{id}/rental-check` | `start_date` (`YYYY-MM-DD`), `days`, `shown_price_per_day` | `RentalCheck` |
| POST | `/v1/cart/check` | — · JSON body `{ "lines": CartCheckLine[] }` | `CartCheck` |
| GET | `/v1/delivery-options` | `shops` (comma-separated shop ids), `city` (delivery commune) | `ShopDelivery[]` |
| POST | `/v1/orders/{id}/payment-reference` | — · JSON body `{ "reference" }` | `Order` (status `awaiting_confirmation`) |
| POST | `/v1/orders` | — · JSON body `OrderRequest` | `Order` |
| GET | `/v1/orders/{id}` | — | `Order` |
| POST | `/v1/accounts` | — · JSON body `{ "orderId", "password" }` (min 8 characters) | `Account` (`name`, `phone`) |
| POST | `/v1/session` | — · JSON body `{ "phone", "password" }` | `Account` (session token added in Feature 14) |
| POST | `/v1/accounts/delete` | — · JSON body `{ "phone", "password" }` | `204 No Content` |
| POST | `/v1/products/{id}/reports` | — · JSON body `ProductReport`: `{ "reason": "scam" \| "forbidden" \| "wrong_info" \| "other", "details"?: string (max 500) }` | `204 No Content` |

### Behaviour the app relies on

- **Search** ignores accents and case: `electrogene` must find "Groupe électrogène".
- **`sort=nearest` with `city`**: items in that commune first, then the rest.
- **`category`** matches the category and its sub-categories.
- **Stock check** is never cached by the gateway. `priceChanged` is `true` when the current price differs from `shown_price`.
- **Pagination:** `hasMore` is `true` when another page exists; the app loads it on scroll.
- **Reports** ("Signaler cette annonce") are forwarded to the LOCAPPCI team, for example by email to the site admin. Return `404 not_found` if the product no longer exists, `422 validation` if `details` is over 500 characters. Rate-limit per device to stop spam.
- **Rental dates** are calendar days in Côte d'Ivoire time (GMT). A rental of `days` days starting `start_date` occupies `start_date` … `start_date + days − 1`; the item comes back on `start_date + days`.
- **Rental check** is never cached. `422 validation` if `start_date` is in the past or `days` is outside `minDays`–`maxDays` (French message, shown as is). `available` is `false` with the clashing days in `conflicts` when any day is already booked. `total` = `pricePerDay × days`; the deposit is separate.
- **Cart check** (before payment, one request for the whole cart): one result per line, same order. `ok` is `false` with a `problem`: `gone`, `out_of_stock`, `not_enough_stock` (with `maxQuantity`), `dates_taken` (with `conflicts`) or `invalid_dates`. A price change alone keeps `ok: true` with `priceChanged: true`; the app shows the new price and asks the person to confirm. Never cached.
- **Orders are idempotent**: the same `idempotencyKey` must return the same order, never a second one (double tap, lost connection, retry after a refused payment). After `payment_failed`, a retry with the same key puts the order back to `pending_payment` (the payment method may change).
- **`POST /v1/orders`** re-checks stock, dates and prices; if anything changed it returns `409` with code `cart_changed` and creates nothing. It validates the Ivorian phone (`225` + 10 digits starting 01, 05, 07, 21, 25, 27), one delivery choice per shop, and an address when any choice is home delivery.
- **Statuses**: cash → `confirmed` at once; Wave / Orange Money → `pending_payment` with a `paymentUrl` to open, then `paid` or `payment_failed` once the provider tells the gateway (Feature 15). The app reads the result with `GET /v1/orders/{id}`.
- **`Order.shops`** tells each shop's items and delivery choice; **`Order.step`** (`confirmed` → `preparing` → `delivered`) drives "Suivi". The gateway maps WooCommerce statuses to these steps.
- **Account from an order** creates a WordPress customer with the order's name and phone and the given password (sent over HTTPS, never stored by the app). `422 validation` if the phone already has an account. Login and session tokens come with Feature 14.
- **`GET /v1/products?ids=a,b,c`** returns only those products, in that order (favourites). Unknown ids are skipped.
- **Login errors** use one message for "unknown number" and "wrong password" (`401 unauthorized`), so nobody can test which numbers have an account. Rate-limit attempts.
- **Account deletion** (required by Apple and Google): removes the WordPress customer and personal data; orders already placed stay with the shops for delivery and invoices.
- **Payment v1 (no merchant accounts yet)**: Wave / Orange Money orders come back `pending_payment` with `transferTo` (the LOCAPPCI number and name, from the gateway settings). The customer transfers `total`, then sends the transaction reference → `awaiting_confirmation`. The team checks it in WordPress and sets `paid` (or `payment_failed`). With merchant accounts later, `paymentUrl` replaces `transferTo` (Feature 15).
- **Delivery price** depends on the distance between the shop and the delivery commune (`city`); `detail` shows "≈ 14 km · 24–48 h". The real tariff is to confirm with the client.
- **No cash on delivery** in v1 (client's answer); `cash` stays in the contract for later.
- **Deposits** are not in `total`: they are handed over at pickup (pending client confirmation).
- **`Shop.whatsapp`** is digits only in international format (`225…`). The app opens `https://wa.me/<number>` with a pre-filled message; `null` hides the WhatsApp button.
- **`SaleProduct.stock.quantity`** is the number of units the shop has (or `null` if unknown). The cart never goes above it.

## Example

`GET /v1/products?universe=location&city=marcory&page=1`

```json
{
  "items": [
    {
      "id": "r-groupe-5kva",
      "universe": "location",
      "name": "Groupe électrogène 5 kVA",
      "coverUrl": "https://locappci.fr/wp-content/uploads/…/groupe.webp",
      "categoryId": "energie",
      "price": 15000,
      "cityId": "marcory",
      "shopName": "Marcory Bâtiment Loc",
      "stockStatus": null
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "hasMore": false
}
```

## Changing the contract

1. Edit `src/api/contract.ts` and this page in the same pull request.
2. Update the mock (`src/api/mock/`) so the app still runs without the gateway.
3. If a field's shape changes, bump `buster` in `src/data/queryClient.ts` so phones drop old cached data.
4. Both the app owner and the gateway owner approve.
