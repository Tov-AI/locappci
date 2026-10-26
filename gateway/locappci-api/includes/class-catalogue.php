<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Turns WooCommerce / WCFM / rental-plugin data into the app's shapes (src/api/contract.ts).
 * Everything that depends on how a plugin stores data goes through a filter
 * ("locappci_…"), so it can be adjusted without touching the rest.
 */
final class Locappci_Catalogue {
	/** Abidjan communes, used until the client confirms the list (Outils → LOCAPPCI API can override). */
	const DEFAULT_CITIES = [
		'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi',
		'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon',
	];

	const CACHE_GROUP = 'locappci';

	// ---------------------------------------------------------------- cities

	/** @return array<int, array{id: string, name: string, region: string}> */
	public static function cities(): array {
		$names = get_option('locappci_cities');
		if (!is_array($names) || !$names) {
			$names = self::DEFAULT_CITIES;
		}
		$region = get_option('locappci_region', 'Abidjan');
		return array_map(
			fn($name) => ['id' => self::city_id($name), 'name' => $name, 'region' => $region],
			$names
		);
	}

	/** "Port-Bouët" → "port-bouet": same id whatever the accents or case. */
	public static function city_id(string $name): string {
		return sanitize_title(remove_accents(trim($name)));
	}

	/** A free-text city typed by a seller ("cocody riviera") → a known commune id, or ''. */
	public static function match_city(string $text): string {
		$slug = self::city_id($text);
		if ($slug === '') {
			return '';
		}
		foreach (self::cities() as $c) {
			if ($slug === $c['id'] || strpos($slug, $c['id']) !== false) {
				return $c['id'];
			}
		}
		return '';
	}

	// ---------------------------------------------------------------- products

	/** Product types sold as rentals (the WooCommerce Booking & Rental plugin uses "redq_rental"). */
	public static function rental_types(): array {
		return apply_filters('locappci_rental_types', ['redq_rental']);
	}

	public static function is_rental(WC_Product $p): bool {
		// Product class type, and the product_type term as a fallback (if the rental plugin is off).
		return in_array($p->get_type(), self::rental_types(), true)
			|| has_term(self::rental_types(), 'product_type', $p->get_id());
	}

	/** Seller of a product: WCFM's own lookup when available, else the post author. */
	public static function vendor_id(WC_Product $p): int {
		$id = 0;
		if (function_exists('wcfm_get_vendor_id_by_post')) {
			$id = (int) wcfm_get_vendor_id_by_post($p->get_id());
		}
		if (!$id) {
			$id = (int) get_post_field('post_author', $p->get_id());
		}
		return (int) apply_filters('locappci_vendor_id', $id, $p);
	}

	public static function price(WC_Product $p): int {
		return (int) round((float) $p->get_price());
	}

	/** Price per day, deposit and min/max days of a rental. Keys to confirm on the real site (diagnostics). */
	public static function rental_fields(WC_Product $p): array {
		$id = $p->get_id();
		$num = function ($keys, $default) use ($id) {
			foreach ((array) $keys as $k) {
				$v = get_post_meta($id, $k, true);
				if ($v !== '' && $v !== null && is_numeric($v)) {
					return (float) $v;
				}
			}
			return $default;
		};
		$fields = [
			'pricePerDay' => (int) round($num(['general_price', '_price'], (float) $p->get_price())),
			'deposit'     => (int) round($num(['_locappci_deposit', 'redq_security_deposit'], 0)),
			'minDays'     => max(1, (int) $num(['redq_min_rental_days', '_locappci_min_days'], 1)),
			'maxDays'     => max(1, (int) $num(['redq_max_rental_days', '_locappci_max_days'], 30)),
		];
		if ($fields['maxDays'] < $fields['minDays']) {
			$fields['maxDays'] = $fields['minDays'];
		}
		return apply_filters('locappci_rental_fields', $fields, $p);
	}

	/** in_stock / low_stock / out_of_stock, like the app expects. */
	public static function stock(WC_Product $p): array {
		$qty = $p->managing_stock() ? (int) $p->get_stock_quantity() : null;
		if (!$p->is_in_stock() || ($qty !== null && $qty <= 0 && !$p->backorders_allowed())) {
			return ['status' => 'out_of_stock', 'quantity' => 0];
		}
		$low = (int) get_option('woocommerce_notify_low_stock_amount', 2);
		$status = ($qty !== null && $qty <= max(1, $low)) ? 'low_stock' : 'in_stock';
		return ['status' => $status, 'quantity' => $qty];
	}

	/** Main category id as a string (the app compares ids as strings). */
	public static function category_id(WC_Product $p): string {
		$ids = $p->get_category_ids();
		return $ids ? (string) $ids[0] : '';
	}

