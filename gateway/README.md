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

**Version 0.1 is read-only.** It never writes products, orders or users. Rental calendar, delivery,
orders, payment references and accounts come in 0.2, once the diagnostics show how the rental and
marketplace plugins store their data on the real site.
