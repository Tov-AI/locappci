<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * LOCAPPCI's business rules (client, 21 Nov): the buyer pays LOCAPPCI, LOCAPPCI keeps a commission and
 * the seller gets the rest; a seller's phone / WhatsApp is never given away for free.
 * Both amounts are set by the owner in Outils → LOCAPPCI API, section 8, and can change at any time.
 */
final class Locappci_Marketplace {
	/** Percentage kept by LOCAPPCI on the items of each order (0–100, e.g. 10 or 7.5). */
	public static function commission_rate(): float {
		return min(100.0, max(0.0, (float) get_option('locappci_commission_rate', 0)));
	}

	/** Price in FCFA to get one seller's contact details (0 = not set yet). */
	public static function contact_fee(): int {
		return max(0, (int) get_option('locappci_contact_fee', 0));
	}

	/** LOCAPPCI's share of an items total, rounded to the franc. */
	public static function commission(int $items_total): int {
		return (int) round($items_total * self::commission_rate() / 100);
	}

	/** A shop as the app may show it to anyone: no phone, no WhatsApp. */
	public static function public_shop(?array $shop): ?array {
		if ($shop) {
			$shop['whatsapp'] = null;
		}
		return $shop;
	}
}
