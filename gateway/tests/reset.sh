#!/bin/bash
# Fresh WordPress + WooCommerce + LOCAPPCI plugin + seed (SQLite). Prints the seed ids.
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${WP_DIR:-$HOME/wp}"
W="php wp-cli.phar --allow-root --path=site"
rm -f site/wp-content/database/.ht.sqlite
$W core install --url=http://127.0.0.1:8098 --title=LOCAPPCI --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email >/dev/null 2>&1
$W plugin activate woocommerce locappci-api >/dev/null 2>&1
$W option update timezone_string Africa/Abidjan >/dev/null
$W rewrite structure '/%postname%/' --quiet
$W eval-file "$HERE/seed.php" 2>/dev/null | tail -1
