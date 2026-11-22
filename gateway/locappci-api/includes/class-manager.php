<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * The owner's dashboard in the app (client, 21 Nov): figures and everything waiting for him, with Valider / Refuser.
 *
 * Who: app accounts the owner names in Outils → LOCAPPCI API, section 11 (user meta `_locappci_app_manager`).
 * WordPress staff accounts never sign in through the app, so the owner uses a normal customer account for this.
 *
 * GET  /v1/manager/dashboard                  figures for the last 7 and 30 days + counts to validate
 * GET  /v1/manager/queue                      payments, seller requests, articles and reports waiting
 * POST /v1/manager/payments/{id}              { decision: approve | refuse }   (app orders and contact unlocks)
 * POST /v1/manager/sellers/{id}               { decision, reason? }
 * GET  /v1/manager/sellers/{id}/photo         { base64, mime } of the ID photo (until the decision)
 * POST /v1/manager/articles/{id}              { decision, reason? }
 */
final class Locappci_Manager {
	const META = '_locappci_app_manager';

	public static function is_manager(WP_User $u): bool {
		return get_user_meta($u->ID, self::META, true) === '1';
	}

	/** @return WP_User|WP_REST_Response */
	private static function manager(WP_REST_Request $r) {
		$u = Locappci_Accounts::current_user($r);
		if (!$u) {
			return Locappci_Errors::response('unauthorized', 'Connectez-vous.');
		}
		return self::is_manager($u) ? $u : Locappci_Errors::response('validation', 'Réservé au propriétaire de LOCAPPCI.');
	}

	private static function ok($data): WP_REST_Response {
		return Locappci_Errors::no_cache(new WP_REST_Response($data, 200));
	}

	/** App orders (and contact unlocks) created since a time, in the given WooCommerce statuses. */
	private static function app_orders(array $statuses, ?int $since = null, int $limit = 1000): array {
		$q = ['limit' => $limit, 'type' => 'shop_order', 'created_via' => 'locappci-app', 'status' => $statuses, 'orderby' => 'date', 'order' => 'ASC'];
		if ($since) {
			$q['date_created'] = '>' . $since;
		}
		return wc_get_orders($q);
	}

	private static function period(int $days): array {
		$since = time() - $days * DAY_IN_SECONDS;
		$paid = self::app_orders(['processing', 'completed'], $since);
		$sales = ['count' => 0, 'total' => 0, 'commission' => 0];
		$contacts = ['count' => 0, 'total' => 0];
		foreach ($paid as $o) {
			if ($o->get_meta(Locappci_Contacts::META_KIND) === 'contact') {
				$contacts['count']++;
				$contacts['total'] += (int) round((float) $o->get_total());
			} else {
				$sales['count']++;
				$sales['total'] += (int) round((float) $o->get_total());
				$c = $o->get_meta(Locappci_Orders::META_COMMISSION);
				$sales['commission'] += is_array($c) ? (int) ($c['amount'] ?? 0) : 0;
			}
		}
		$after = gmdate('Y-m-d H:i:s', $since);
		$new_buyers = count(get_users(['role' => 'customer', 'fields' => 'ID', 'number' => 5000, 'date_query' => [['after' => $after]]]));
		$new_shops = count(get_posts(['post_type' => 'locappci_boutique', 'post_status' => 'publish', 'fields' => 'ids', 'posts_per_page' => 5000,
			'date_query' => [['after' => $after]], 'suppress_filters' => true]));
		return [
			'days'       => $days,
			'newBuyers'  => $new_buyers,
			'newShops'   => $new_shops,
			'sales'      => $sales,
			'contacts'   => $contacts,
			// What LOCAPPCI earned: its commission on sales + every paid contact fee.
			'earnings'   => $sales['commission'] + $contacts['total'],
		];
	}

	public static function dashboard(WP_REST_Request $r): WP_REST_Response {
		$u = self::manager($r);
		if ($u instanceof WP_REST_Response) {
			return $u;
		}
		$roles = count_users()['avail_roles'] ?? [];
		return self::ok([
			'totals'     => ['buyers' => (int) ($roles['customer'] ?? 0), 'sellers' => (int) ($roles[Locappci_Sellers::VENDOR_ROLE] ?? 0)],
			'week'       => self::period(7),
			'month'      => self::period(30),
			'toValidate' => [
				'payments' => count(self::app_orders(['on-hold'])),
				'sellers'  => count(Locappci_Sellers::pending()),
				'articles' => count(Locappci_Seller_Products::pending()),
				'reports'  => count(array_filter(Locappci_Reports::latest(), fn($x) => strtotime($x['at']) > time() - 7 * DAY_IN_SECONDS)),
			],
			'commissionRate' => Locappci_Marketplace::commission_rate(),
			'contactFee'     => Locappci_Marketplace::contact_fee(),
		]);
	}

