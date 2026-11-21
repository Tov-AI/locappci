<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Orders from the app, as real WooCommerce orders (contract: OrderRequest → Order).
 *
 * POST /v1/orders                              create (idempotent on idempotencyKey)
 * GET  /v1/orders/{id}                         tracking (« Suivi », « Mes commandes »)
 * POST /v1/orders/{id}/payment-reference       « J'ai payé »: the transfer reference
 *
 * v1 payment (client, 26 Oct): no Wave / Orange Money merchant account, so the customer sends the total
 * by transfer to the LOCAPPCI number (Outils → LOCAPPCI API, section 5) and types the reference.
 * The team checks it in WooCommerce and moves the order to « En cours » (paid) then « Terminée » (delivered).
 *
 * The app's order id is "<order id>-<order key>": only the phone that placed the order can read it.
 */
final class Locappci_Orders {
	const META_KEY = '_locappci_idempotency_key';
	const META_SHOPS = '_locappci_shops';
	const META_CUSTOMER = '_locappci_customer';
	const META_TRANSFER = '_locappci_transfer_to';
	const META_METHOD = '_locappci_payment_method';
	const META_REFERENCE = '_locappci_payment_reference';
	const META_COMMISSION = '_locappci_commission';
	const REFERENCE = '/^[A-Za-z0-9._-]{6,40}$/';
	const MAX_PER_HOUR = 10;
	const METHODS = ['wave' => 'Wave (transfert)', 'orange_money' => 'Orange Money (transfert)'];

	/** @return array{number: string, name: string}|null */
	public static function transfer_to(): ?array {
		$number = preg_replace('/\D+/', '', (string) get_option('locappci_transfer_number', ''));
		$name = trim((string) get_option('locappci_transfer_name', 'LOCAPPCI'));
		return $number !== '' ? ['number' => $number, 'name' => $name !== '' ? $name : 'LOCAPPCI'] : null;
	}

	private static function fail(string $message): WP_REST_Response {
		return Locappci_Errors::response('validation', $message);
	}

	private static function ok(array $data, int $status = 200): WP_REST_Response {
		return Locappci_Errors::no_cache(new WP_REST_Response($data, $status));
	}

	// ---------------------------------------------------------------- create

	public static function create(WP_REST_Request $r): WP_REST_Response {
		if (!function_exists('wc_create_order')) {
			return Locappci_Errors::response('unavailable', 'Le paiement est momentanément indisponible. Réessayez plus tard.');
		}
		$body = $r->get_json_params();
		$body = is_array($body) ? $body : [];
		$key = is_string($body['idempotencyKey'] ?? null) ? trim($body['idempotencyKey']) : '';
		if ($key === '' || strlen($key) > 100) {
			return self::fail('Commande incomplète. Réessayez.');
		}

		// The same checkout sent again (double tap, lost connection): the first order, nothing new.
		$existing = self::find_by_key($key);
		if ($existing) {
			return self::ok(self::to_app($existing));
		}

		$method = (string) ($body['paymentMethod'] ?? '');
		if (!isset(self::METHODS[$method])) {
			return self::fail('Choisissez Wave ou Orange Money.'); // No cash on delivery in v1 (client).
		}
		$transfer = self::transfer_to();
		if (!$transfer) {
			return Locappci_Errors::response('unavailable', 'Le paiement dans l’appli arrive bientôt. En attendant, commandez sur WhatsApp.');
		}

		$c = is_array($body['customer'] ?? null) ? $body['customer'] : [];
		$name = trim(preg_replace('/\s+/', ' ', sanitize_text_field((string) ($c['name'] ?? ''))));
		$phone = Locappci_Accounts::phone((string) ($c['phone'] ?? ''));
		$address = trim(sanitize_textarea_field((string) ($c['address'] ?? '')));
		if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
			return self::fail('Indiquez votre nom.');
		}
		if ($phone === '') {
			return self::fail(Locappci_Accounts::BAD_PHONE);
		}
		if (mb_strlen($address) > 300) {
			return self::fail('Adresse trop longue (300 caractères au plus).');
		}

		$lines = is_array($body['lines'] ?? null) ? array_values($body['lines']) : [];
		if (!$lines) {
			return self::fail('Votre panier est vide.');
		}
		if (count($lines) > 100) {
			return self::fail('Panier invalide.');
		}

		// Same check as « Vérifier le panier »: anything changed → the app shows the cart again, nothing is created.
		$items = [];
		foreach ($lines as $line) {
			$line = is_array($line) ? $line : [];
			$check = Locappci_Routes::check_line($line);
			if (!$check['ok'] || $check['priceChanged']) {
				return Locappci_Errors::response('cart_changed', 'Votre panier a changé. Vérifiez-le avant de payer.');
			}
			$product = wc_get_product((int) $check['productId']);
			$items[] = ['product' => $product, 'qty' => (int) $line['quantity'], 'price' => $check['price']];
		}

