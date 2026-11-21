<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * « Obtenir les coordonnées »: a buyer pays the fee of section 8 to see one seller's phone / WhatsApp
 * (client, 21 Nov). Contract: ContactUnlockRequest → ContactUnlock.
 *
 * POST /v1/contact-unlocks                              create (idempotent on idempotencyKey)
 * GET  /v1/contact-unlocks/{id}                         status; `contact` filled once paid
 * POST /v1/contact-unlocks/{id}/payment-reference       « J'ai payé »
 *
 * Each unlock is a small WooCommerce order (one fee line « Coordonnées du vendeur – <shop> »), so the team
 * checks the transfer exactly like an app order: « En attente » → « En cours » = paid → the app shows the contact.
 * The fee is the one of the day it was asked; a later change in section 8 doesn't touch it.
 */
final class Locappci_Contacts {
	const META_KIND = '_locappci_kind';
	const META_SHOP = '_locappci_contact_shop';

	public static function create(WP_REST_Request $r): WP_REST_Response {
		if (!function_exists('wc_create_order')) {
			return Locappci_Errors::response('unavailable', 'Momentanément indisponible. Réessayez plus tard.');
		}
		$body = $r->get_json_params();
		$body = is_array($body) ? $body : [];
		$key = is_string($body['idempotencyKey'] ?? null) ? trim($body['idempotencyKey']) : '';
		if ($key === '' || strlen($key) > 100) {
			return Locappci_Errors::response('validation', 'Demande incomplète. Réessayez.');
		}
		$existing = self::find_by_key($key);
		if ($existing) {
			return self::ok(self::to_app($existing));
		}

		$fee = Locappci_Marketplace::contact_fee();
		$transfer = Locappci_Orders::transfer_to();
		if ($fee <= 0 || !$transfer) {
			return Locappci_Errors::response('unavailable', 'Ce service arrive bientôt. En attendant, écrivez à LOCAPPCI sur WhatsApp.');
		}
		$method = (string) ($body['paymentMethod'] ?? '');
		if (!isset(Locappci_Orders::METHODS[$method])) {
			return Locappci_Errors::response('validation', 'Choisissez Wave ou Orange Money.');
		}
		$shop_id = (string) ($body['shopId'] ?? '');
		$shop = ctype_digit($shop_id) ? Locappci_Catalogue::shop((int) $shop_id) : null;
		if (!$shop) {
			return Locappci_Errors::response('not_found', 'Cette boutique n’existe plus.');
		}
		if (empty($shop['whatsapp'])) {
			return Locappci_Errors::response('validation', 'Ce vendeur n’a pas encore de numéro. Écrivez à LOCAPPCI sur WhatsApp.');
		}
		$c = is_array($body['customer'] ?? null) ? $body['customer'] : [];
		$name = trim(preg_replace('/\s+/', ' ', sanitize_text_field((string) ($c['name'] ?? ''))));
		$phone = Locappci_Accounts::phone((string) ($c['phone'] ?? ''));
		if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
			return Locappci_Errors::response('validation', 'Indiquez votre nom.');
		}
		if ($phone === '') {
			return Locappci_Errors::response('validation', Locappci_Accounts::BAD_PHONE);
		}

