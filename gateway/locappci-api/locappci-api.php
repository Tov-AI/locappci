<?php
/**
 * Plugin Name:       LOCAPPCI API
 * Description:       Passerelle entre l'appli mobile LOCAPPCI et le site (WooCommerce, WCFM, location). Lecture seule pour l'instant.
 * Version:           0.1.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            LOCAPPCI
 * Text Domain:       locappci-api
 *
 * The app talks only to these endpoints (namespace locappci/v1). They return exactly the
 * shapes of src/api/contract.ts in the app repository. See docs/API.md.
 *
 * Phase A (this version): catalogue, shops, stock and cart checks, health, admin diagnostics.
 * Phase B: rental calendar, delivery, orders, accounts (after the diagnostics confirm how the
 * rental and marketplace plugins store their data on the real site).
 */

if (!defined('ABSPATH')) {
	exit; // Never run outside WordPress.
}

define('LOCAPPCI_API_VERSION', '0.1.0');
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
