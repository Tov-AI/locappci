# Handover: where the project is (8 November 2026)

Written by Leo for whoever continues the LOCAPPCI app. Read this first, then follow the links.
Everything here is in the repository; nothing depends on a conversation you weren't part of.

---

## 1. In one minute

- **The app** (Expo SDK 58, Expo Router, TypeScript) has every v1 screen built: Accueil, Recherche + Filtres,
  product detail (sale), rental detail, **Ma demande de location**, Panier, Paiement, Confirmation, Compte,
  Favoris, Mes commandes, Adresses, and loading / empty / error / offline states everywhere.
- **It runs on mock data by default** (`src/api/mock/`). Every screen talks to one interface,
  `src/api/contract.ts`. Point the app at the real site and the same screens use real data.
- **The gateway** is a WordPress plugin, **LOCAPPCI API** (`gateway/locappci-api`), that runs on locappci.fr itself.
  It is **read-only** today: catalogue, shops, stock, cart check, config. Orders, accounts and rental requests are not
  written to WordPress yet.
- **Plugin 0.1.1 is installed on the live site** (1 Nov). **Version 0.2 is in this branch, not installed yet.**
- **The next big piece of work is accounts (login with Simple JWT Login).** Sending rental requests to loueurs and
  creating real orders both depend on it. See section 8.

---

## 2. ⚠️ Branches: `main` is behind. Start from `feature/14-location-demande`

Each pull request was merged into **the previous feature branch**, not into `main`. So:

- `main` only contains **Feature 1** (theme, font, logo, 5 empty tabs). It does not show the real state of the app.
- **All the work** is on **`feature/14-location-demande`**, which contains every branch before it.

```
main ← #1 feature/01-foundation
         ← #2 02-components ← #3 03-data ← #4 04-accueil ← #5 05-recherche ← #6 06-produit
         ← #7 07-location ← #8 08-panier ← #9 09-paiement ← #10 10-confirmation ← #11 11-compte
         ← #12 12-states                                      (#2 to #12: merged into each other)
         ← #13 12b-client-answers   OPEN
         ← #14 13-gateway           OPEN
         ← #15 13b-site-diagnostics OPEN
         ← #16 14-location-demande  OPEN   ← the latest code, and this file
```

**Get the latest code:**

```bash
git clone https://github.com/Tov-AI/locappci.git
cd locappci
git checkout feature/14-location-demande
```

