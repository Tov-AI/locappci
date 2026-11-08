<?php
/** TEST ONLY: stands in for WooCommerce Booking & Rental (RnB), which is a paid plugin. */
add_action('init', function () {
	if (!term_exists('redq_rental', 'product_type')) wp_insert_term('redq_rental', 'product_type');
});
add_action('woocommerce_loaded', function () {
	class WC_Product_Redq_Rental extends WC_Product_Simple { public function get_type() { return 'redq_rental'; } }
});
add_filter('product_type_selector', fn($t) => $t + ['redq_rental' => 'Rental']);