	/** @return string[] Image URLs, cover first. */
	public static function images(WC_Product $p): array {
		$ids = array_filter(array_merge([$p->get_image_id()], $p->get_gallery_image_ids()));
		$urls = [];
		foreach ($ids as $aid) {
			$u = wp_get_attachment_image_url((int) $aid, 'large');
			if ($u) {
				$urls[] = $u;
			}
		}
		return array_values(array_unique($urls));
	}

	public static function summary(WC_Product $p): array {
		$rental = self::is_rental($p);
		$shop = self::shop(self::vendor_id($p));
		$images = self::images($p);
		return [
			'id'          => (string) $p->get_id(),
			'universe'    => $rental ? 'location' : 'vente',
			'name'        => html_entity_decode($p->get_name(), ENT_QUOTES, 'UTF-8'),
			'coverUrl'    => $images[0] ?? null,
			'categoryId'  => self::category_id($p),
			'price'       => $rental ? self::rental_fields($p)['pricePerDay'] : self::price($p),
			'cityId'      => $shop ? $shop['cityId'] : '',
			'shopName'    => $shop ? $shop['name'] : '',
			'stockStatus' => $rental ? null : self::stock($p)['status'],
		];
	}

	public static function detail(WC_Product $p): array {
		$s = self::summary($p);
		$base = [
			'id'          => $s['id'],
			'universe'    => $s['universe'],
			'name'        => $s['name'],
			'description' => self::plain_text($p->get_description() ?: $p->get_short_description()),
			'images'      => self::images($p),
			'categoryId'  => $s['categoryId'],
			'shopId'      => (string) self::vendor_id($p),
			'cityId'      => $s['cityId'],
			'webUrl'      => get_permalink($p->get_id()),
			'updatedAt'   => self::iso($p->get_date_modified()),
		];
		if ($s['universe'] === 'location') {
			return array_merge($base, self::rental_fields($p));
		}
		return array_merge($base, ['price' => self::price($p), 'stock' => self::stock($p)]);
	}

	/** Shop descriptions are HTML in WordPress; the app shows plain text. */
	public static function plain_text(string $html): string {
		$text = wp_strip_all_tags(str_replace(['<br>', '<br/>', '<br />', '</p>'], "\n", $html));
		$text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
		return trim(preg_replace("/\n{3,}/", "\n\n", $text));
	}

	public static function iso($date): string {
		return $date ? $date->date('Y-m-d\TH:i:s\Z') : gmdate('Y-m-d\TH:i:s\Z');
	}

	// ---------------------------------------------------------------- shops

	/** Shop of a vendor (WCFM store settings first, then the WordPress user). null if no such user. */
	public static function shop(int $vendor_id): ?array {
		if ($vendor_id <= 0) {
			return null;
		}
		$cache_key = 'shop_' . $vendor_id;
		$cached = wp_cache_get($cache_key, self::CACHE_GROUP);
		if (is_array($cached)) {
			return $cached;
		}
		$user = get_userdata($vendor_id);
		if (!$user) {
			return null;
		}
		$settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
		$settings = is_array($settings) ? $settings : [];

		$name = function_exists('wcfm_get_vendor_store_name') ? (string) wcfm_get_vendor_store_name($vendor_id) : '';
		$name = $name ?: ($settings['store_name'] ?? '') ?: $user->display_name;
		$phone = ($settings['phone'] ?? '') ?: get_user_meta($vendor_id, 'billing_phone', true);
		$city = ($settings['address']['city'] ?? '') ?: get_user_meta($vendor_id, 'billing_city', true);

		$shop = [
			'id'       => (string) $vendor_id,
			'name'     => html_entity_decode(wp_strip_all_tags((string) $name), ENT_QUOTES, 'UTF-8'),
			'initials' => self::initials((string) $name),
			'logoUrl'  => self::logo_url($settings),
			'cityId'   => self::match_city((string) $city),
			'whatsapp' => self::whatsapp((string) $phone),
			'role'     => self::vendor_has_rentals($vendor_id) ? 'loueur' : 'vendeur',
		];
		$shop = apply_filters('locappci_shop', $shop, $vendor_id, $settings);
		wp_cache_set($cache_key, $shop, self::CACHE_GROUP, 300);
		return $shop;
	}

	public static function initials(string $name): string {
		$words = preg_split('/\s+/u', trim(wp_strip_all_tags($name))) ?: [];
		$letters = '';
		foreach (array_slice(array_filter($words), 0, 2) as $w) {
			$letters .= mb_strtoupper(mb_substr($w, 0, 1));
		}
		return $letters ?: '?';
	}