		$bucket = 'locappci_contacts_' . substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '0') . wp_salt('nonce')), 0, 32);
		$count = (int) get_transient($bucket);
		if ($count >= Locappci_Orders::MAX_PER_HOUR) {
			return Locappci_Errors::response('rate_limited', 'Trop de demandes en peu de temps. Réessayez dans une heure.');
		}

		$user = Locappci_Accounts::current_user($r);
		$order = wc_create_order(['customer_id' => $user ? $user->ID : 0, 'created_via' => 'locappci-app']);
		if (is_wp_error($order)) {
			return Locappci_Errors::response('server_error', 'La demande n’a pas pu être enregistrée. Réessayez.');
		}
		$line = new WC_Order_Item_Fee();
		$line->set_name('Coordonnées du vendeur – ' . $shop['name']);
		$line->set_amount((string) $fee);
		$line->set_total((string) $fee);
		$line->set_tax_status('none');
		$order->add_item($line);
		$order->set_address(['first_name' => $name, 'phone' => Locappci_Accounts::readable_phone($phone), 'country' => 'CI',
			'email' => $user ? (string) $user->user_email : ''], 'billing');
		$order->set_payment_method('locappci_' . $method);
		$order->set_payment_method_title(Locappci_Orders::METHODS[$method]);
		$order->update_meta_data(self::META_KIND, 'contact');
		$order->update_meta_data(self::META_SHOP, ['shopId' => $shop['id'], 'shopName' => $shop['name']]);
		$order->update_meta_data(Locappci_Orders::META_KEY, $key);
		$order->update_meta_data(Locappci_Orders::META_METHOD, $method);
		$order->update_meta_data(Locappci_Orders::META_CUSTOMER, ['name' => $name, 'phone' => $phone, 'address' => '']);
		$order->update_meta_data(Locappci_Orders::META_TRANSFER, $transfer);
		$order->calculate_totals(false);
		$order->set_status('pending', 'Coordonnées du vendeur « ' . $shop['name'] . ' » demandées depuis l’appli. En attente du transfert.');
		$order->save();

		set_transient($bucket, $count + 1, HOUR_IN_SECONDS);
		return self::ok(self::to_app(wc_get_order($order->get_id())), 201);
	}

	public static function get(WP_REST_Request $r): WP_REST_Response {
		$o = self::from_app_id((string) $r['id']);
		return $o ? self::ok(self::to_app($o)) : Locappci_Errors::response('not_found', 'Demande introuvable.');
	}

	public static function payment_reference(WP_REST_Request $r): WP_REST_Response {
		$o = self::from_app_id((string) $r['id']);
		if (!$o) {
			return Locappci_Errors::response('not_found', 'Demande introuvable.');
		}
		$body = $r->get_json_params();
		$ref = preg_replace('/\s+/', '', (string) (is_array($body) ? ($body['reference'] ?? '') : ''));
		if (!preg_match(Locappci_Orders::REFERENCE, $ref)) {
			return Locappci_Errors::response('validation', 'Référence invalide : recopiez l’identifiant de la transaction reçu par SMS.');
		}
		if (!in_array($o->get_status(), ['processing', 'completed', 'cancelled', 'refunded'], true)
			&& $ref !== (string) $o->get_meta(Locappci_Orders::META_REFERENCE)) {
			$o->update_meta_data(Locappci_Orders::META_REFERENCE, $ref);
			$o->set_transaction_id($ref);
			$o->set_status('on-hold', 'Référence de transfert envoyée depuis l’appli : ' . $ref
				. '. À vérifier, puis passer « En cours » : l’acheteur verra les coordonnées du vendeur.');
			$o->save();
		}
		return self::ok(self::to_app($o));
	}

	private static function find_by_key(string $key): ?WC_Order {
		$found = wc_get_orders([
			'limit'       => 1,
			'type'        => 'shop_order',
			'created_via' => 'locappci-app',
			'meta_query'  => [['key' => Locappci_Orders::META_KEY, 'value' => $key], ['key' => self::META_KIND, 'value' => 'contact']],
		]);
		return $found ? $found[0] : null;
	}

	private static function from_app_id(string $app_id): ?WC_Order {
		$o = Locappci_Orders::from_app_id($app_id);
		return ($o && $o->get_meta(self::META_KIND) === 'contact') ? $o : null;
	}

	private static function ok(array $data, int $status = 200): WP_REST_Response {
		return Locappci_Errors::no_cache(new WP_REST_Response($data, $status));
	}

	public static function to_app(WC_Order $o): array {
		[$status] = Locappci_Orders::status($o);
		$status = in_array($status, ['pending_payment', 'awaiting_confirmation', 'paid'], true) ? $status : 'cancelled';
		$meta = (array) $o->get_meta(self::META_SHOP);
		$contact = null;
		if ($status === 'paid') {
			// Read now, so a seller who changed number is shown with the new one.
			$shop = Locappci_Catalogue::shop((int) ($meta['shopId'] ?? 0));
			$contact = ['whatsapp' => $shop['whatsapp'] ?? null];
		}
		$transfer = $o->get_meta(Locappci_Orders::META_TRANSFER);
		$ref = (string) $o->get_meta(Locappci_Orders::META_REFERENCE);
		$created = $o->get_date_created();
		return [
			'id'               => $o->get_id() . '-' . $o->get_order_key(),
			'shopId'           => (string) ($meta['shopId'] ?? ''),
			'shopName'         => (string) ($meta['shopName'] ?? ''),
			'status'           => $status,
			'paymentMethod'    => (string) $o->get_meta(Locappci_Orders::META_METHOD) ?: 'wave',
			'total'            => (int) round((float) $o->get_total()),
			'transferTo'       => is_array($transfer) ? $transfer : null,
			'paymentReference' => $ref !== '' ? $ref : null,
			'createdAt'        => $created ? $created->date('c') : gmdate('c'),
			'contact'          => $contact,
		];
	}
}
