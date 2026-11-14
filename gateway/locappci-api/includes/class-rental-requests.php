<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * « Envoyer aux loueurs » from the app.
 *
 * Writes the same records as the website's own form (Code Snippet « LOCAPPCI – Demandes Location
 * OFFICIEL STABLE », ajax action locappci_submit_location_request): one `locappci_loc_req` post per
 * item, authored by the customer, with the `_locappci_req_*` fields the loueur's page
 * (/mes-demandes-location/), the calendar and the statistics read. Status starts at `new`.
 * Like the website, it needs a signed-in account and sends no e-mail: the loueur sees the request
 * on his page.
 */
final class Locappci_Rental_Requests {
	const POST_TYPE = 'locappci_loc_req';
	const KEYS_META = '_locappci_app_req_keys';   // idempotency keys already handled, per customer
	const MAX_ITEMS = 30;

	private static function fail(string $message): WP_REST_Response {
		return Locappci_Errors::response('validation', $message);
	}

	/** The number as the loueur reads it ("+225 07 00 00 00 00", "+447700900123"), or '' when it is not valid. */
	private static function readable_phone(string $input): string {
		return Locappci_Accounts::readable_phone(Locappci_Accounts::phone($input));
	}

	/** Today's date on the site's clock (Africa/Abidjan in production). */
	private static function today(): string {
		return wp_date('Y-m-d');
	}