**To bring `main` up to date (do this together, it's a one-time decision):**
merge the open PRs in order, **#13 → #14 → #15 → #16**, each into its base, then open one PR
`feature/14-location-demande → main`. After that, follow CONTRIBUTING.md normally: new branches start from `main`.

> Naming note: in `docs/FEATURES.md` the rental-request work is row **13b**, but its branch is called
> `feature/14-location-demande`. Same work. Rows 14–16 in FEATURES.md (login, payment, push) are **not started**.

---

## 3. Run the app

```bash
npm install
npx expo start          # press a (Android), i (iOS), or scan the QR code with Expo Go
npm run typecheck       # must pass before every PR (it passes on this branch)
```

**Mock data (default):** no settings needed. Sample shops and products, a simulated transfer payment, test accounts.

**Real data from locappci.fr:** create a file `.env.local` (it is git-ignored) with:

```
EXPO_PUBLIC_API_URL=https://locappci.fr/wp-json/locappci
```

Then restart `npx expo start`. The switch is in `src/api/index.ts` (`usingMock` tells you which one is on).
With real data, browsing, product pages, shops, stock and cart check work. **Ordering, login, account creation,
reports and sending rental requests to loueurs will fail**, because the gateway doesn't have those endpoints yet.
Sending a rental request **by WhatsApp** works with real data (it only opens WhatsApp).

**Developer screens** (Compte tab, development builds only):
- **Voir les composants (dev)** → `/composants`: every UI component, to review on a real phone.
- **Voir les données (dev)** → `/donnees`: mock switches: force offline, slow network, "sold out / price changed at the
  next check", validate or refuse a transfer, create a test account, clear cart and favourites.

Real-phone testing so far was on an **OPPO A79** (Android, full-screen gestures), plus simulators.

---

## 4. Where things are

| Path | What lives there |
| --- | --- |
| `src/app/` | Screens. Every file is a route (Expo Router). `(tabs)/` = the 5 bottom tabs |
| `src/screens/` | Big screen bodies shared by routes (`SaleDetail`, `RentalDetail`) |
| `src/components/` | Reusable UI: `AppText`, `Screen`, `Button`, sheets, cards, toasts, states |
| `src/api/contract.ts` | **The API contract**: every type and call between app and gateway. Source of truth |
| `src/api/mock/` | Mock server + sample data (`server.ts`, `data.ts`) |
| `src/api/http.ts` | Real HTTP client for the gateway (10 s timeout, French error messages) |
| `src/data/` | Cache (TanStack Query persisted on AsyncStorage), cart, favourites, account, orders, rental request list, online status |
| `src/theme/tokens.ts` | Colours, type scale, spacing, radius. Never hard-code these |
| `src/utils/` | Dates (Côte d'Ivoire = GMT), FCFA formatting, phone numbers (`225` + 10 digits) |
| `src/config.ts` | Support WhatsApp, website, legal URL, app version |
| `gateway/locappci-api/` | The WordPress plugin (PHP) |
| `gateway/tests/` | End-to-end test: the app's own HTTP client against the plugin on a local WordPress |
| `docs/` | See below |

**Docs to read, in this order:**

1. `CONTRIBUTING.md`: how we work (one feature = one branch = one PR, `wip:` commits when handing over mid-feature).
2. `docs/FEATURES.md`: roadmap, status, and every **client answer** so far.
3. `docs/SITE-MAP.md`: what is really on locappci.fr (custom content types, how Location works). Important.
4. `docs/API.md`: every endpoint and the behaviour the app relies on.
5. `docs/DECISIONS.md`: one line per decision with the reason. Check it before changing how something works.
6. `docs/GATEWAY.md`: how to install or update the plugin on the site (in French UI terms).
7. `AGENTS.md`: rules for AI coding assistants (and a good summary of the project rules).

---

## 5. What is done, feature by feature

| # | Feature | Notes |
| --- | --- | --- |
| 1 | Foundation | Tokens, DM Sans (stand-in font), logo, 5 tabs |
| 2 | Components | Buttons, cards, chips, option cards, bottom sheet, badges, offline banner, skeletons, toast |
| 3 | Data layer | Contract, mock, persisted cache (fresh 5 min, kept 24 h, offline-first), favourites |
| 4 | Accueil | Commune chip (asked once at first launch), universes, product grid |
| 5 | Recherche | Search after 300 ms, filters sheet with live count, recent searches |
| 6 | Produit (sale) | Live stock check before "Ajouter au panier", WhatsApp seller, "Signaler" |
| 7 | Location détail | Now request-based (see 13b): start day, duration, quantity, commune |
| 8 | Panier | Grouped by shop, live check of the whole cart before paying |
| 9 | Paiement | Delivery per shop (priced by distance, sample tariff), Wave / Orange Money **transfer + reference** |
| 10 | Confirmation | Tracking, account offer, notification soft ask |
| 11 | Compte | Favoris, Mes commandes (saved on the phone), Adresses, login sheet, delete account |
| 12 | States | Offline, no connection, error, crash screen, "Page introuvable" |
| 12b | Client answers round 1 | Transfer payment, distance delivery, no cash on delivery |
| 13 | Gateway 0.1 → 0.2 | Read-only plugin, diagnostics page, communes and WhatsApp editable in **Outils → LOCAPPCI API** |
| 13b | Location par demande | "Ajouter à ma demande" → "Ma demande de location" → send to loueurs (account needed) or WhatsApp LOCAPPCI. Rentals removed from cart and payment |

All of these pass `tsc`, were tested in the browser at 360 px, and the sale flow and rental flow were tested end to end
on mock data. Each PR description (#2 to #16) lists exactly what was tested.

---

## 6. The gateway (WordPress plugin)

- Lives inside locappci.fr (Hostinger). No separate server. WooCommerce keys never reach the app.
- **0.2 endpoints:** `health`, `config`, `cities`, `categories`, `products` (list, `ids`, detail, `stock`), `shops`,
  `cart/check`. `rental-requests` answers `401` on purpose until accounts exist.
- **Install / update:** `docs/GATEWAY.md`. Make a Hostinger backup first. Update = upload the new zip,
  choose "Remplacer la version installée".
- **Check it:** open `https://locappci.fr/wp-json/locappci/v1/health`. The `version` field shows what's installed.
- **Test it locally:** `gateway/tests/README.md` (WordPress + WooCommerce on SQLite, then `contract.test.js`
  → `ALL GATEWAY CONTRACT TESTS PASSED`).
- **Customisable without code:** `locappci_*` WordPress filters (`locappci_rental_fields`, `locappci_is_supported`).

---

## 7. What the real site looks like (short version of `docs/SITE-MAP.md`)

- The site runs on **its own custom code** (87 Code Snippets + probably the child theme) on top of WooCommerce and WCFM.
- The rental plugin (RnB) is installed but **not used**. Rental items are **WooCommerce products in the `location`
  category**, with `_locappci_location_*` fields.
- **Renting is by request:** the customer sends a list; the loueur confirms availability and price. Nothing is paid
  online for rentals. The app now works the same way.
- Many universes (Immobilier, Services, Emploi, Annonces, Podcasts, Musique) are **separate content types**, not
  WooCommerce products. The app only covers **Vente** and **Location** for now.
- Downloadable products (songs) are hidden from the app on purpose.

---

## 8. Next steps, in order

1. **Merge the PR chain into `main`** (section 2) and install **plugin 0.2** on the site (`docs/GATEWAY.md`).
   Check `/health` says `0.2.0`, then set the WhatsApp number in Outils → LOCAPPCI API.
2. **Gateway: only show validated, visible products.** Products have `_locappci_validation_status = validee`,
   `_locappci_catalogue_visible = yes`, `_locappci_public_visibility = visible`. **Not filtered yet in 0.2.**
   This matters before anyone uses the app with real data.
3. **Gateway: read shops from the `locappci_boutique` record** (logo, city, WhatsApp, status) and respect WCFM's
   `store_hide_phone` / `store_hide_address`. Today it reads WCFM settings only.
4. **Feature 14: login with WordPress accounts** (Simple JWT Login is already installed on the site).
   Contract: `POST /v1/session`, `POST /v1/accounts`, `POST /v1/accounts/delete`. The app's login sheet and
   "Supprimer mon compte" already exist against the mock.
5. **Rental requests to loueurs:** `POST /v1/rental-requests` writes `locappci_loc_req` records, the same ones the
   website creates (fields `_locappci_req_*`, linked to the product's author). Rules in `docs/API.md`.
6. **Orders:** `GET /v1/delivery-options`, `POST /v1/orders` (idempotent, re-checks the cart, `409 cart_changed`),
   `GET /v1/orders/{id}`, `POST /v1/orders/{id}/payment-reference`. The team validates transfers in WordPress.
7. **Reports:** `POST /v1/products/{id}/reports` (email to the admin is enough at first).
8. Later and blocked on the client: **Feature 15** Wave / Orange Money hand-off (needs merchant accounts),
   **Feature 16** push notifications (needs a development build; must ask permission of people who said
   "Oui, me prévenir").

**Rule for every step:** if a shape changes, edit `contract.ts` + `docs/API.md` + the mock in the same PR, bump
`buster` in `src/data/queryClient.ts`, and both of us approve.

---

## 9. Open questions for the client

Leo relays these to the client. Answers so far are at the bottom of `docs/FEATURES.md`.

- The LOCAPPCI **Wave / Orange Money numbers** that receive transfers (the app shows a sample one).
- The real **delivery tariff** (sample: 1 000 FCFA + 150 FCFA/km).
- **Late-return penalty** amounts.
- **Support WhatsApp:** the client said +44 7748 039794, but the site's code uses 225 07 88 72 73 19. To confirm.
- **Other universes** (Immobilier, Services, Emploi…): in v1 or later?
- **Music / downloads** in the app?
- **Seller tools** ("Ma boutique") in v1 or v1.1?
- **Brand font and official colours** (DM Sans and colours measured from the logo are stand-ins).
- **Terms / privacy page URL** (`src/config.ts` points to the home page for now).

---

## 10. Things that are not in the repo (ask Leo)

- **Design documents:** design brief, design handoff v1, design canvas "LOCAPPCI — Core screens v1".
  The screens were built from the handoff, so you'll want it before changing any UI.
- **Access:** WordPress admin for locappci.fr, Hostinger. Credentials are never stored in the repo.
- The **Code Snippets export** from the site (used to write `docs/SITE-MAP.md`).

---

## 11. Small things worth knowing

- The phone cache uses **AsyncStorage**, not MMKV, so the app runs in Expo Go. Moving to MMKV later touches only
  `src/data/storage.ts` (and needs a development build).
- `docs/FEATURES.md` still says "In review" for 1–12 because they were never merged into `main`. Update the statuses
  when the chain is merged.
- All interface text is **French**. Use `AppText` (never `<Text>`) and `Screen` on every screen.
- Install packages with `npx expo install <package>`, never `npm install <package>`.
- Expo changes often: check the SDK 58 docs before using an Expo API (see `AGENTS.md`).
