<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * REST routes under /wp-json/locappci/v1. Read-only in this version.
 * The app's base URL is https://<site>/wp-json/locappci (it adds /v1/...).
 */
final class Locappci_Routes {
	const NS = 'locappci/v1';

	public static function register(): void {
		$public = '__return_true'; // Same data as the public shop pages.

		register_rest_route(self::NS, '/health', ['methods' => 'GET', 'callback' => [self::class, 'health'], 'permission_callback' => $public]);
		register_rest_route(self::NS, '/cities', ['methods' => 'GET', 'callback' => [self::class, 'cities'], 'permission_callback' => $public]);
		register_rest_route(self::NS, '/categories', ['methods' => 'GET', 'callback' => [self::class, 'categories'], 'permission_callback' => $public]);
		register_rest_route(self::NS, '/products', ['methods' => 'GET', 'callback' => [self::class, 'products'], 'permission_callback' => $public]);
		register_rest_route(self::NS, '/products/(?P<id>\d+)', ['methods' => 'GET', 'callback' => [self::class, 'product'], 'permission_callback' => $public]);
		register_rest_route(self::NS, '/products/(?P<id>\d+)/stock', ['methods' => 'GET', 'callback' => [self::class, 'stock'], 'permission_callback' => $public]);
		register_rest_route(self::NS, '/shops/(?P<id>\d+)', ['methods' => 'GET', 'callback' => [self::class, 'shop'], 'permission_callback' => $public]);
		register_rest_route(self::NS, '/cart/check', ['methods' => 'POST', 'callback' => [self::class, 'cart_check'], 'permission_callback' => $public]);
	}

	/** Quick check that the plugin answers and which plugins it found. */
	public static function health(): WP_REST_Response {
		return Locappci_Errors::no_cache(new WP_REST_Response([
			'ok'      => function_exists('wc_get_product'),
			'version' => LOCAPPCI_API_VERSION,
			'plugins' => [
				'woocommerce' => defined('WC_VERSION') ? WC_VERSION : null,
				'wcfm'        => function_exists('wcfm_get_vendor_id_by_post'),
				'rental'      => class_exists('RedQ_Rental_And_Bookings') || post_type_exists('inventory') || term_exists('redq_rental', 'product_type') !== null,
				'jwt'         => defined('SIMPLE_JWT_LOGIN_PLUGIN_PATH') || class_exists('SimpleJWTLogin\\Modules\\SimpleJWTLoginSettings'),
			],
		], 200));
	}

	public static function cities(): WP_REST_Response {
		return new WP_REST_Response(Locappci_Catalogue::cities(), 200);
	}

	public static function categories(WP_REST_Request $r): WP_REST_Response {
		$u = $r->get_param('universe');
		$u = in_array($u, ['vente', 'location'], true) ? $u : null;
		return new WP_REST_Response(Locappci_Catalogue::categories($u), 200);
	}

	public static function products(WP_REST_Request $r): WP_REST_Response {
		if (!function_exists('wc_get_product')) {
			return Locappci_Errors::response('unavailable', 'La boutique est momentanément indisponible.');
		}
		$q = [];
		foreach (['universe', 'city', 'category', 'search', 'min_price', 'max_price', 'sort', 'page', 'page_size', 'ids'] as $k) {
			$v = $r->get_param($k);
			if ($v !== null && $v !== '') {
				$q[$k] = is_string($v) ? wp_unslash($v) : $v;
			}
		}
		return new WP_REST_Response(Locappci_Catalogue::list($q), 200);
	}

	private static function published_product(int $id): ?WC_Product {
		$p = wc_get_product($id);
		return ($p && $p->get_status() === 'publish' && $p->get_catalog_visibility() !== 'hidden') ? $p : null;
	}

	public static function product(WP_REST_Request $r): WP_REST_Response {
		$p = self::published_product((int) $r['id']);
		return $p ? new WP_REST_Response(Locappci_Catalogue::detail($p), 200) : Locappci_Errors::not_found();
	}

