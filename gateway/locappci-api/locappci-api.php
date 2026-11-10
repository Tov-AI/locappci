<?php
/**
 * Plugin Name:       LOCAPPCI API
 * Description:       Passerelle entre l'appli mobile LOCAPPCI et le site (WooCommerce, WCFM, location). Lecture seule pour l'instant.
 * Version:           0.3.0
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
 * 0.3.0: products the site marks as waiting, refused or hidden (_locappci_validation_status,
 * _catalogue_visible, _public_visibility) are not shown; counts in the diagnostics page.
 * 0.3: shops read the site's own « locappci_boutique » record (logo, town, WhatsApp) and respect the
 * seller's WCFM store_hide_phone / store_hide_address switches.
 * Next: accounts (Simple JWT Login), then rental requests to loueurs, delivery and orders.
 */

if (!defined('ABSPATH')) {
	exit; // Never run outside WordPress.
}

define('LOCAPPCI_API_VERSION', '0.3.0');
define('LOCAPPCI_API_DIR', __DIR__);

require_once __DIR__ . '/includes/class-errors.php';
require_once __DIR__ . '/includes/class-catalogue.php';
require_once __DIR__ . '/includes/class-routes.php';
require_once __DIR__ . '/includes/class-admin.php';

add_action('rest_api_init', ['Locappci_Routes', 'register']);
add_action('admin_menu', ['Locappci_Admin', 'menu']);

// Any change to products, stock or shops clears the plugin's short caches.
foreach (['save_post_product', 'woocommerce_product_set_stock', 'woocommerce_variation_set_stock', 'profile_update', 'edited_product_cat', 'created_product_cat', 'delete_product_cat'] as $hook) {
	add_action($hook, ['Locappci_Catalogue', 'flush_cache']);
}
