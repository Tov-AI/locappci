# Gateway API — v1

What the gateway must return so the app works unchanged when we switch from mock data to real data.
The source of truth is `src/api/contract.ts`; this page explains it for whoever builds the gateway.

## Basics

- **Base URL:** set in the app with `EXPO_PUBLIC_API_URL`. The gateway is the WordPress plugin in `gateway/locappci-api`, so the value is `https://locappci.fr/wp-json/locappci` (the app adds `/v1/…`). With no value, the app uses the mock in `src/api/mock/`.
- **Implementation status:** plugin 0.5.1 implements `health`, `config`, `cities`, `categories`, `products` (list, `ids`, detail, `stock`), `shops`, `cart/check` and **accounts** (`session`, `session/logout`, `account`, `accounts`, `accounts/delete`). **`rental-requests`** (signed in; writes the website's own `locappci_loc_req` records). Delivery options, orders, payment reference and reports come next.
- **Format:** JSON, UTF-8. Field names in camelCase, exactly as in `contract.ts`.
- **Money:** whole FCFA as integers (`18500`, never `"18 500"` or `18500.00`).
- **Dates:** ISO 8601 UTC strings.
- **Language:** the app sends `Accept-Language: fr`. Error messages must be French and safe to show to users.
- **Errors:** non-2xx status with body `{ "code": "...", "message": "..." }`. Codes: `not_found` (404), `validation` (400), `unauthorized` (401), `unavailable` (503), `server_error` (500), `cart_changed` (409), `rate_limited` (429).
- **Signed-in calls** send the session token in the header **`X-Locappci-Token`** (not `Authorization`: the site's Simple JWT Login plugin reads that header and would reject our token).
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
| GET | `/v1/config` | — | `AppConfig` (`whatsapp`: LOCAPPCI WhatsApp, set in Outils → LOCAPPCI API) |
| POST | `/v1/rental-requests` | — · JSON body `RentalRequestSend` (needs a signed-in account) | `RentalRequestReceipt` |
| POST | `/v1/cart/check` | — · JSON body `{ "lines": CartCheckLine[] }` | `CartCheck` |
| GET | `/v1/delivery-options` | `shops` (comma-separated shop ids), `city` (delivery commune) | `ShopDelivery[]` |
| POST | `/v1/orders/{id}/payment-reference` | — · JSON body `{ "reference" }` | `Order` (status `awaiting_confirmation`) |
| POST | `/v1/orders` | — · JSON body `OrderRequest` | `Order` |
| GET | `/v1/orders/{id}` | — | `Order` |
| POST | `/v1/session` | — · JSON body `LoginRequest`: `{ "identifier", "password" }` (`identifier` = phone or e-mail) | `Session`: `{ "account": Account, "token" }` |
| POST | `/v1/session/logout` | — · signed in | `204 No Content` (ends this phone's session only) |
| GET | `/v1/account` | — · signed in | `Account`: `{ "name", "phone", "email" }` (`401` when the session is over) |
| POST | `/v1/accounts` | — · JSON body `AccountRequest`: `{ "name", "phone", "password", "email"?, "orderId"? }` (password min 8 characters) | `201` `Session` |
| POST | `/v1/accounts/delete` | — · signed in · JSON body `{ "password" }` | `204 No Content` |
| POST | `/v1/products/{id}/reports` | — · JSON body `ProductReport`: `{ "reason": "scam" \| "forbidden" \| "wrong_info" \| "other", "details"?: string (max 500) }` | `204 No Content` |

### Behaviour the app relies on

- **Search** ignores accents and case: `electrogene` must find "Groupe électrogène".
- **`sort=nearest` with `city`**: items in that commune first, then the rest.
- **`category`** matches the category and its sub-categories.
- **Stock check** is never cached by the gateway. `priceChanged` is `true` when the current price differs from `shown_price`.
- **Pagination:** `hasMore` is `true` when another page exists; the app loads it on scroll.
- **Reports** ("Signaler cette annonce") are forwarded to the LOCAPPCI team, for example by email to the site admin. Return `404 not_found` if the product no longer exists, `422 validation` if `details` is over 500 characters. Rate-limit per device to stop spam.
- **Rentals work by request, like on locappci.fr** (Feature 14): nothing is booked or paid in the app. Rental items are the products in the site's `location` category (or a rental product type). `pricePerDay` is `0` when the price is on request ("Prix à confirmer"); `deposit`, `condition`, `delivery` and the item's commune come from the site's `_locappci_location_*` fields.
- **Rental requests**: one request per item, sent to that item's loueur (site record `locappci_loc_req`, status `new` → `processing` → `done` / `archived`). Idempotent on `idempotencyKey` for one day (the same key returns the first receipt and creates nothing). The whole list is checked before anything is written. At most 30 items per request and 10 requests per hour per customer (`429 rate_limited`). The loueur is not e-mailed, as on the website: he sees the request on his « Mes demandes location » page. `400 validation` (French message) for a past `startDate`, `days` outside `minDays`–`maxDays`, a quantity outside 1–99, an unknown commune, a bad phone or a message over 500 characters. Items no longer offered are returned in `skipped`. Needs a signed-in account (`401 unauthorized` otherwise), like the website; without an account the app sends the list to the LOCAPPCI WhatsApp.
- **Rental dates** are calendar days in Côte d'Ivoire time (GMT). A rental of `days` days starting `startDate` covers `startDate` … `startDate + days − 1`.
- **Cart check** (before payment, one request for the whole cart, sale products only): one result per line, same order. `ok` is `false` with a `problem`: `gone` (also for a rental item: rentals are never bought), `out_of_stock` or `not_enough_stock` (with `maxQuantity`). A price change alone keeps `ok: true` with `priceChanged: true`; the app shows the new price and asks the person to confirm. Never cached.
- **Orders are idempotent**: the same `idempotencyKey` must return the same order, never a second one (double tap, lost connection, retry after a refused payment). After `payment_failed`, a retry with the same key puts the order back to `pending_payment` (the payment method may change).
- **`POST /v1/orders`** re-checks stock and prices; if anything changed it returns `409` with code `cart_changed` and creates nothing. It validates the Ivorian phone (`225` + 10 digits starting 01, 05, 07, 21, 25, 27), one delivery choice per shop, and an address when any choice is home delivery.
- **Statuses**: cash → `confirmed` at once; Wave / Orange Money → `pending_payment` with a `paymentUrl` to open, then `paid` or `payment_failed` once the provider tells the gateway (Feature 15). The app reads the result with `GET /v1/orders/{id}`.
- **`Order.shops`** tells each shop's items and delivery choice; **`Order.step`** (`confirmed` → `preparing` → `delivered`) drives "Suivi". The gateway maps WooCommerce statuses to these steps.
- **Accounts are the website's accounts** (WordPress users). `POST /v1/accounts` creates a `customer` with the name, a phone (also the login name: the 10 local digits for an Ivorian number, the full digits otherwise) and the password; the e-mail is optional. `400 validation` if the phone or the e-mail already has an account. `orderId` (account offered after an order) is accepted and will link the order once orders exist.
- **Phone numbers** are digits with the country code and no `+`: Ivorian (`2250700000000`) or from another country (`447700900123`, 8 to 15 digits). People abroad type `+` or `00` and the country code; a number without it is read as Ivorian (app: `src/utils/phone.ts`; gateway: `Locappci_Accounts::phone()`).
- **Login** accepts a phone number typed any way (`07 08 09 10 11`, `+225…`, `00225…`) or an e-mail. It matches `billing_phone`; when two accounts share a number, only the e-mail works. **Administrators and shop managers cannot sign in through the app.**
- **Sessions**: the token is `userId.secret`; only a SHA-256 hash of the secret is stored (user meta `_locappci_app_tokens`). A session ends 90 days after its last use, on sign-out, when the password changes, or when a sixth phone signs in (the oldest ends). The app keeps the token in the phone's secure storage (`expo-secure-store`) and never stores the password.
- **`GET /v1/products?ids=a,b,c`** returns only those products, in that order (favourites). Unknown ids are skipped.
- **Login errors** use one message for "unknown account" and "wrong password" (`401 unauthorized`), so nobody can test which numbers have an account. After 5 wrong passwords for one identifier (or 30 from one address) in 15 minutes: `429 rate_limited`. Account creation: 5 per hour per address.
- **Account deletion** (required by Apple and Google): removes the WordPress customer and personal data; orders already placed stay with the shops for delivery and invoices. It needs the session **and** the password again. Seller, loueur and agency accounts are refused (`400 validation`): their shop depends on the account, the team removes those.
- **Payment v1 (no merchant accounts yet)**: Wave / Orange Money orders come back `pending_payment` with `transferTo` (the LOCAPPCI number and name, from the gateway settings). The customer transfers `total`, then sends the transaction reference → `awaiting_confirmation`. The team checks it in WordPress and sets `paid` (or `payment_failed`). With merchant accounts later, `paymentUrl` replaces `transferTo` (Feature 15).
- **Delivery price** depends on the distance between the shop and the delivery commune (`city`); `detail` shows "≈ 14 km · 24–48 h". The real tariff is to confirm with the client.
- **No cash on delivery** in v1 (client's answer); `cash` stays in the contract for later.
- **Deposits** are settled between the customer and the loueur; never in an order.
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
