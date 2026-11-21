<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * GET /v1/delivery-options: each shop's delivery choices for the checkout (contract: ShopDelivery[]).
 *
 * - « À domicile »: priced by distance between the shop's commune and the delivery commune,
 *   base + price per km (Outils → LOCAPPCI API, section 4), rounded up to 100 FCFA.
 *   When a distance can't be worked out (shop or delivery place outside the known communes, e.g. a
 *   London shop), the option is still offered with `toConfirm: true`: the shop confirms the price.
 * - « Retrait en boutique »: free, only for shops in a known commune.
 * Read-only: nothing is written.
 */
final class Locappci_Delivery {
	/** Defaults until the client gives the real tariff (sample used by the app since October). */
	const DEFAULT_BASE = 1000;
	const DEFAULT_PER_KM = 150;
	const MAX_SHOPS = 20;

	/**
	 * Rough centre of each Abidjan commune (latitude, longitude), keyed by city id.
	 * Only used to estimate a road distance; a commune added in section 3 without a point here gets « Prix à confirmer ».
	 */
	const POINTS = [
		'abobo'       => [5.418, -4.020],
		'adjame'      => [5.367, -4.022],
		'anyama'      => [5.495, -4.052],
		'attecoube'   => [5.335, -4.040],
		'bingerville' => [5.355, -3.885],
		'cocody'      => [5.354, -3.990],
		'koumassi'    => [5.297, -3.950],
		'marcory'     => [5.302, -3.983],
		'plateau'     => [5.323, -4.023],
		'port-bouet'  => [5.255, -3.927],
		'songon'      => [5.315, -4.255],
		'treichville' => [5.300, -4.010],
		'yopougon'    => [5.336, -4.088],
	];

	/** @return array{base: int, perKm: int} FCFA */
	public static function tariff(): array {
		return [
			'base'  => max(0, (int) get_option('locappci_delivery_base', self::DEFAULT_BASE)),
			'perKm' => max(0, (int) get_option('locappci_delivery_per_km', self::DEFAULT_PER_KM)),
		];
	}

	public static function options(WP_REST_Request $r): WP_REST_Response {
		$ids = array_values(array_unique(array_filter(array_map('trim', explode(',', (string) $r->get_param('shops'))))));
		if (!$ids) {
			return Locappci_Errors::response('validation', 'Aucune boutique dans le panier.');
		}
		if (count($ids) > self::MAX_SHOPS) {
			return Locappci_Errors::response('validation', 'Trop de boutiques dans une seule commande.');
		}
		$to = Locappci_Catalogue::city_id((string) $r->get_param('city'));
		$known = array_column(Locappci_Catalogue::cities(), 'name', 'id');
		if ($to !== '' && !isset($known[$to])) {
			return Locappci_Errors::response('validation', 'Commune de livraison inconnue.');
		}

		$out = [];
		foreach ($ids as $id) {
			if (!ctype_digit($id)) {
				return Locappci_Errors::response('validation', 'Boutique inconnue.');
			}
			$shop = Locappci_Catalogue::shop((int) $id);
			if (!$shop) {
				return Locappci_Errors::response('not_found', 'Cette boutique n’existe plus.');
			}
			$out[] = ['shopId' => $shop['id'], 'options' => self::for_shop($shop['cityId'], $to, $known)];
		}
		return Locappci_Errors::no_cache(new WP_REST_Response($out, 200));
	}

	/** @param array<string, string> $known city id → name */
	public static function for_shop(string $from, string $to, array $known): array {
		$km = self::road_km($from, $to);
		$home = ['id' => 'home', 'kind' => 'home', 'label' => 'À domicile'];
		if ($km !== null) {
			$home += ['price' => self::price($km), 'detail' => '≈ ' . $km . ' km · 24–48 h'];
		} else {
			// No commune yet for the customer: ask for it; otherwise the place is out of reach of the estimate.
			$detail = ($to === '' && isset(self::POINTS[$from])) ? 'Indiquez votre commune' : 'La boutique vous contacte';
			$home += ['price' => 0, 'detail' => $detail, 'toConfirm' => true];
		}
		$options = [$home];
		if ($from !== '' && isset($known[$from])) {
			$options[] = ['id' => 'pickup', 'kind' => 'pickup', 'label' => 'Retrait en boutique', 'price' => 0, 'detail' => $known[$from]];
		}
		return $options;
	}

	/** Road kilometres between two communes: straight line × 1.3, at least 3 km. null when either place has no point. */
	public static function road_km(string $from, string $to): ?int {
		$a = self::POINTS[$from] ?? null;
		$b = self::POINTS[$to] ?? null;
		if (!$a || !$b) {
			return null;
		}
		$km_lat = ($a[0] - $b[0]) * 111;
		$km_lng = ($a[1] - $b[1]) * 111 * cos(deg2rad($a[0]));
		return max(3, (int) round(hypot($km_lat, $km_lng) * 1.3));
	}

	/** base + per km, rounded up to 100 FCFA (same formula as the app's mock). */
	public static function price(int $km): int {
		$t = self::tariff();
		return (int) (ceil(($t['base'] + $t['perKm'] * $km) / 100) * 100);
	}
}
