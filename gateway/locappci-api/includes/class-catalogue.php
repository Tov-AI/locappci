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

	/** Product types sold as rentals (the WooCommerce Booking & Rental plugin uses "redq_rental"). Unused on locappci.fr so far. */
	public static function rental_types(): array {
		return apply_filters('locappci_rental_types', ['redq_rental']);
	}

	/**
	 * On locappci.fr, rental items are products in the "location" category (or its sub-categories):
	 * the site's own snippets ("Demandes Location OFFICIEL STABLE") use the same rule.
	 */
	public static function location_category_slug(): string {
		return (string) apply_filters('locappci_location_category', 'location');
	}

	/** Term id of the "location" category, or 0. */
	public static function location_term_id(): int {
		$t = get_term_by('slug', self::location_category_slug(), 'product_cat');
		return ($t && !is_wp_error($t)) ? (int) $t->term_id : 0;
	}

	/** Rentals as a WP_Query tax_query clause: in the location category, or a rental product type. */
	public static function rental_tax_query(bool $rentals): array {
		$cat = self::location_term_id();
		$by_cat = ['taxonomy' => 'product_cat', 'terms' => [$cat ?: 0], 'include_children' => true, 'operator' => $rentals ? 'IN' : 'NOT IN'];
		$by_type = ['taxonomy' => 'product_type', 'field' => 'slug', 'terms' => self::rental_types(), 'operator' => $rentals ? 'IN' : 'NOT IN'];
		return $rentals ? ['relation' => 'OR', $by_cat, $by_type] : ['relation' => 'AND', $by_cat, $by_type];
	}

	/**
	 * Products the app can sell. Downloads (songs, e-books…) have no delivery or rental flow in the
	 * app yet, so they stay on the website for now.
	 */
	public static function is_supported(WC_Product $p): bool {
		return (bool) apply_filters('locappci_is_supported', !$p->is_downloadable(), $p);
	}

	/** Same rule as is_supported(), as a WP_Query meta_query clause. */
	public static function supported_meta_query(): array {
		return [
			'relation' => 'OR',
			['key' => '_downloadable', 'compare' => 'NOT EXISTS'],
			['key' => '_downloadable', 'value' => 'yes', 'compare' => '!='],
		];
	}

	/**
	 * The site's own approval fields (set by the LOCAPPCI code when a seller submits a product and the
	 * team validates it). Most products on locappci.fr were created before that flow and have none of
	 * these fields: they are on sale on the website, so the app shows them too. A product is hidden
	 * only when a field is filled with something other than the approved value (en_attente, no, hidden…).
	 */
	public static function approval_fields(): array {
		return (array) apply_filters('locappci_approval_fields', [
			'_locappci_validation_status' => 'validee',
			'_locappci_catalogue_visible' => 'yes',
			'_locappci_public_visibility' => 'visible',
		]);
	}

	/** Not marked as waiting, refused or hidden: an empty or missing field does not hide the product. */
	public static function is_approved(WC_Product $p): bool {
		$ok = true;
		foreach (self::approval_fields() as $key => $value) {
			$found = (string) get_post_meta($p->get_id(), $key, true);
			if ($found !== '' && $found !== (string) $value) {
				$ok = false;
				break;
			}
		}
		return (bool) apply_filters('locappci_is_approved', $ok, $p);
	}

	/**
	 * Ids of the posts the same rule hides: one small indexed query on the three fields, kept for the
	 * request. (As a WP_Query meta_query, "missing or approved" on three fields joins the meta table
	 * six times and multiplies rows by every field of every product: far too slow on a real site.)
	 */
	public static function hidden_ids(): array {
		static $ids = null;
		if ($ids === null) {
			$ids = array_values(array_unique(array_merge(self::unapproved_ids(), self::unpriced_sale_ids())));
		}
		return $ids;
	}

	/** Posts the site marks as waiting, refused or hidden (the three approval fields). */
	public static function unapproved_ids(): array {
		static $ids = null;
		if ($ids === null) {
			global $wpdb;
			$where = [];
			$values = [];
			foreach (self::approval_fields() as $key => $value) {
				$where[] = "(meta_key = %s AND meta_value NOT IN (%s, ''))";
				$values[] = (string) $key;
				$values[] = (string) $value;
			}
			$ids = $where
				? array_map('intval', (array) $wpdb->get_col($wpdb->prepare(
					"SELECT DISTINCT post_id FROM {$wpdb->postmeta} WHERE " . implode(' OR ', $where), $values)))
				: [];
		}
		return $ids;
	}

	/**
	 * Published products for sale with no price (empty or 0 FCFA): they cannot be ordered, so the app
	 * does not list them. In practice these are services posted as products (« Plombier… », 0 FCFA):
	 * they belong to the Services universe, which the app does not have yet.
	 * Rentals are not concerned: a rental without a price shows « Prix à confirmer ».
	 */
	public static function unpriced_sale_ids(): array {
		static $ids = null;
		if ($ids === null) {
			global $wpdb;
			$found = array_map('intval', (array) $wpdb->get_col(
				"SELECT p.ID FROM {$wpdb->posts} p
				 LEFT JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID AND pm.meta_key = '_price'
				 WHERE p.post_type = 'product' AND p.post_status = 'publish'
				 GROUP BY p.ID
				 HAVING MAX(pm.meta_value + 0) IS NULL OR MAX(pm.meta_value + 0) <= 0"
			));
			$ids = [];
			foreach ($found as $id) {
				$p = wc_get_product($id);
				if ($p && !self::is_rental($p)) {
					$ids[] = $id;
				}
			}
			$ids = (array) apply_filters('locappci_unpriced_sale_ids', $ids);
		}
		return $ids;
	}

	/** Same rule as is_approved(), applied to WP_Query arguments. */
	public static function without_hidden(array $args): array {
		$hidden = self::hidden_ids();
		if (!$hidden) {
			return $args;
		}
		if (!empty($args['post__in'])) {
			// WordPress ignores post__not_in when post__in is set.
			$args['post__in'] = array_values(array_diff(array_map('intval', $args['post__in']), $hidden)) ?: [0];
		} else {
			$args['post__not_in'] = $hidden;
		}
		return $args;
	}

	/** Everything a product needs to appear in the app: published, not hidden, not a download, approved. */
	public static function is_shown(WC_Product $p): bool {
		return $p->get_status() === 'publish' && $p->get_catalog_visibility() !== 'hidden'
			&& self::is_supported($p) && self::is_approved($p)
			&& !in_array($p->get_id(), self::unpriced_sale_ids(), true);
	}

	public static function is_rental(WC_Product $p): bool {
		$cat = self::location_term_id();
		if ($cat) {
			foreach ($p->get_category_ids() as $id) {
				if ((int) $id === $cat || in_array($cat, array_map('intval', get_ancestors((int) $id, 'product_cat')), true)) {
					return true;
				}
			}
		}
		// A rental product type (RnB), and the product_type term as a fallback (if that plugin is off).
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

	/**
	 * Price per day, deposit, durations and the seller's notes of a rental.
	 * locappci.fr stores _locappci_location_deposit / _condition / _delivery / _city (snippet
	 * "Validation admin matériels location"); RnB keys are kept as a fallback.
	 * A missing price gives 0: the app shows "Prix à confirmer".
	 */
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
		$text = function (string $key) use ($id): ?string {
			$v = trim(wp_strip_all_tags((string) get_post_meta($id, $key, true)));
			return $v === '' ? null : html_entity_decode($v, ENT_QUOTES, 'UTF-8');
		};
		$fields = [
			'pricePerDay' => (int) round($num(['general_price', '_price'], (float) $p->get_price())),
			'deposit'     => self::amount((string) get_post_meta($id, '_locappci_location_deposit', true))
				?? (int) round($num(['_locappci_deposit', 'redq_security_deposit'], 0)),
			'minDays'     => max(1, (int) $num(['redq_min_rental_days', '_locappci_min_days'], 1)),
			'maxDays'     => max(1, (int) $num(['redq_max_rental_days', '_locappci_max_days'], 90)),
			'condition'   => $text('_locappci_location_condition'),
			'delivery'    => $text('_locappci_location_delivery'),
		];
		if ($fields['maxDays'] < $fields['minDays']) {
			$fields['maxDays'] = $fields['minDays'];
		}
		return apply_filters('locappci_rental_fields', $fields, $p);
	}

	/** "50 000 FCFA" or "50000" → 50000; no digits → null. */
	public static function amount(string $text): ?int {
		$digits = preg_replace('/\D+/', '', $text);
		return $digits === '' ? null : (int) $digits;
	}

	/** Commune of a rental item: its own field on locappci.fr, else the shop's. */
	public static function item_city(WC_Product $p, ?array $shop): string {
		$own = self::is_rental($p) ? self::match_city((string) get_post_meta($p->get_id(), '_locappci_location_city', true)) : '';
		return $own ?: ($shop ? $shop['cityId'] : '');
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
			'cityId'      => self::item_city($p, $shop),
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
		// The site's own shop record (« Boutiques LOCAPPCI »), when the team has validated it.
		$boutique = self::boutique_id($vendor_id);
		$field = function (string $key) use ($boutique): string {
			return $boutique ? trim((string) get_post_meta($boutique, '_locappci_boutique_' . $key, true)) : '';
		};
		// What the seller chose to hide on their shop page stays hidden in the app.
		$hide_phone = self::flag($settings['store_hide_phone'] ?? '');
		$hide_address = self::flag($settings['store_hide_address'] ?? '');

		$name = function_exists('wcfm_get_vendor_store_name') ? (string) wcfm_get_vendor_store_name($vendor_id) : '';
		$name = $name ?: ($settings['store_name'] ?? '') ?: ($boutique ? get_the_title($boutique) : '') ?: $user->display_name;

		$phone = '';
		if (!$hide_phone) {
			$phone = $field('whatsapp') ?: $field('telephone') ?: ($settings['phone'] ?? '') ?: get_user_meta($vendor_id, 'billing_phone', true);
		}
		// The commune the seller chose on the site (client's decision, 10 Nov 2026), then the record's town.
		// Both are the shop's public place; the WCFM address is the seller's own address.
		$city = self::match_city($field('commune')) ?: self::match_city($field('ville'));
		if ($city === '' && !$hide_address) {
			$city = self::match_city((string) (($settings['address']['city'] ?? '') ?: get_user_meta($vendor_id, 'billing_city', true)));
		}
		$logo = null;
		$logo_id = (int) $field('logo_id');
		if ($logo_id > 0) {
			$logo = wp_get_attachment_image_url($logo_id, 'thumbnail') ?: null;
		}

		$shop = [
			'id'       => (string) $vendor_id,
			'name'     => html_entity_decode(wp_strip_all_tags((string) $name), ENT_QUOTES, 'UTF-8'),
			'initials' => self::initials((string) $name),
			'logoUrl'  => $logo ?: self::logo_url($settings),
			'cityId'   => $city,
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

	/** WCFM stores its « hide » switches as yes / no. */
	public static function flag($value): bool {
		return in_array(strtolower(trim((string) $value)), ['yes', '1', 'on', 'true', 'oui'], true);
	}

	/**
	 * The seller's validated « locappci_boutique » record, or 0. Found through the seller's products
	 * (_locappci_boutique_id, the link the site itself writes), then through the record's author.
	 */
	public static function boutique_id(int $vendor_id): int {
		global $wpdb;
		$ids = array_map('intval', (array) $wpdb->get_col($wpdb->prepare(
			"SELECT pm.meta_value FROM {$wpdb->postmeta} pm
			 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			 WHERE pm.meta_key = '_locappci_boutique_id' AND pm.meta_value <> '' AND p.post_type = 'product'
			 AND p.post_status = 'publish' AND p.post_author = %d
			 GROUP BY pm.meta_value ORDER BY COUNT(*) DESC LIMIT 5",
			$vendor_id
		)));
		$own = get_posts(['post_type' => 'locappci_boutique', 'post_status' => 'publish', 'author' => $vendor_id,
			'posts_per_page' => 5, 'fields' => 'ids', 'orderby' => 'ID', 'order' => 'ASC', 'suppress_filters' => true]);
		foreach (array_unique(array_merge($ids, array_map('intval', $own))) as $id) {
			$post = $id ? get_post($id) : null;
			if (!$post || $post->post_type !== 'locappci_boutique' || $post->post_status !== 'publish') {
				continue;
			}
			$status = (string) get_post_meta($id, '_locappci_boutique_statut', true);
			if ($status === '' || $status === 'validee') {
				return (int) apply_filters('locappci_boutique_id', $id, $vendor_id);
			}
		}
		return (int) apply_filters('locappci_boutique_id', 0, $vendor_id);
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
		$q = new WP_Query(self::without_hidden([
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'author'         => $vendor_id,
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'no_found_rows'  => true,
			'tax_query'      => [self::rental_tax_query(true)],
		]));
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
			if ($u === '' || ($universe && $u !== $universe)) {
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

	/**
	 * "location" for the location category and its sub-categories; "vente" for a category holding
	 * products the app can sell; '' (hidden) for a category with only downloads or rentals of RnB type.
	 */
	private static function category_universe(WP_Term $t): string {
		$cat = self::location_term_id();
		if ($cat && ((int) $t->term_id === $cat || in_array($cat, array_map('intval', get_ancestors($t->term_id, 'product_cat')), true))) {
			return 'location';
		}
		$count = function (bool $rentals) use ($t) {
			$q = new WP_Query(self::without_hidden([
				'post_type'      => 'product',
				'post_status'    => 'publish',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'tax_query'      => [
					'relation' => 'AND',
					['taxonomy' => 'product_cat', 'terms' => [$t->term_id]],
					self::rental_tax_query($rentals),
				],
				'meta_query'     => [self::supported_meta_query()],
			]));
			return (int) $q->found_posts;
		};
		$rentals = $count(true);
		$sales = $count(false);
		if ($rentals + $sales === 0) {
			return ''; // Only downloads or products not approved yet: not shown in the app.
		}
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
			'meta_query'  => ['relation' => 'AND', self::supported_meta_query()],
		];
		// Hidden from the catalogue in WooCommerce → hidden in the app too.
		$args['tax_query'][] = ['taxonomy' => 'product_visibility', 'field' => 'name', 'terms' => ['exclude-from-catalog'], 'operator' => 'NOT IN'];

		if (!empty($q['ids'])) {
			$ids = array_values(array_filter(array_map('intval', explode(',', (string) $q['ids']))));
			$args['post__in'] = $ids ?: [0];
			$args['orderby'] = 'post__in';
		}
		// Waiting, refused or hidden on the site → not in the app.
		$args = self::without_hidden($args);
		if (($q['universe'] ?? '') === 'location' || ($q['universe'] ?? '') === 'vente') {
			$args['tax_query'][] = self::rental_tax_query($q['universe'] === 'location');
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
			if ($p && $p->get_status() === 'publish' && self::is_supported($p) && self::is_approved($p)
				&& !in_array($p->get_id(), self::unpriced_sale_ids(), true)) {
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
