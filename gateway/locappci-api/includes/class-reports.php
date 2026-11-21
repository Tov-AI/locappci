<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * POST /v1/products/{id}/reports: « Signaler cette annonce » (contract: ProductReport → 204).
 *
 * Each report is e-mailed to the LOCAPPCI team (Outils → LOCAPPCI API, section 6, default: the site's
 * admin e-mail) and kept in the list of section 6 (the 100 latest), so nothing is lost if e-mail fails.
 * The product itself is never changed: the team decides what to do.
 */
final class Locappci_Reports {
	const OPTION = 'locappci_reports';
	const KEEP = 100;
	const MAX_PER_HOUR = 5;
	const REASONS = [
		'scam'       => 'Arnaque ou demande de paiement suspect',
		'forbidden'  => 'Produit interdit ou dangereux',
		'wrong_info' => 'Prix, photos ou description trompeurs',
		'other'      => 'Autre raison',
	];

	public static function email(): string {
		$mail = (string) get_option('locappci_report_email', '');
		return is_email($mail) ? $mail : (string) get_option('admin_email');
	}

	/** @return array<int, array{at: string, productId: int, product: string, reason: string, details: string}> newest first */
	public static function latest(): array {
		$list = get_option(self::OPTION, []);
		return is_array($list) ? $list : [];
	}

	public static function send(WP_REST_Request $r): WP_REST_Response {
		$id = (int) $r['id'];
		$product = function_exists('wc_get_product') ? wc_get_product($id) : null;
		if (!$product || $product->get_status() !== 'publish') {
			return Locappci_Errors::not_found();
		}
		$body = $r->get_json_params();
		$body = is_array($body) ? $body : [];
		$reason = (string) ($body['reason'] ?? '');
		if (!isset(self::REASONS[$reason])) {
			return Locappci_Errors::response('validation', 'Choisissez une raison.');
		}
		$details = trim(sanitize_textarea_field((string) ($body['details'] ?? '')));
		if (mb_strlen($details) > 500) {
			return Locappci_Errors::response('validation', 'Le message ne doit pas dépasser 500 caractères.');
		}
		if ($reason === 'other' && $details === '') {
			return Locappci_Errors::response('validation', 'Expliquez-nous en quelques mots.');
		}

		// A few reports per network and hour: enough for a real person, too few for a script.
		$bucket = 'locappci_reports_' . substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '0') . wp_salt('nonce')), 0, 32);
		$count = (int) get_transient($bucket);
		if ($count >= self::MAX_PER_HOUR) {
			return Locappci_Errors::response('rate_limited', 'Vous avez déjà envoyé plusieurs signalements. Réessayez dans une heure.');
		}
		set_transient($bucket, $count + 1, HOUR_IN_SECONDS);

		$entry = [
			'at'        => gmdate('c'),
			'productId' => $id,
			'product'   => $product->get_name(),
			'reason'    => $reason,
			'details'   => $details,
		];
		update_option(self::OPTION, array_slice(array_merge([$entry], self::latest()), 0, self::KEEP), false);

		$shop = Locappci_Catalogue::shop(Locappci_Catalogue::vendor_id($product));
		$lines = [
			'Une annonce a été signalée depuis l’appli LOCAPPCI.',
			'',
			'Annonce : ' . $product->get_name() . ' (n° ' . $id . ')',
			'Lien : ' . get_permalink($id),
			'Boutique : ' . ($shop['name'] ?? '—'),
			'Raison : ' . self::REASONS[$reason],
			'Détails : ' . ($details !== '' ? $details : '—'),
			'',
			'Modifier l’annonce : ' . admin_url('post.php?post=' . $id . '&action=edit'),
			'Tous les signalements : ' . admin_url('tools.php?page=locappci-api'),
		];
		wp_mail(self::email(), '[LOCAPPCI] Annonce signalée : ' . $product->get_name(), implode("\n", $lines));

		return Locappci_Errors::no_cache(new WP_REST_Response(null, 204));
	}
}