	private static function logo_url(array $settings): ?string {
		$logo = $settings['gravatar'] ?? ($settings['logo'] ?? '');
		if (is_numeric($logo) && (int) $logo > 0) {
			$u = wp_get_attachment_image_url((int) $logo, 'thumbnail');
			return $u ?: null;
		}
		return (is_string($logo) && strpos($logo, 'http') === 0) ? $logo : null;
	}

	/**
	 * Phone typed by a seller → digits with country code for wa.me, or null.
	 * "07 00 00 00 00" → "2250700000000"; "+44 7748 039794" → "447748039794".
	 */
	public static function whatsapp(string $phone): ?string {
		$digits = preg_replace('/\D+/', '', $phone);
		if (strpos($digits, '00') === 0) {
			$digits = substr($digits, 2);
		}
		if (strlen($digits) === 10 && $digits[0] === '0') {
			$digits = '225' . $digits; // Ivorian number written locally.
		}
		return strlen($digits) >= 10 ? $digits : null;
	}

	private static function vendor_has_rentals(int $vendor_id): bool {
		$q = new WP_Query([
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'author'         => $vendor_id,
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'no_found_rows'  => true,
			'tax_query'      => [['taxonomy' => 'product_type', 'field' => 'slug', 'terms' => self::rental_types()]],
		]);
		return !empty($q->posts);
	}

	/** Vendors whose shop is in a commune (for the city filter and "Plus proches"). */
	public static function vendors_in_city(string $city_id): array {
		$key = 'vendors_city_' . $city_id;
		$ids = wp_cache_get($key, self::CACHE_GROUP);
		if (is_array($ids)) {
			return $ids;
		}
		$authors = get_users(['has_published_posts' => ['product'], 'fields' => 'ID', 'number' => 2000]);
		$ids = [];
		foreach ($authors as $uid) {
			$shop = self::shop((int) $uid);
			if ($shop && $shop['cityId'] === $city_id) {
				$ids[] = (int) $uid;
			}
		}
		wp_cache_set($key, $ids, self::CACHE_GROUP, 300);
		return $ids;
	}

	// ---------------------------------------------------------------- categories

