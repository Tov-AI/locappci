<?php
/**
 * Plugin Name:       LOCAPPCI API
 * Description:       Passerelle entre l'appli mobile LOCAPPCI et le site (WooCommerce, WCFM, location). Lecture seule, sauf les comptes clients et les demandes de location envoyées aux loueurs.
 * Version:           0.11.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            LOCAPPCI
 * Text Domain:       locappci-api
 *
 * The app talks only to these endpoints (namespace locappci/v1). They return exactly the
 * shapes of src/api/contract.ts in the app repository. See docs/API.md.
 *
 * 0.2: catalogue (rentals = the site's "location" category, downloads left out), shops, stock and
 * cart checks, app settings (WhatsApp), health, admin diagnostics. Still read-only.
 * 0.2.3: products the site marks as waiting, refused or hidden (_locappci_validation_status,
 * _catalogue_visible, _public_visibility) are not shown; counts in the diagnostics page.
 * 0.3: shops read the site's own « locappci_boutique » record (logo, town, WhatsApp) and respect the
 * seller's WCFM store_hide_phone / store_hide_address switches.
 * 0.4: customer accounts for the app (sign in with the website's account by phone or e-mail, create,
 * sign out, delete). First version that writes to the site: it creates and deletes customer users.
 * 0.4.1: products for sale without a price (0 FCFA, e.g. a service posted as a product) are not listed.
 * 0.5: « Envoyer aux loueurs »: POST /v1/rental-requests writes the website's own locappci_loc_req records.
 * 0.5.1: phone numbers from other countries are accepted (accounts, login, rental requests).
 * 0.5.2: rental quantity up to 10 000 (was 99); the app no longer stops at 20.
 * 0.6.0: GET /v1/delivery-options (home delivery priced by distance, tariff in Outils → LOCAPPCI API; pickup).
 * 0.7.0: orders: POST /v1/orders (real WooCommerce orders), GET /v1/orders/{id}, POST …/payment-reference;
 *        transfer number in Outils → LOCAPPCI API (section 5).
 * 0.8.0: « Signaler cette annonce »: POST /v1/products/{id}/reports, e-mailed to the team and listed in section 6.
 * 0.9.0: section 7 of Outils → LOCAPPCI API sets each shop's commune (delivery price, pickup, commune filter).
 * 0.10.0: marketplace rules: seller contacts hidden (shown once the buyer has a paid order with the shop),
 *         commission % and contact fee in section 8, delivery « à convenir avec le vendeur » or pickup.
 * 0.11.0: « Obtenir les coordonnées »: POST /v1/contact-unlocks (+ GET, payment-reference), fee of section 8.
 * Next: Wave / Orange Money hand-off and push notifications (waiting on the client).
 */

if (!defined('ABSPATH')) {
	exit; // Never run outside WordPress.
}

define('LOCAPPCI_API_VERSION', '0.11.0');
define('LOCAPPCI_API_DIR', __DIR__);

require_once __DIR__ . '/includes/class-errors.php';
require_once __DIR__ . '/includes/class-catalogue.php';
require_once __DIR__ . '/includes/class-accounts.php';
require_once __DIR__ . '/includes/class-rental-requests.php';
require_once __DIR__ . '/includes/class-delivery.php';
require_once __DIR__ . '/includes/class-orders.php';
require_once __DIR__ . '/includes/class-reports.php';
require_once __DIR__ . '/includes/class-marketplace.php';
require_once __DIR__ . '/includes/class-contacts.php';
require_once __DIR__ . '/includes/class-routes.php';
require_once __DIR__ . '/includes/class-admin.php';

add_action('rest_api_init', ['Locappci_Routes', 'register']);
add_action('admin_menu', ['Locappci_Admin', 'menu']);

// A new password (reset or changed) ends the app sessions of that account.
add_action('after_password_reset', ['Locappci_Accounts', 'forget_sessions']);
add_action('wp_set_password', function ($password, $user_id) { Locappci_Accounts::forget_sessions($user_id); }, 10, 2);
// The app's session header, for browsers (web preview): native apps don't need CORS.
add_filter('rest_allowed_cors_headers', function ($headers) { $headers[] = 'X-Locappci-Token'; return $headers; });

// Any change to products, stock or shops clears the plugin's short caches.
foreach (['save_post_product', 'woocommerce_product_set_stock', 'woocommerce_variation_set_stock', 'profile_update', 'edited_product_cat', 'created_product_cat', 'delete_product_cat'] as $hook) {
	add_action($hook, ['Locappci_Catalogue', 'flush_cache']);
}
