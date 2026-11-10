# LOCAPPCI API (WordPress plugin)

The gateway between the mobile app and locappci.fr. It runs **inside the WordPress site** (no extra
server), reads WooCommerce, WCFM (shops) and the rental plugin, and answers the app in the exact
shapes of `src/api/contract.ts`. Endpoints and rules: `docs/API.md`. Install: `docs/GATEWAY.md`.

- `locappci-api.php`: plugin header, loads the parts, clears caches when products or shops change
- `includes/class-catalogue.php`: WooCommerce / WCFM / rental data → app shapes (adjustable with `locappci_*` filters)
- `includes/class-routes.php`: REST routes `/wp-json/locappci/v1/…`
- `includes/class-errors.php`: errors as `{ code, message }` in French; no-cache headers for live answers
- `includes/class-admin.php`: Outils → LOCAPPCI API (diagnostics, communes)
- `tests/`: end-to-end contract test with the app's own HTTP client

**Version 0.3.0 is still read-only.** Shops come from the site's `locappci_boutique` record when it is validated
(`Locappci_Catalogue::boutique_id()`), then from WCFM; `store_hide_phone` / `store_hide_address` are respected. It hides products the site marks as waiting, refused or hidden
(`Locappci_Catalogue::is_approved()`, adjustable with the `locappci_approval_fields` and `locappci_is_approved` filters). It never writes products, orders or users. Rental items are the products of
the site's `location` category (see `docs/SITE-MAP.md`); downloads are left out; `GET /v1/config` gives the app the
LOCAPPCI WhatsApp number set in Outils → LOCAPPCI API. Next: accounts (Simple JWT Login), then rental requests to
loueurs (`locappci_loc_req`, same records as the website), delivery and orders.