		// One delivery choice per shop, priced again here (never trust a price sent by the phone).
		$to = Locappci_Catalogue::city_id((string) ($body['deliveryCityId'] ?? ''));
		$known = array_column(Locappci_Catalogue::cities(), 'name', 'id');
		if ($to !== '' && !isset($known[$to])) {
			return self::fail('Commune de livraison inconnue.');
		}
		$choices = [];
		foreach ((array) ($body['deliveries'] ?? []) as $d) {
			if (is_array($d) && isset($d['shopId'], $d['optionId'])) {
				$choices[(string) $d['shopId']] = (string) $d['optionId'];
			}
		}
		$shops = [];
		$delivery_total = 0;
		$home = false;
		foreach ($items as $it) {
			$vendor = Locappci_Catalogue::vendor_id($it['product']);
			$shop_id = (string) $vendor;
			if (!isset($shops[$shop_id])) {
				$shop = Locappci_Catalogue::shop($vendor);
				$option = null;
				foreach (Locappci_Delivery::for_shop($shop['cityId'] ?? '', $to, $known) as $o) {
					if ($o['id'] === ($choices[$shop_id] ?? '')) {
						$option = $o;
					}
				}
				if (!$shop || !$option) {
					return self::fail('Choisissez une livraison pour chaque boutique.');
				}
				$delivery_total += $option['price'];
				$home = $home || $option['kind'] === 'home';
				$shops[$shop_id] = [
					'shopId'   => $shop_id,
					'shopName' => $shop['name'],
					'whatsapp' => $shop['whatsapp'],
					'delivery' => ['kind' => $option['kind'], 'label' => $option['label'], 'detail' => $option['detail'], 'price' => $option['price'], 'toConfirm' => !empty($option['toConfirm'])],
					'lines'    => [],
				];
			}
			$shops[$shop_id]['lines'][] = ['name' => $it['product']->get_name(), 'quantity' => $it['qty']];
		}
		if ($home && mb_strlen($address) < 3) {
			return self::fail('Indiquez votre adresse de livraison.');
		}

