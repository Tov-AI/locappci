# Gateway tests

End-to-end test of the **LOCAPPCI API** plugin with the **app's own HTTP client** (`src/api/http.ts`),
on a local WordPress + WooCommerce (SQLite, no MySQL needed). It checks every endpoint against
the shapes in `src/api/contract.ts`.

What it covers: cities, categories (universe per category), product list (universe, category with
sub-categories, search, price range, sorts, "nearest" pagination across local and other shops, ids,
hidden products), product detail (sale and rental), shops (WCFM-style settings, WhatsApp numbers),
live stock check, whole-cart check (ok, not enough stock, sold out, gone, rental dates).

## Run it

Needs PHP 8 with `pdo_sqlite`, Node 20+, git.

1. WordPress 6.8 + the SQLite drop-in (`WordPress/sqlite-database-integration` v2.2) + WooCommerce 9.9
   (`woocommerce.zip` from the GitHub release), installed with WP-CLI.
2. `fake-rnb.php` → `wp-content/mu-plugins/` (stands in for the paid rental plugin: product type `redq_rental`).
3. Link `gateway/locappci-api` into `wp-content/plugins/`, activate it, set the timezone to `Africa/Abidjan`,
   pretty permalinks (`/%postname%/`).
4. `wp eval-file seed.php` (3 shops, 5 products + 1 hidden).
5. Serve: `php -S 127.0.0.1:8098 -t <site> router.php` (put `router.php` next to the `site/` folder).
6. Compile the app's client: `tsc` on `src/api/http.ts` to CommonJS (paths `@/*` → `src/*`), output in `OUT_DIR`.
7. `OUT_DIR=… API_URL=http://127.0.0.1:8098/wp-json/locappci/ node contract.test.js`
   → `ALL GATEWAY CONTRACT TESTS PASSED`.