	public static function queue(WP_REST_Request $r): WP_REST_Response {
		$u = self::manager($r);
		if ($u instanceof WP_REST_Response) {
			return $u;
		}
		$payments = [];
		foreach (self::app_orders(['on-hold'], null, 50) as $o) {
			$contact = $o->get_meta(Locappci_Contacts::META_KIND) === 'contact';
			$customer = (array) $o->get_meta(Locappci_Orders::META_CUSTOMER);
			$shop = $contact ? (array) $o->get_meta(Locappci_Contacts::META_SHOP) : [];
			$payments[] = [
				'id'           => (string) $o->get_id(),
				'kind'         => $contact ? 'contact' : 'order',
				'number'       => 'LOC-' . $o->get_order_number(),
				'total'        => (int) round((float) $o->get_total()),
				'method'       => (string) $o->get_meta(Locappci_Orders::META_METHOD),
				'reference'    => (string) $o->get_meta(Locappci_Orders::META_REFERENCE),
				'customerName' => (string) ($customer['name'] ?? ''),
				'customerPhone'=> (string) ($customer['phone'] ?? ''),
				'label'        => $contact ? 'Coordonnées de « ' . ($shop['shopName'] ?? '') . ' »' : count($o->get_items()) . ' article(s)',
				'createdAt'    => $o->get_date_created() ? $o->get_date_created()->date('c') : null,
			];
		}
		$cities = array_column(Locappci_Catalogue::cities(), 'id', 'name');
		$sellers = [];
		foreach (Locappci_Sellers::pending() as $p) {
			$owner = get_user_by('id', (int) $p->post_author);
			$commune = (string) get_post_meta($p->ID, '_locappci_boutique_commune', true);
			$sellers[] = [
				'id'          => (string) $p->ID,
				'shopName'    => $p->post_title,
				'cityId'      => $cities[$commune] ?? null,
				'commune'     => $commune,
				'whatsapp'    => Locappci_Catalogue::whatsapp((string) get_post_meta($p->ID, '_locappci_boutique_whatsapp', true)),
				'verifyCode'  => (string) get_post_meta($p->ID, Locappci_Sellers::CODE_META, true),
				'accountName' => $owner ? $owner->display_name : '',
				'description' => (string) $p->post_content,
				'hasPhoto'    => Locappci_Sellers::file_path($p->ID) !== null,
				'submittedAt' => (string) get_post_meta($p->ID, Locappci_Sellers::DATE_META, true) ?: null,
			];
		}
		$articles = [];
		foreach (Locappci_Seller_Products::pending() as $p) {
			$prod = wc_get_product($p->ID);
			if (!$prod) {
				continue;
			}
			$shop = Locappci_Catalogue::shop((int) $p->post_author);
			$a = Locappci_Seller_Products::to_app($prod);
			$articles[] = ['id' => $a['id'], 'name' => $a['name'], 'price' => $a['price'], 'description' => $a['description'],
				'photos' => $a['photos'], 'shopName' => $shop['name'] ?? ''];
		}
		$reports = array_map(fn($x) => ['at' => $x['at'], 'productId' => (string) $x['productId'], 'product' => $x['product'],
			'reason' => Locappci_Reports::REASONS[$x['reason']] ?? $x['reason'], 'details' => $x['details']], array_slice(Locappci_Reports::latest(), 0, 20));
		return self::ok(['payments' => $payments, 'sellers' => $sellers, 'articles' => $articles, 'reports' => $reports]);
	}

	private static function decision(WP_REST_Request $r): array {
		$b = $r->get_json_params();
		$b = is_array($b) ? $b : [];
		return [sanitize_key((string) ($b['decision'] ?? '')), trim(sanitize_textarea_field((string) ($b['reason'] ?? '')))];
	}

	public static function payment(WP_REST_Request $r): WP_REST_Response {
		$u = self::manager($r);
		if ($u instanceof WP_REST_Response) {
			return $u;
		}
		$o = wc_get_order((int) $r['id']);
		if (!$o instanceof WC_Order || $o->get_created_via() !== 'locappci-app') {
			return Locappci_Errors::not_found();
		}
		[$decision] = self::decision($r);
		if ($o->get_status() !== 'on-hold') {
			return Locappci_Errors::response('validation', 'Ce paiement a déjà été traité.');
		}
		$who = $u->display_name;
		if ($decision === 'approve') {
			$o->set_status('processing', 'Transfert vérifié dans l’appli par ' . $who . '.');
		} elseif ($decision === 'refuse') {
			$o->set_status('failed', 'Transfert introuvable (vérifié dans l’appli par ' . $who . ').');
		} else {
			return Locappci_Errors::response('validation', 'Décision inconnue.');
		}
		$o->save();
		return self::ok(['ok' => true]);
	}

	public static function seller(WP_REST_Request $r): WP_REST_Response {
		$u = self::manager($r);
		if ($u instanceof WP_REST_Response) {
			return $u;
		}
		[$decision, $reason] = self::decision($r);
		$id = (int) $r['id'];
		if (get_post_status($id) !== 'pending') {
			return Locappci_Errors::response('validation', 'Cette demande a déjà été traitée.');
		}
		$msg = Locappci_Sellers::apply_decision($id, $decision, $reason);
		return $msg ? self::ok(['ok' => true, 'message' => $msg]) : Locappci_Errors::not_found();
	}

	public static function seller_photo(WP_REST_Request $r): WP_REST_Response {
		$u = self::manager($r);
		if ($u instanceof WP_REST_Response) {
			return $u;
		}
		$path = Locappci_Sellers::file_path((int) $r['id']);
		if (!$path) {
			return Locappci_Errors::not_found();
		}
		$info = getimagesize($path);
		return self::ok(['base64' => base64_encode((string) file_get_contents($path)), 'mime' => $info['mime'] ?? 'image/jpeg']);
	}

	public static function article(WP_REST_Request $r): WP_REST_Response {
		$u = self::manager($r);
		if ($u instanceof WP_REST_Response) {
			return $u;
		}
		[$decision, $reason] = self::decision($r);
		$id = (int) $r['id'];
		if (get_post_meta($id, Locappci_Seller_Products::STATUS, true) !== 'en_attente') {
			return Locappci_Errors::response('validation', 'Cet article a déjà été traité.');
		}
		$msg = Locappci_Seller_Products::apply_decision($id, $decision, $reason);
		return $msg ? self::ok(['ok' => true, 'message' => $msg]) : Locappci_Errors::not_found();
	}
}
