<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * « Mes articles » for validated sellers (client, 21 Nov: sellers can work from the app too).
 *
 * GET  /v1/seller/products          the seller's own sale articles, any state
 * POST /v1/seller/products          add one: { name, price, categoryId, description?, stockQuantity?, photos: base64[] (1–5) }
 * POST /v1/seller/products/{id}     change it: any of the same fields, plus { hidden: bool }
 *
 * Same products as the website (WooCommerce simple products, author = the seller, the site's own fields), waiting
 * for the owner with `_locappci_validation_status = en_attente` until he validates (section 10, or the site's own
 * screen). Changing the price or the stock keeps the article online; changing the name, description, category or
 * photos sends it back for checking, so nothing unchecked is ever shown. Rentals stay on the website for now.
 */
final class Locappci_Seller_Products {
	const STATUS = '_locappci_validation_status';
	const REASON = '_locappci_validation_motif';
	const FROM_APP = '_locappci_from_app';
	const MAX_PHOTOS = 5;
	const MAX_PHOTO = 5 * 1024 * 1024;

	/** A validated seller, or an error answer. */
	private static function seller(WP_REST_Request $r) {
		$user = Locappci_Accounts::current_user($r);
		if (!$user) {
			return Locappci_Errors::response('unauthorized', 'Connectez-vous pour gérer vos articles.');
		}
		$app = Locappci_Sellers::to_app($user);
		if ($app['status'] !== 'approved') {
			return Locappci_Errors::response('validation', 'Votre boutique doit d’abord être validée par LOCAPPCI.');
		}
		return $user;
	}

	private static function ok($data, int $status = 200): WP_REST_Response {
		return Locappci_Errors::no_cache(new WP_REST_Response($data, $status));
	}

	public static function list(WP_REST_Request $r): WP_REST_Response {
		$user = self::seller($r);
		if ($user instanceof WP_REST_Response) {
			return $user;
		}
		$ids = get_posts(['post_type' => 'product', 'post_status' => ['publish', 'draft', 'pending', 'private'], 'author' => $user->ID,
			'posts_per_page' => 200, 'fields' => 'ids', 'orderby' => 'date', 'order' => 'DESC', 'suppress_filters' => true]);
		$out = [];
		foreach ($ids as $id) {
			$p = wc_get_product((int) $id);
			if ($p && !Locappci_Catalogue::is_rental($p) && !$p->is_downloadable()) {
				$out[] = self::to_app($p);
			}
		}
		return self::ok($out);
	}

	public static function to_app(WC_Product $p): array {
		$status = (string) get_post_meta($p->get_id(), self::STATUS, true);
		$state = $p->get_status() !== 'publish' ? 'hidden'
			: ($status === 'en_attente' ? 'pending' : ($status === 'refusee' ? 'refused' : 'approved'));
		return [
			'id'            => (string) $p->get_id(),
			'name'          => html_entity_decode($p->get_name(), ENT_QUOTES, 'UTF-8'),
			'price'         => (int) round((float) $p->get_regular_price()),
			'categoryId'    => Locappci_Catalogue::category_id($p),
			'description'   => self::plain($p->get_description()),
			'stockQuantity' => $p->get_manage_stock() ? (int) $p->get_stock_quantity() : null,
			'photos'        => Locappci_Catalogue::images($p),
			'status'        => $state,
			'refusalReason' => $state === 'refused' ? ((string) get_post_meta($p->get_id(), self::REASON, true) ?: null) : null,
			'webUrl'        => get_permalink($p->get_id()),
		];
	}

	/** The description as the seller typed it: paragraphs and line breaks back to plain text. */
	private static function plain(string $html): string {
		$t = preg_replace('#<br\s*/?>\s*#i', "\n", $html);
		$t = preg_replace('#</p>\s*#i', "\n\n", $t);
		$t = html_entity_decode(wp_strip_all_tags($t), ENT_QUOTES, 'UTF-8');
		return trim(preg_replace("/\n{3,}/", "\n\n", $t));
	}

	public static function create(WP_REST_Request $r): WP_REST_Response {
		$user = self::seller($r);
		if ($user instanceof WP_REST_Response) {
			return $user;
		}
		$b = $r->get_json_params();
		$b = is_array($b) ? $b : [];
		$fields = self::validate($b, true);
		if ($fields instanceof WP_REST_Response) {
			return $fields;
		}
		$bucket = 'locappci_sellerprod_' . $user->ID;
		$count = (int) get_transient($bucket);
		if ($count >= 30) {
			return Locappci_Errors::response('rate_limited', 'Beaucoup d’articles ajoutés aujourd’hui. Réessayez demain.');
		}
		$p = new WC_Product_Simple();
		$p->set_status('publish');
		self::apply($p, $fields);
		$id = $p->save();
		wp_update_post(['ID' => $id, 'post_author' => $user->ID]);
		$photos = self::save_photos($fields['photos'], $id);
		if (!$photos) {
			wp_delete_post($id, true);
			return Locappci_Errors::response('validation', 'Photo illisible : reprenez une photo nette (5 Mo au plus).');
		}
		$p = wc_get_product($id);
		$p->set_image_id($photos[0]);
		$p->set_gallery_image_ids(array_slice($photos, 1));
		$p->save();
		$record = Locappci_Catalogue::boutique_id($user->ID);
		$meta = ['_locappci_module' => 'vente', '_locappci_vendor_id' => $user->ID, '_wcfm_product_author' => $user->ID,
			self::FROM_APP => '1', self::STATUS => 'en_attente', '_locappci_catalogue_visible' => 'yes', '_locappci_public_visibility' => 'visible'];
		if ($record) {
			$meta['_locappci_boutique_id'] = $record;
		}
		foreach ($meta as $k => $v) {
			update_post_meta($id, $k, $v);
		}
		set_transient($bucket, $count + 1, DAY_IN_SECONDS);
		Locappci_Catalogue::flush_cache();
		wp_mail(Locappci_Reports::email(), '[LOCAPPCI] Nouvel article à valider : ' . $fields['name'],
			'Un vendeur a ajouté un article depuis l’appli : ' . $fields['name'] . ' (' . number_format($fields['price'], 0, ',', ' ') . " FCFA).\n"
			. 'À valider : ' . admin_url('tools.php?page=locappci-api#articles'));
		return self::ok(self::to_app(wc_get_product($id)), 201);
	}

	public static function update(WP_REST_Request $r): WP_REST_Response {
		$user = self::seller($r);
		if ($user instanceof WP_REST_Response) {
			return $user;
		}
		$p = wc_get_product((int) $r['id']);
		if (!$p || (int) get_post_field('post_author', $p->get_id()) !== $user->ID || Locappci_Catalogue::is_rental($p)) {
			return Locappci_Errors::not_found();
		}
		$b = $r->get_json_params();
		$b = is_array($b) ? $b : [];
		$fields = self::validate($b, false);
		if ($fields instanceof WP_REST_Response) {
			return $fields;
		}
		// What the owner must see again before it is shown: words, category, photos. Price and stock: never.
		$recheck = false;
		foreach (['name', 'description', 'categoryId'] as $k) {
			if (array_key_exists($k, $fields)) {
				$now = self::to_app($p)[$k];
				$recheck = $recheck || (string) $now !== (string) $fields[$k];
			}
		}
		self::apply($p, $fields);
		if (array_key_exists('hidden', $b)) {
			$p->set_status(!empty($b['hidden']) ? 'draft' : 'publish');
		}
		$p->save();
		if (!empty($fields['photos'])) {
			$photos = self::save_photos($fields['photos'], $p->get_id());
			if (!$photos) {
				return Locappci_Errors::response('validation', 'Photo illisible : reprenez une photo nette (5 Mo au plus).');
			}
			$p = wc_get_product($p->get_id());
			$p->set_image_id($photos[0]);
			$p->set_gallery_image_ids(array_slice($photos, 1));
			$p->save();
			$recheck = true;
		}
		if ($recheck || get_post_meta($p->get_id(), self::STATUS, true) === 'refusee') {
			update_post_meta($p->get_id(), self::STATUS, 'en_attente');
			delete_post_meta($p->get_id(), self::REASON);
		}
		Locappci_Catalogue::flush_cache();
		return self::ok(self::to_app(wc_get_product($p->get_id())));
	}

	/** @return array|WP_REST_Response the fields given, cleaned; on create all are required except description and stock. */
	private static function validate(array $b, bool $create) {
		$out = [];
		if ($create || array_key_exists('name', $b)) {
			$name = trim(preg_replace('/\s+/', ' ', sanitize_text_field((string) ($b['name'] ?? ''))));
			if (mb_strlen($name) < 3 || mb_strlen($name) > 120) {
				return Locappci_Errors::response('validation', 'Indiquez le nom de l’article (3 à 120 caractères).');
			}
			$out['name'] = $name;
		}
		if ($create || array_key_exists('price', $b)) {
			$price = is_numeric($b['price'] ?? null) ? (int) $b['price'] : 0;
			if ($price < 100 || $price > 100000000) {
				return Locappci_Errors::response('validation', 'Prix invalide (en FCFA, 100 au moins).');
			}
			$out['price'] = $price;
		}
		if ($create || array_key_exists('categoryId', $b)) {
			$term = get_term((int) ($b['categoryId'] ?? 0), 'product_cat');
			if (!$term || is_wp_error($term)) {
				return Locappci_Errors::response('validation', 'Choisissez une catégorie.');
			}
			$out['categoryId'] = (string) $term->term_id;
		}
		if (array_key_exists('description', $b)) {
			$d = trim(sanitize_textarea_field((string) $b['description']));
			if (mb_strlen($d) > 3000) {
				return Locappci_Errors::response('validation', 'Description trop longue (3 000 caractères au plus).');
			}
			$out['description'] = $d;
		}
		if (array_key_exists('stockQuantity', $b)) {
			$q = $b['stockQuantity'];
			if ($q !== null && (!is_numeric($q) || (int) $q < 0 || (int) $q > 100000)) {
				return Locappci_Errors::response('validation', 'Quantité en stock invalide.');
			}
			$out['stockQuantity'] = $q === null ? null : (int) $q;
		}
		if ($create || array_key_exists('photos', $b)) {
			$photos = is_array($b['photos'] ?? null) ? array_values($b['photos']) : [];
			if (($create && !$photos) || count($photos) > self::MAX_PHOTOS) {
				return Locappci_Errors::response('validation', 'Ajoutez 1 à 5 photos de l’article.');
			}
			$out['photos'] = $photos;
		}
		return $out;
	}

	private static function apply(WC_Product $p, array $f): void {
		if (isset($f['name'])) {
			$p->set_name($f['name']);
		}
		if (isset($f['price'])) {
			$p->set_regular_price((string) $f['price']);
			$p->set_sale_price('');
		}
		if (isset($f['categoryId'])) {
			$p->set_category_ids([(int) $f['categoryId']]);
		}
		if (array_key_exists('description', $f)) {
			$p->set_description(wpautop(esc_html($f['description'])));
		}
		if (array_key_exists('stockQuantity', $f)) {
			$p->set_manage_stock($f['stockQuantity'] !== null);
			if ($f['stockQuantity'] !== null) {
				$p->set_stock_quantity($f['stockQuantity']);
			} else {
				$p->set_stock_status('instock');
			}
		}
	}

	/** Base64 photos → media library attachments of the product. @return int[] ids, or [] if one is unreadable. */
	private static function save_photos(array $photos, int $product_id): array {
		require_once ABSPATH . 'wp-admin/includes/image.php';
		$ids = [];
		foreach ($photos as $i => $b64) {
			$bytes = base64_decode(preg_replace('#^data:image/\w+;base64,#', '', (string) $b64), true);
			$info = $bytes ? @getimagesizefromstring($bytes) : false;
			if (!$bytes || strlen($bytes) > self::MAX_PHOTO || !$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
				foreach ($ids as $id) {
					wp_delete_attachment($id, true);
				}
				return [];
			}
			$ext = $info[2] === IMAGETYPE_PNG ? 'png' : 'jpg';
			$up = wp_upload_bits('article-' . $product_id . '-' . ($i + 1) . '-' . wp_generate_password(6, false) . '.' . $ext, null, $bytes);
			if (!empty($up['error'])) {
				return [];
			}
			$aid = wp_insert_attachment(['post_mime_type' => $info['mime'], 'post_title' => get_the_title($product_id), 'post_status' => 'inherit'],
				$up['file'], $product_id);
			wp_update_attachment_metadata($aid, wp_generate_attachment_metadata($aid, $up['file']));
			$ids[] = (int) $aid;
		}
		return $ids;
	}

	// ---------------------------------------------------------------- owner (section 10)

	public static function pending(): array {
		return get_posts(['post_type' => 'product', 'post_status' => 'publish', 'posts_per_page' => 50, 'orderby' => 'date', 'order' => 'ASC',
			'meta_query' => [['key' => self::FROM_APP, 'value' => '1'], ['key' => self::STATUS, 'value' => 'en_attente']],
			'suppress_filters' => true]);
	}

	/** Valider / Refuser an article (admin-post.php?action=locappci_product_decision). */
	public static function decide(): void {
		$id = (int) ($_POST['id'] ?? 0);
		if (!current_user_can('manage_options') || !check_admin_referer('locappci_product_' . $id)) {
			wp_die('Accès refusé.', 403);
		}
		if (get_post_type($id) !== 'product') {
			wp_die('Article introuvable.', 404);
		}
		$decision = sanitize_key((string) ($_POST['decision'] ?? ''));
		if ($decision === 'approve') {
			update_post_meta($id, self::STATUS, 'validee');
			delete_post_meta($id, self::REASON);
			$msg = 'Article validé : il est visible dans l’appli et sur le site.';
		} elseif ($decision === 'refuse') {
			$reason = trim(sanitize_textarea_field(wp_unslash((string) ($_POST['reason'] ?? ''))));
			update_post_meta($id, self::STATUS, 'refusee');
			update_post_meta($id, self::REASON, $reason !== '' ? $reason : 'Article non conforme.');
			$msg = 'Article refusé.';
		} else {
			wp_die('Décision inconnue.', 400);
		}
		Locappci_Catalogue::flush_cache();
		wp_safe_redirect(add_query_arg('locappci_msg', rawurlencode($msg), admin_url('tools.php?page=locappci-api')) . '#articles');
		exit;
	}
}
