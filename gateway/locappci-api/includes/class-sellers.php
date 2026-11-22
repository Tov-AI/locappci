<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * « Devenir vendeur » from the app (client, 21 Nov): a signed-in customer asks to open a shop; the owner checks
 * the ID document and the WhatsApp number, then validates (Outils → LOCAPPCI API, section 9).
 *
 * GET  /v1/seller-application   status of the signed-in customer's request
 * POST /v1/seller-application   send or correct it: { shopName, cityId, whatsapp, description?, idPhoto (base64 JPEG/PNG) }
 *
 * Same records as the website: a `locappci_boutique` post (post_status « pending », statut « en_attente ») with the
 * site's fields, so a validated shop works everywhere. One shop per seller (client).
 * WhatsApp check without SMS (client: WhatsApp for now): the app shows a 4-digit code that the seller sends to
 * LOCAPPCI on WhatsApp; the owner sees the message come from the number given, with the same code.
 * The ID photo is kept outside the public uploads URL space (deny-all folder) and deleted once the owner decides.
 */
final class Locappci_Sellers {
	const APP_META = '_locappci_app_application';
	const CODE_META = '_locappci_app_verify_code';
	const FILE_META = '_locappci_app_id_file';
	const DATE_META = '_locappci_app_submitted_at';
	const MAX_PHOTO = 5 * 1024 * 1024;
	const VENDOR_ROLE = 'wcfm_vendor';

	private static function user_or_error(WP_REST_Request $r) {
		$user = Locappci_Accounts::current_user($r);
		return $user ?: Locappci_Errors::response('unauthorized', 'Connectez-vous pour ouvrir votre boutique.');
	}

	/** The customer's own shop record made from the app (any state), or 0. */
	private static function application_id(int $user_id): int {
		$ids = get_posts(['post_type' => 'locappci_boutique', 'post_status' => ['pending', 'publish', 'draft'], 'author' => $user_id,
			'meta_key' => self::APP_META, 'posts_per_page' => 1, 'fields' => 'ids', 'orderby' => 'ID', 'order' => 'DESC',
			'suppress_filters' => true]);
		return $ids ? (int) $ids[0] : 0;
	}

	private static function is_vendor(WP_User $u): bool {
		return in_array(self::VENDOR_ROLE, (array) $u->roles, true) || Locappci_Catalogue::boutique_id($u->ID) > 0;
	}

	public static function get(WP_REST_Request $r): WP_REST_Response {
		$user = self::user_or_error($r);
		if ($user instanceof WP_REST_Response) {
			return $user;
		}
		return Locappci_Errors::no_cache(new WP_REST_Response(self::to_app($user), 200));
	}

	public static function to_app(WP_User $user): array {
		$id = self::application_id($user->ID);
		$out = ['status' => 'none', 'shopName' => null, 'cityId' => null, 'whatsapp' => null, 'description' => null,
			'refusalReason' => null, 'verifyCode' => null, 'submittedAt' => null];
		if (!$id) {
			if (self::is_vendor($user)) {
				$shop = Locappci_Catalogue::shop($user->ID);
				$out['status'] = 'approved';
				$out['shopName'] = $shop['name'] ?? null;
				$out['cityId'] = ($shop['cityId'] ?? '') ?: null;
			}
			return $out;
		}
		$f = fn(string $k) => (string) get_post_meta($id, '_locappci_boutique_' . $k, true);
		$statut = $f('statut');
		$out['status'] = $statut === 'validee' ? 'approved' : ($statut === 'refusee' ? 'refused' : 'pending');
		$out['shopName'] = get_the_title($id);
		$out['cityId'] = Locappci_Catalogue::city_id($f('commune')) ?: null;
		$out['whatsapp'] = Locappci_Catalogue::whatsapp($f('whatsapp'));
		$out['description'] = (string) get_post_field('post_content', $id) ?: null;
		$out['refusalReason'] = $out['status'] === 'refused' ? ($f('motif_refus') ?: null) : null;
		$out['verifyCode'] = $out['status'] === 'pending' ? ((string) get_post_meta($id, self::CODE_META, true) ?: null) : null;
		$out['submittedAt'] = (string) get_post_meta($id, self::DATE_META, true) ?: null;
		return $out;
	}