	private static function valid_date(string $date): bool {
		if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m)) {
			return false;
		}
		return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
	}

	/** The price line the loueur reads, like the website's « Prix indiqué ». */
	private static function price_text(WC_Product $p): string {
		$price = (int) Locappci_Catalogue::rental_fields($p)['pricePerDay'];
		return $price > 0 ? number_format($price, 0, ',', ' ') . ' FCFA / jour' : 'Prix à confirmer';
	}

	private static function city_name(string $city_id): string {
		foreach (Locappci_Catalogue::cities() as $c) {
			if ($c['id'] === $city_id) {
				return $c['name'];
			}
		}
		return '';
	}

	/** POST /v1/rental-requests (signed in) → RentalRequestReceipt */
	public static function send(WP_REST_Request $r): WP_REST_Response {
		$user = Locappci_Accounts::current_user($r);
		if (!$user) {
			return Locappci_Errors::response('unauthorized', 'Connectez-vous pour envoyer votre demande aux loueurs, ou envoyez-la sur WhatsApp.');
		}
		$body = $r->get_json_params();
		$body = is_array($body) ? $body : [];
		$key = is_string($body['idempotencyKey'] ?? null) ? trim($body['idempotencyKey']) : '';
		$items = is_array($body['items'] ?? null) ? array_values($body['items']) : [];
		$contact = is_array($body['contact'] ?? null) ? $body['contact'] : [];

		if ($key === '' || strlen($key) > 100) {
			return self::fail('Demande incomplète. Réessayez.');
		}
		// The same list sent again (double tap, lost connection): answer with the first result, create nothing.
		$known = get_user_meta($user->ID, self::KEYS_META, true);
		$known = is_array($known) ? $known : [];
		// Kept one day: long enough for a retry, short enough that the same list can be sent again next week.
		$known = array_filter($known, fn($k) => is_array($k) && (int) ($k['at'] ?? 0) > time() - DAY_IN_SECONDS);
		$key_hash = hash('sha256', $key);
		if (isset($known[$key_hash]['receipt'])) {
			return Locappci_Errors::no_cache(new WP_REST_Response($known[$key_hash]['receipt'], 200));
		}

		// Contact
		$name = is_string($contact['name'] ?? null) ? trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($contact['name']))) : '';
		$name_len = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
		if ($name_len < 2 || $name_len > 80) {
			return self::fail('Indiquez votre nom.');
		}
		$phone = self::readable_phone(is_string($contact['phone'] ?? null) ? $contact['phone'] : '');
		if ($phone === '') {
			return self::fail(Locappci_Accounts::BAD_PHONE);
		}
		$whatsapp = '';
		if (isset($contact['whatsapp']) && $contact['whatsapp'] !== '') {
			$whatsapp = self::readable_phone(is_string($contact['whatsapp']) ? $contact['whatsapp'] : '');
			if ($whatsapp === '') {
				return self::fail('Numéro WhatsApp invalide.');
			}
		}
		$message = is_string($contact['message'] ?? null) ? trim(sanitize_textarea_field($contact['message'])) : '';
		if ((function_exists('mb_strlen') ? mb_strlen($message) : strlen($message)) > 500) {
			return self::fail('Le message ne doit pas dépasser 500 caractères.');
		}
		if (!$items) {
			return self::fail('Votre demande est vide.');
		}
		if (count($items) > self::MAX_ITEMS) {
			return self::fail('Trop de matériels dans une seule demande (' . self::MAX_ITEMS . ' au maximum).');
		}
		// A customer who sends list after list: slow down (each request reaches real loueurs).
		$bucket = 'locappci_rq_' . $user->ID;
		$recent = (int) get_transient($bucket);
		if ($recent >= (int) apply_filters('locappci_rental_requests_per_hour', 10)) {
			return Locappci_Errors::response('rate_limited', 'Vous avez envoyé beaucoup de demandes. Réessayez dans une heure.');
		}

		// Check every item before writing anything: a refused list creates no half-sent request.
		$today = self::today();
		$todo = [];
		$skipped = [];
		foreach ($items as $item) {
			$item = is_array($item) ? $item : [];
			$product_id = absint($item['productId'] ?? 0);
			$p = $product_id ? wc_get_product($product_id) : null;
			$loueur_id = $p ? (int) get_post_field('post_author', $product_id) : 0;
			if (!$p || !Locappci_Catalogue::is_shown($p) || !Locappci_Catalogue::is_rental($p) || !$loueur_id) {
				$skipped[] = (string) ($item['productId'] ?? '');
				continue;
			}
			$label = '« ' . html_entity_decode(wp_strip_all_tags($p->get_name()), ENT_QUOTES, 'UTF-8') . ' »';
			$start = is_string($item['startDate'] ?? null) ? $item['startDate'] : '';
			if (!self::valid_date($start) || $start < $today) {
				return self::fail($label . ' : choisissez une date à partir d’aujourd’hui.');
			}
			$rental = Locappci_Catalogue::rental_fields($p);
			$days = $item['days'] ?? null;
			if (!is_int($days) || $days < $rental['minDays'] || $days > $rental['maxDays']) {
				return self::fail($label . ' : durée possible de ' . $rental['minDays'] . ' à ' . $rental['maxDays'] . ' jours.');
			}
			$qty = $item['quantity'] ?? null;
			if (!is_int($qty) || $qty < 1 || $qty > 99) {
				return self::fail($label . ' : quantité invalide.');
			}
			$city = self::city_name(is_string($item['cityId'] ?? null) ? $item['cityId'] : '');
			if ($city === '') {
				return self::fail($label . ' : choisissez la commune.');
			}
			$todo[] = compact('p', 'product_id', 'loueur_id', 'start', 'days', 'qty', 'city');
		}
		if (!$todo) {
			return self::fail('Ces matériels ne sont plus proposés à la location.');
		}

		// Write: same title, text and fields as the website's form.
		$batch = 'LOCREQ-' . time() . '-' . wp_generate_password(6, false, false);
		$sent = [];
		foreach ($todo as $t) {
			$title = get_the_title($t['product_id']);
			$content = "Nouvelle demande de location LOCAPPCI.\n\n"
				. 'Matériel : ' . $title . "\n"
				. 'Quantité : ' . $t['qty'] . "\n"
				. 'Durée : ' . $t['days'] . " jour(s)\n"
				. 'Date souhaitée : ' . $t['start'] . "\n"
				. 'Ville / commune : ' . $t['city'] . "\n"
				. ($message !== '' ? "\nMessage client :\n" . $message . "\n" : '')
				. "\nEnvoyée depuis l’appli LOCAPPCI.\n";
			$request_id = wp_insert_post([
				'post_type'    => self::POST_TYPE,
				'post_status'  => 'publish',
				'post_title'   => 'Demande location – ' . $title . ' – ' . current_time('d/m/Y H:i'),
				'post_content' => $content,
				'post_author'  => $user->ID,
			], true);
			if (is_wp_error($request_id) || !$request_id) {
				$skipped[] = (string) $t['product_id'];
				continue;
			}
			$images = Locappci_Catalogue::images($t['p']);
			$fields = [
				'status'            => 'new',
				'batch_id'          => $batch,
				'product_id'        => $t['product_id'],
				'product_title'     => $title,
				'product_url'       => get_permalink($t['product_id']),
				'product_image'     => $images[0] ?? '',
				'loueur_id'         => $t['loueur_id'],
				'customer_id'       => $user->ID,
				'customer_name'     => $name,
				'customer_email'    => $user->user_email,
				'customer_phone'    => $phone,
				'customer_whatsapp' => $whatsapp,
				'qty'               => $t['qty'],
				'days'              => $t['days'],
				'start_date'        => $t['start'],
				'city'              => $t['city'],
				'notes'             => $message,
				'price'             => self::price_text($t['p']),
				'created_at'        => current_time('mysql'),
				'source'            => 'app',   // extra field: tells the team the request came from the app
			];
			foreach ($fields as $k => $v) {
				update_post_meta($request_id, '_locappci_req_' . $k, $v);
			}
			$shop = Locappci_Catalogue::shop($t['loueur_id']);
			$sent[] = ['productId' => (string) $t['product_id'], 'shopName' => $shop['name'] ?? ''];
		}
		if (!$sent) {
			return Locappci_Errors::response('server_error', 'La demande n’a pas pu être enregistrée. Réessayez dans un instant.');
		}

		$receipt = ['reference' => $batch, 'sent' => $sent, 'skipped' => array_values(array_filter($skipped, 'strlen'))];
		$known[$key_hash] = ['receipt' => $receipt, 'at' => time()];
		uasort($known, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0));
		update_user_meta($user->ID, self::KEYS_META, array_slice($known, 0, 20, true));
		set_transient($bucket, $recent + 1, HOUR_IN_SECONDS);

		return Locappci_Errors::no_cache(new WP_REST_Response($receipt, 201));
	}

	/** For the diagnostics page: requests sent from the app. */
	public static function count(): int {
		global $wpdb;
		return (int) $wpdb->get_var(
			"SELECT COUNT(*) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			 WHERE pm.meta_key = '_locappci_req_source' AND pm.meta_value = 'app' AND p.post_type = '" . self::POST_TYPE . "'"
		);
	}
}