	public static function categories(?string $universe): array {
		// Working out each category's universe takes two queries per category: keep the answer 1 hour.
		$key = 'locappci_categories_' . ($universe ?: 'all');
		$cached = get_transient($key);
		if (is_array($cached)) {
			return $cached;
		}
		$terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => true]);
		if (is_wp_error($terms)) {
			return [];
		}
		$out = [];
		foreach ($terms as $t) {
			if ($t->slug === 'uncategorized' || $t->slug === 'non-classe') {
				continue;
			}
			$u = self::category_universe($t);
			if ($universe && $u !== $universe) {
				continue;
			}
			$out[] = [
				'id'       => (string) $t->term_id,
				'name'     => html_entity_decode($t->name, ENT_QUOTES, 'UTF-8'),
				'universe' => $u,
				'parentId' => $t->parent ? (string) $t->parent : null,
			];
		}
		set_transient($key, $out, HOUR_IN_SECONDS);
		return $out;
	}

	/** A category is "location" when most of its products are rentals. */
	private static function category_universe(WP_Term $t): string {
		$count = function (array $types, bool $exclude) use ($t) {
			$q = new WP_Query([
				'post_type'      => 'product',
				'post_status'    => 'publish',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'tax_query'      => [
					'relation' => 'AND',
					['taxonomy' => 'product_cat', 'terms' => [$t->term_id]],
					['taxonomy' => 'product_type', 'field' => 'slug', 'terms' => $types, 'operator' => $exclude ? 'NOT IN' : 'IN'],
				],
			]);
			return (int) $q->found_posts;
		};
		$rentals = $count(self::rental_types(), false);
		$sales = $count(self::rental_types(), true);
		return $rentals > $sales ? 'location' : 'vente';
	}

	// ---------------------------------------------------------------- listing

	/**
	 * Products for the app's ProductQuery: universe, city, category (with sub-categories), search,
	 * min/max price, sort (nearest | price_asc | newest), page, page_size, ids.
	 */
	public static function list(array $q): array {
		$page = max(1, (int) ($q['page'] ?? 1));
		$size = min(50, max(1, (int) ($q['page_size'] ?? 20)));
		$sort = in_array($q['sort'] ?? '', ['nearest', 'price_asc', 'newest'], true) ? $q['sort'] : 'nearest';

		$args = [
			'post_type'   => 'product',
			'post_status' => 'publish',
			'tax_query'   => ['relation' => 'AND'],
			'meta_query'  => ['relation' => 'AND'],
		];
		// Hidden from the catalogue in WooCommerce → hidden in the app too.
		$args['tax_query'][] = ['taxonomy' => 'product_visibility', 'field' => 'name', 'terms' => ['exclude-from-catalog'], 'operator' => 'NOT IN'];

		if (!empty($q['ids'])) {
			$ids = array_values(array_filter(array_map('intval', explode(',', (string) $q['ids']))));
			$args['post__in'] = $ids ?: [0];
			$args['orderby'] = 'post__in';
		}
		if (($q['universe'] ?? '') === 'location' || ($q['universe'] ?? '') === 'vente') {
			$args['tax_query'][] = [
				'taxonomy' => 'product_type',
				'field'    => 'slug',
				'terms'    => self::rental_types(),
				'operator' => $q['universe'] === 'location' ? 'IN' : 'NOT IN',
			];
		}
		if (!empty($q['category'])) {
			// include_children is WordPress's default: a parent category finds its sub-categories' products.
			$args['tax_query'][] = ['taxonomy' => 'product_cat', 'terms' => [(int) $q['category']]];
		}
		if (!empty($q['search'])) {
			$args['s'] = sanitize_text_field((string) $q['search']);
		}
		if (isset($q['min_price']) && $q['min_price'] !== '') {
			$args['meta_query'][] = ['key' => '_price', 'value' => (float) $q['min_price'], 'compare' => '>=', 'type' => 'NUMERIC'];
		}
		if (isset($q['max_price']) && $q['max_price'] !== '') {
			$args['meta_query'][] = ['key' => '_price', 'value' => (float) $q['max_price'], 'compare' => '<=', 'type' => 'NUMERIC'];
		}
		if (empty($args['orderby'])) {
			if ($sort === 'price_asc') {
				$args['meta_key'] = '_price';
				$args['orderby'] = ['meta_value_num' => 'ASC', 'ID' => 'ASC'];
			} else {
				$args['orderby'] = ['date' => 'DESC', 'ID' => 'DESC'];
			}
		}

		$city = isset($q['city']) ? sanitize_title((string) $q['city']) : '';
		if ($city !== '' && $sort === 'nearest' && empty($q['ids'])) {
			// "Plus proches": products of shops in this commune first, then all the others.
			$local = self::vendors_in_city($city);
			return self::two_part_page($args, $local, $page, $size);
		}

		$args['posts_per_page'] = $size;
		$args['paged'] = $page;
		$query = new WP_Query($args);
		$items = self::summaries($query->posts);
		$total = (int) $query->found_posts;
		return self::page($items, $page, $size, $total);
	}

	/** Page through "local shops first, then the rest" without loading everything. */
	private static function two_part_page(array $args, array $local_vendors, int $page, int $size): array {
		$offset = ($page - 1) * $size;

		$local = $args + ['fields' => 'ids'];
		$local['author__in'] = $local_vendors ?: [0];
		$rest = $args + ['fields' => 'ids'];
		if ($local_vendors) {
			$rest['author__not_in'] = $local_vendors;
		}

		// Count first: WordPress leaves found_posts at 0 when an offset is past the end.
		$local_total = self::count($local);
		$rest_total = self::count($rest);

		$ids = [];
		if ($offset < $local_total) {
			$ids = (new WP_Query($local + ['posts_per_page' => $size, 'offset' => $offset, 'no_found_rows' => true]))->posts;
		}
		$missing = $size - count($ids);
		if ($missing > 0) {
			$rest_offset = max(0, $offset - $local_total);
			if ($rest_offset < $rest_total) {
				$ids = array_merge($ids, (new WP_Query($rest + ['posts_per_page' => $missing, 'offset' => $rest_offset, 'no_found_rows' => true]))->posts);
			}
		}
		return self::page(self::summaries($ids), $page, $size, $local_total + $rest_total);
	}

	private static function count(array $args): int {
		$q = new WP_Query(array_merge($args, ['posts_per_page' => 1, 'paged' => 1, 'fields' => 'ids']));
		return (int) $q->found_posts;
	}

	private static function summaries(array $posts): array {
		$out = [];
		foreach ($posts as $post) {
			$p = wc_get_product(is_object($post) ? $post->ID : (int) $post);
			if ($p && $p->get_status() === 'publish') {
				$out[] = self::summary($p);
			}
		}
		return $out;
	}

	private static function page(array $items, int $page, int $size, int $total): array {
		return [
			'items'    => $items,
			'page'     => $page,
			'pageSize' => $size,
			'total'    => $total,
			'hasMore'  => $page * $size < $total,
		];
	}

	/** Clear cached shops and vendor lists after a change. */
	public static function flush_cache(): void {
		foreach (['all', 'vente', 'location'] as $u) {
			delete_transient('locappci_categories_' . $u);
		}
		if (function_exists('wp_cache_flush_group')) {
			wp_cache_flush_group(self::CACHE_GROUP);
		}
	}
}