	public static function submit(WP_REST_Request $r): WP_REST_Response {
		$user = self::user_or_error($r);
		if ($user instanceof WP_REST_Response) {
			return $user;
		}
		$id = self::application_id($user->ID);
		if (($id && get_post_meta($id, '_locappci_boutique_statut', true) === 'validee') || (!$id && self::is_vendor($user))) {
			return Locappci_Errors::response('validation', 'Votre boutique est déjà validée.');
		}
		$b = $r->get_json_params();
		$b = is_array($b) ? $b : [];
		$name = trim(preg_replace('/\s+/', ' ', sanitize_text_field((string) ($b['shopName'] ?? ''))));
		if (mb_strlen($name) < 2 || mb_strlen($name) > 60) {
			return Locappci_Errors::response('validation', 'Indiquez le nom de la boutique (2 à 60 caractères).');
		}
		$city = Locappci_Catalogue::city_id((string) ($b['cityId'] ?? ''));
		$cities = array_column(Locappci_Catalogue::cities(), 'name', 'id');
		if ($city === '' || !isset($cities[$city])) {
			return Locappci_Errors::response('validation', 'Choisissez la commune de la boutique.');
		}
		$wa = Locappci_Accounts::phone((string) ($b['whatsapp'] ?? ''));
		if ($wa === '') {
			return Locappci_Errors::response('validation', 'Numéro WhatsApp invalide (ex. 07 00 00 00 00 ou +33 6…).');
		}
		$description = trim(sanitize_textarea_field((string) ($b['description'] ?? '')));
		if (mb_strlen($description) > 1000) {
			return Locappci_Errors::response('validation', 'Description trop longue (1 000 caractères au plus).');
		}
		$photo = (string) ($b['idPhoto'] ?? '');
		$had_file = $id && get_post_meta($id, self::FILE_META, true);
		if ($photo === '' && !$had_file) {
			return Locappci_Errors::response('validation', 'Ajoutez une photo de votre pièce d’identité.');
		}
		$bytes = null;
		if ($photo !== '') {
			$bytes = base64_decode(preg_replace('#^data:image/\w+;base64,#', '', $photo), true);
			$info = $bytes ? @getimagesizefromstring($bytes) : false;
			if (!$bytes || strlen($bytes) > self::MAX_PHOTO || !$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
				return Locappci_Errors::response('validation', 'Photo illisible : reprenez une photo nette de la pièce (5 Mo au plus).');
			}
		}

		$post = ['post_type' => 'locappci_boutique', 'post_title' => $name, 'post_content' => $description,
			'post_author' => $user->ID, 'post_status' => 'pending'];
		if ($id) {
			$post['ID'] = $id;
			wp_update_post($post);
		} else {
			$id = (int) wp_insert_post($post);
			if (!$id) {
				return Locappci_Errors::response('server_error', 'La demande n’a pas pu être enregistrée. Réessayez.');
			}
			update_post_meta($id, self::APP_META, '1');
		}
		$meta = ['commune' => $cities[$city], 'whatsapp' => '+' . $wa, 'telephone' => '+' . $wa, 'statut' => 'en_attente',
			'verified' => 'non', 'motif_refus' => ''];
		foreach ($meta as $k => $v) {
			update_post_meta($id, '_locappci_boutique_' . $k, $v);
		}
		if (!get_post_meta($id, self::CODE_META, true)) {
			update_post_meta($id, self::CODE_META, (string) random_int(1000, 9999));
		}
		update_post_meta($id, self::DATE_META, gmdate('c'));
		if ($bytes !== null) {
			self::delete_file($id);
			$file = self::store_file($bytes);
			if (!$file) {
				return Locappci_Errors::response('server_error', 'La photo n’a pas pu être enregistrée. Réessayez.');
			}
			update_post_meta($id, self::FILE_META, $file);
		}
		Locappci_Catalogue::flush_cache();
		$mail = Locappci_Reports::email();
		wp_mail($mail, '[LOCAPPCI] Nouvelle demande vendeur : ' . $name,
			"Une demande pour ouvrir une boutique a été envoyée depuis l’appli.\n\nBoutique : $name\nCommune : {$cities[$city]}\n"
			. 'WhatsApp : +' . $wa . "\nCode de vérification : " . get_post_meta($id, self::CODE_META, true)
			. "\n\nÀ vérifier : " . admin_url('tools.php?page=locappci-api#vendeurs'));
		return Locappci_Errors::no_cache(new WP_REST_Response(self::to_app($user), 200));
	}

	// ---------------------------------------------------------------- private files

	private static function dir(): string {
		$up = wp_upload_dir();
		$dir = trailingslashit($up['basedir']) . 'locappci-private';
		if (!is_dir($dir)) {
			wp_mkdir_p($dir);
		}
		if (!file_exists($dir . '/.htaccess')) {
			file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
			file_put_contents($dir . '/index.php', "<?php // Silence.\n");
		}
		return $dir;
	}