		// Light limit against scripts: the idempotency key already absorbs honest retries.
		$bucket = 'locappci_orders_' . substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '0') . wp_salt('nonce')), 0, 32);
		$count = (int) get_transient($bucket);
		if ($count >= self::MAX_PER_HOUR) {
			return Locappci_Errors::response('rate_limited', 'Trop de commandes en peu de temps. Réessayez dans une heure.');
		}

		$user = Locappci_Accounts::current_user($r);
		$order = wc_create_order(['customer_id' => $user ? $user->ID : 0, 'created_via' => 'locappci-app']);
		if (is_wp_error($order)) {
			return Locappci_Errors::response('server_error', 'La commande n’a pas pu être enregistrée. Réessayez.');
		}
		foreach ($items as $it) {
			$order->add_product($it['product'], $it['qty']);
		}
		foreach ($shops as $s) {
			$ship = new WC_Order_Item_Shipping();
			$ship->set_method_title($s['delivery']['label'] . ' – ' . $s['shopName'] . ($s['delivery']['toConfirm'] ? ' (prix à confirmer)' : ''));
			$ship->set_method_id('locappci_' . $s['delivery']['kind']);
			$ship->set_total((string) $s['delivery']['price']);
			$ship->add_meta_data('vendor_id', $s['shopId'], true); // WCFM reads the shop of a shipping line from vendor_id.
			$ship->add_meta_data('Détail', $s['delivery']['detail'], true);
			$order->add_item($ship);
		}
		$city_name = $to !== '' ? $known[$to] : '';
		$order->set_address([
			'first_name' => $name,
			'phone'      => Locappci_Accounts::readable_phone($phone),
			'address_1'  => $address,
			'city'       => $city_name,
			'country'    => 'CI',
			'email'      => $user ? (string) $user->user_email : '',
		], 'billing');
		if ($home) {
			$order->set_address(['first_name' => $name, 'phone' => Locappci_Accounts::readable_phone($phone), 'address_1' => $address, 'city' => $city_name, 'country' => 'CI'], 'shipping');
		}
		$order->set_payment_method('locappci_' . $method);
		$order->set_payment_method_title(self::METHODS[$method]);
		$order->update_meta_data(self::META_KEY, $key);
		$order->update_meta_data(self::META_METHOD, $method);
		$order->update_meta_data(self::META_SHOPS, array_values($shops));
		$order->update_meta_data(self::META_CUSTOMER, ['name' => $name, 'phone' => $phone, 'address' => $address]);
		$order->update_meta_data(self::META_TRANSFER, $transfer);
		$order->calculate_totals(false);
		// LOCAPPCI's share, frozen at the rate of the day (section 8): a later change does not touch old orders.
		$items_total = (int) round((float) $order->get_subtotal());
		$commission = ['rate' => Locappci_Marketplace::commission_rate(), 'amount' => Locappci_Marketplace::commission($items_total)];
		$order->update_meta_data(self::META_COMMISSION, $commission);
		$order->set_status('pending', 'Commande passée depuis l’appli LOCAPPCI. En attente du transfert ' . self::METHODS[$method] . '. '
			. 'Commission LOCAPPCI : ' . $commission['rate'] . ' % = ' . number_format($commission['amount'], 0, ',', ' ') . ' FCFA.');
		$order->save();
		// WCFM builds each shop's order list from this hook, as for an order placed on the website.
		do_action('woocommerce_checkout_order_processed', $order->get_id(), [], $order);

		set_transient($bucket, $count + 1, HOUR_IN_SECONDS);
		return self::ok(self::to_app(wc_get_order($order->get_id())), 201);
	}

	private static function find_by_key(string $key): ?WC_Order {
		$found = wc_get_orders([
			'limit'       => 1,
			'type'        => 'shop_order',
			'created_via' => 'locappci-app',
			'meta_query'  => [['key' => self::META_KEY, 'value' => $key]],
		]);
		return $found ? $found[0] : null;
	}

	// ---------------------------------------------------------------- read

	/** "<id>-<order key>" → the order, or null (wrong key looks the same as no order). */
	private static function from_app_id(string $app_id): ?WC_Order {
		if (!preg_match('/^(\d+)-(wc_order_[A-Za-z0-9]+)$/', $app_id, $m)) {
			return null;
		}
		$order = wc_get_order((int) $m[1]);
		if (!$order instanceof WC_Order || !hash_equals($order->get_order_key(), $m[2]) || $order->get_created_via() !== 'locappci-app') {
			return null;
		}
		return $order;
	}

	public static function get(WP_REST_Request $r): WP_REST_Response {
		$order = self::from_app_id((string) $r['id']);
		return $order ? self::ok(self::to_app($order)) : Locappci_Errors::response('not_found', 'Commande introuvable.');
	}

	public static function payment_reference(WP_REST_Request $r): WP_REST_Response {
		$order = self::from_app_id((string) $r['id']);
		if (!$order) {
			return Locappci_Errors::response('not_found', 'Commande introuvable.');
		}
		$body = $r->get_json_params();
		$ref = preg_replace('/\s+/', '', (string) (is_array($body) ? ($body['reference'] ?? '') : ''));
		if (!preg_match(self::REFERENCE, $ref)) {
			return self::fail('Référence invalide : recopiez l’identifiant de la transaction reçu par SMS.');
		}
		// Already paid or cancelled: nothing to change.
		if (in_array($order->get_status(), ['processing', 'completed', 'cancelled', 'refunded'], true)) {
			return self::ok(self::to_app($order));
		}
		if ($ref !== (string) $order->get_meta(self::META_REFERENCE)) {
			$order->update_meta_data(self::META_REFERENCE, $ref);
			$order->set_transaction_id($ref);
			// « En attente »: the team checks the transfer, then sets « En cours ». WooCommerce e-mails the admin.
			$order->set_status('on-hold', 'Référence de transfert envoyée depuis l’appli : ' . $ref . '. À vérifier avant de passer la commande « En cours ».');
			$order->save();
		}
		return self::ok(self::to_app($order));
	}

	// ---------------------------------------------------------------- shape

	/** WooCommerce status → the app's status and « Suivi » step. */
	public static function status(WC_Order $o): array {
		switch ($o->get_status()) {
			case 'on-hold':
				return ['awaiting_confirmation', 'confirmed'];
			case 'processing':
				return ['paid', 'preparing'];
			case 'completed':
				return ['paid', 'delivered'];
			case 'cancelled':
			case 'refunded':
				return ['cancelled', 'confirmed'];
			case 'failed':
				return ['payment_failed', 'confirmed'];
			default:
				return ['pending_payment', 'confirmed'];
		}
	}

	public static function to_app(WC_Order $o): array {
		[$status, $step] = self::status($o);
		$shipping = (int) round((float) $o->get_shipping_total());
		$total = (int) round((float) $o->get_total());
		// Client: the seller's WhatsApp is shown once the buyer has paid (« En cours » or « Terminée »), not before.
		$paid = $status === 'paid';
		$shops = array_map(function ($s) use ($paid) {
			unset($s['delivery']['price'], $s['delivery']['toConfirm']);
			if (!$paid) {
				$s['whatsapp'] = null;
			}
			return $s;
		}, (array) $o->get_meta(self::META_SHOPS));
		$transfer = $o->get_meta(self::META_TRANSFER);
		$reference = (string) $o->get_meta(self::META_REFERENCE);
		$created = $o->get_date_created();
		return [
			'id'               => $o->get_id() . '-' . $o->get_order_key(),
			'number'           => 'LOC-' . $o->get_order_number(),
			'status'           => $status,
			'paymentMethod'    => (string) $o->get_meta(self::META_METHOD) ?: 'wave',
			'itemsTotal'       => $total - $shipping,
			'deliveryTotal'    => $shipping,
			'total'            => $total,
			'paymentUrl'       => null,
			'transferTo'       => is_array($transfer) ? $transfer : null,
			'paymentReference' => $reference !== '' ? $reference : null,
			'createdAt'        => $created ? $created->date('c') : gmdate('c'),
			'step'             => $step,
			'customer'         => (array) $o->get_meta(self::META_CUSTOMER),
			'shops'            => array_values($shops),
		];
	}
}