	public static function shop(WP_REST_Request $r): WP_REST_Response {
		$shop = Locappci_Catalogue::shop((int) $r['id']);
		return $shop ? new WP_REST_Response($shop, 200) : Locappci_Errors::response('not_found', "Cette boutique n'existe plus.");
	}

	/** Live stock and price before "Ajouter au panier". Never cached. */
	public static function stock(WP_REST_Request $r): WP_REST_Response {
		$p = self::published_product((int) $r['id']);
		if (!$p) {
			return Locappci_Errors::not_found();
		}
		$shown = (int) $r->get_param('shown_price');
		$rental = Locappci_Catalogue::is_rental($p);
		$price = $rental ? Locappci_Catalogue::rental_fields($p)['pricePerDay'] : Locappci_Catalogue::price($p);
		$status = $rental ? 'in_stock' : Locappci_Catalogue::stock($p)['status'];
		return Locappci_Errors::no_cache(new WP_REST_Response([
			'productId'    => (string) $p->get_id(),
			'available'    => $status !== 'out_of_stock',
			'status'       => $status,
			'price'        => $price,
			'priceChanged' => $price !== $shown,
		], 200));
	}

	/**
	 * Whole cart before payment, one result per line, same order.
	 * Rental availability needs the rental plugin's calendar (Phase B): for now rentals are checked
	 * for existence, price and duration limits only.
	 */
	public static function cart_check(WP_REST_Request $r): WP_REST_Response {
		$lines = $r->get_json_params()['lines'] ?? null;
		if (!is_array($lines) || count($lines) > 100) {
			return Locappci_Errors::response('validation', 'Panier invalide.');
		}
		$results = [];
		foreach ($lines as $line) {
			$results[] = self::check_line(is_array($line) ? $line : []);
		}
		return Locappci_Errors::no_cache(new WP_REST_Response(['lines' => $results], 200));
	}

	private static function check_line(array $line): array {
		$id = (string) ($line['productId'] ?? '');
		$p = ctype_digit($id) ? self::published_product((int) $id) : null;
		if (!$p) {
			return ['productId' => $id, 'ok' => false, 'problem' => 'gone', 'price' => 0, 'priceChanged' => false];
		}

		if (isset($line['rental']) && is_array($line['rental'])) {
			if (!Locappci_Catalogue::is_rental($p)) {
				return ['productId' => $id, 'ok' => false, 'problem' => 'gone', 'price' => 0, 'priceChanged' => false];
			}
			$f = Locappci_Catalogue::rental_fields($p);
			$start = (string) ($line['rental']['startDate'] ?? '');
			$days = (int) ($line['rental']['days'] ?? 0);
			$base = [
				'productId'    => $id,
				'price'        => $f['pricePerDay'],
				'priceChanged' => $f['pricePerDay'] !== (int) ($line['rental']['shownPricePerDay'] ?? -1),
				'deposit'      => $f['deposit'],
			];
			$today = wp_date('Y-m-d'); // Site time zone: set it to Abidjan (GMT) in Réglages → Général.
			$valid_date = (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) && $start >= $today;
			if (!$valid_date || $days < $f['minDays'] || $days > $f['maxDays']) {
				return $base + ['ok' => false, 'problem' => 'invalid_dates'];
			}
			return $base + ['ok' => true];
		}

		$qty = (int) ($line['quantity'] ?? 0);
		$price = Locappci_Catalogue::price($p);
		$stock = Locappci_Catalogue::stock($p);
		$base = [
			'productId'    => $id,
			'price'        => $price,
			'priceChanged' => $price !== (int) ($line['shownPrice'] ?? -1),
			'maxQuantity'  => $stock['quantity'],
		];
		if ($qty < 1) {
			return $base + ['ok' => false, 'problem' => 'not_enough_stock'];
		}
		if ($stock['status'] === 'out_of_stock') {
			return array_merge($base, ['ok' => false, 'problem' => 'out_of_stock', 'maxQuantity' => 0]);
		}
		if ($stock['quantity'] !== null && $qty > $stock['quantity']) {
			return $base + ['ok' => false, 'problem' => 'not_enough_stock'];
		}
		return $base + ['ok' => true];
	}
}