	private static function store_file(string $bytes): ?string {
		$name = 'id-' . bin2hex(random_bytes(16)) . '.img';
		return file_put_contents(self::dir() . '/' . $name, $bytes) ? $name : null;
	}

	public static function file_path(int $id): ?string {
		$name = (string) get_post_meta($id, self::FILE_META, true);
		if (!preg_match('/^id-[a-f0-9]{32}\.img$/', $name)) {
			return null;
		}
		$path = self::dir() . '/' . $name;
		return is_file($path) ? $path : null;
	}

	private static function delete_file(int $id): void {
		$path = self::file_path($id);
		if ($path) {
			@unlink($path);
		}
		delete_post_meta($id, self::FILE_META);
	}

	// ---------------------------------------------------------------- owner (section 9)

	/** Requests waiting for the owner. */
	public static function pending(): array {
		return get_posts(['post_type' => 'locappci_boutique', 'post_status' => 'pending', 'meta_key' => self::APP_META,
			'posts_per_page' => 50, 'orderby' => 'date', 'order' => 'ASC', 'suppress_filters' => true]);
	}

	/** Shows the ID photo to an administrator only (admin-post.php?action=locappci_id_photo&id=…). */
	public static function stream_photo(): void {
		$id = (int) ($_GET['id'] ?? 0);
		if (!current_user_can('manage_options') || !check_admin_referer('locappci_id_photo_' . $id)) {
			wp_die('Accès refusé.', 403);
		}
		$path = self::file_path($id);
		if (!$path) {
			wp_die('Photo introuvable (déjà supprimée après la décision ?).', 404);
		}
		$info = getimagesize($path);
		nocache_headers();
		header('Content-Type: ' . ($info['mime'] ?? 'image/jpeg'));
		header('Content-Length: ' . filesize($path));
		readfile($path);
		exit;
	}

	/** Valider / Refuser (admin-post.php?action=locappci_seller_decision). */
	public static function decide(): void {
		$id = (int) ($_POST['id'] ?? 0);
		if (!current_user_can('manage_options') || !check_admin_referer('locappci_seller_' . $id)) {
			wp_die('Accès refusé.', 403);
		}
		$post = get_post($id);
		if (!$post || $post->post_type !== 'locappci_boutique' || !get_post_meta($id, self::APP_META, true)) {
			wp_die('Demande introuvable.', 404);
		}
		$decision = sanitize_key((string) ($_POST['decision'] ?? ''));
		$user = get_user_by('id', (int) $post->post_author);
		if ($decision === 'approve' && $user) {
			wp_update_post(['ID' => $id, 'post_status' => 'publish']);
			update_post_meta($id, '_locappci_boutique_statut', 'validee');
			update_post_meta($id, '_locappci_boutique_verified', 'oui');
			update_post_meta($id, '_locappci_boutique_motif_refus', '');
			$user->add_role(self::VENDOR_ROLE);
			$settings = get_user_meta($user->ID, 'wcfmmp_profile_settings', true);
			$settings = is_array($settings) ? $settings : [];
			$settings['store_name'] = $post->post_title;
			$settings['phone'] = (string) get_post_meta($id, '_locappci_boutique_whatsapp', true);
			update_user_meta($user->ID, 'wcfmmp_profile_settings', $settings);
			update_user_meta($user->ID, 'store_name', $post->post_title);
			update_user_meta($user->ID, 'wcfmmp_store_name', $post->post_title);
			update_user_meta($user->ID, Locappci_Catalogue::COMMUNE_META, (string) get_post_meta($id, '_locappci_boutique_commune', true));
			self::delete_file($id);
			$msg = 'Boutique validée.';
		} elseif ($decision === 'refuse') {
			$reason = trim(sanitize_textarea_field(wp_unslash((string) ($_POST['reason'] ?? ''))));
			update_post_meta($id, '_locappci_boutique_statut', 'refusee');
			update_post_meta($id, '_locappci_boutique_motif_refus', $reason !== '' ? $reason : 'Informations incomplètes.');
			wp_update_post(['ID' => $id, 'post_status' => 'draft']);
			self::delete_file($id);
			$msg = 'Demande refusée.';
		} else {
			wp_die('Décision inconnue.', 400);
		}
		Locappci_Catalogue::flush_cache();
		wp_safe_redirect(add_query_arg('locappci_msg', rawurlencode($msg), admin_url('tools.php?page=locappci-api')) . '#vendeurs');
		exit;
	}
}
