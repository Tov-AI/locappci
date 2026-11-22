#!/bin/bash
# Sellers end to end: reset, « Devenir vendeur », owner validates, « Mes articles », owner validates an article.
cd "$(dirname "$0")"
WP="php "${WP_DIR:-$HOME/wp}/wp-cli.phar" --allow-root --path="${WP_DIR:-$HOME/wp}/site""
./reset.sh > /tmp/ids.json
OUT_DIR=/tmp/out timeout 100 node sellers.test.js 1 | tail -1
ID=$($WP eval 'echo Locappci_Sellers::pending()[0]->ID;')
$WP eval "wp_set_current_user(1); \$_POST=['id'=>$ID,'decision'=>'approve','_wpnonce'=>wp_create_nonce('locappci_seller_$ID')]; \$_REQUEST=\$_POST; add_filter('wp_redirect', function(\$l){ throw new Exception('stop'); }); try { Locappci_Sellers::decide(); } catch (Exception \$e) {}" >/dev/null 2>&1
OUT_DIR=/tmp/out timeout 100 node seller-products.test.js notseller 2>&1 | tail -1
OUT_DIR=/tmp/out timeout 200 node seller-products.test.js 1 2>&1 | grep -E "OK|FAIL|test.js:[0-9]+" | head -3
PID=$(python3 -c "import json;print(json.load(open('/tmp/sp.json'))['id'])")
$WP eval "wp_set_current_user(1); \$_POST=['id'=>$PID,'decision'=>'approve','_wpnonce'=>wp_create_nonce('locappci_product_$PID')]; \$_REQUEST=\$_POST; add_filter('wp_redirect', function(\$l){ throw new Exception('stop'); }); try { Locappci_Seller_Products::decide(); } catch (Exception \$e) {}" >/dev/null 2>&1
OUT_DIR=/tmp/out timeout 200 node seller-products.test.js 2 2>&1 | grep -E "OK|FAIL|test.js:[0-9]+|actual|expected" | head -6
