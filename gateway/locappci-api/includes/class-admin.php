<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Outils → LOCAPPCI API (administrators only).
 * 1. Diagnostics: what the plugin finds on this site (plugins, product types, how rental and
 *    shop data are stored), so the app's developers can finish the mapping. Nothing is changed.
 * 2. Communes: the list the app shows in "Où êtes-vous ?".
 */
final class Locappci_Admin {
	public static function menu(): void {
		add_management_page('LOCAPPCI API', 'LOCAPPCI API', 'manage_options', 'locappci-api', [self::class, 'page']);
	}

	public static function page(): void {
		if (!current_user_can('manage_options')) {
			wp_die(esc_html__('Accès refusé.', 'locappci-api'));
		}
		if (isset($_POST['locappci_cities']) && check_admin_referer('locappci_settings')) {
			$lines = array_filter(array_map('trim', explode("\n", sanitize_textarea_field(wp_unslash($_POST['locappci_cities'])))));
			update_option('locappci_cities', array_values(array_unique($lines)));
			update_option('locappci_region', sanitize_text_field(wp_unslash($_POST['locappci_region'] ?? 'Abidjan')));
			echo '<div class="notice notice-success"><p>Communes enregistrées.</p></div>';
		}

		$health = Locappci_Routes::health()->get_data();
		$cities = array_column(Locappci_Catalogue::cities(), 'name');
		echo '<div class="wrap"><h1>LOCAPPCI API</h1>';
		echo '<p>Adresse de l’API pour l’appli : <code>' . esc_html(rest_url('locappci')) . '</code></p>';

		echo '<h2>1. Diagnostic</h2><p>Faites une capture de cette section et envoyez-la à l’équipe de l’appli.</p>';
		echo '<table class="widefat striped" style="max-width:900px"><tbody>';
		self::row('Version du plugin', LOCAPPCI_API_VERSION);
		self::row('WooCommerce', $health['plugins']['woocommerce'] ?: 'non trouvé');
		self::row('WCFM (boutiques)', $health['plugins']['wcfm'] ? 'oui' : 'non trouvé');
		self::row('Location (RnB)', $health['plugins']['rental'] ? 'oui' : 'non trouvé');
		self::row('Simple JWT Login', $health['plugins']['jwt'] ? 'oui' : 'non trouvé');
		self::row('Fuseau horaire du site', wp_timezone_string() . ' (conseillé : Africa/Abidjan)');
		self::row('Types de produits', self::product_type_counts());
		self::row('Catégories', (string) wp_count_terms(['taxonomy' => 'product_cat']));
		echo '</tbody></table>';

		echo '<h3>Un produit en location (champs enregistrés)</h3>';
		self::sample_meta(Locappci_Catalogue::rental_types(), 'IN');
		echo '<h3>Un produit en vente (champs enregistrés)</h3>';
		self::sample_meta(Locappci_Catalogue::rental_types(), 'NOT IN');
		echo '<h3>Une boutique (réglages WCFM)</h3>';
		self::sample_vendor();

		echo '<h2>2. Communes affichées dans l’appli</h2>';
		echo '<form method="post">';
		wp_nonce_field('locappci_settings');
		echo '<p><label>Une commune par ligne<br><textarea name="locappci_cities" rows="10" cols="40">' . esc_textarea(implode("\n", $cities)) . '</textarea></label></p>';
		echo '<p><label>Région <input name="locappci_region" value="' . esc_attr(get_option('locappci_region', 'Abidjan')) . '"></label></p>';
		submit_button('Enregistrer les communes');
		echo '</form></div>';
	}

	private static function row(string $label, string $value): void {
		echo '<tr><th style="width:240px">' . esc_html($label) . '</th><td>' . esc_html($value) . '</td></tr>';
	}

	private static function product_type_counts(): string {
		$terms = get_terms(['taxonomy' => 'product_type', 'hide_empty' => false]);
		if (is_wp_error($terms)) {
			return '—';
		}
		$parts = [];
		foreach ($terms as $t) {
			$parts[] = $t->slug . ' : ' . (int) $t->count;
		}
		return implode(' · ', $parts);
	}

	/** Field names of one product, with a short preview of each value (no customer data here). */
	private static function sample_meta(array $types, string $operator): void {
		$q = new WP_Query([
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'tax_query'      => [['taxonomy' => 'product_type', 'field' => 'slug', 'terms' => $types, 'operator' => $operator]],
		]);
		if (!$q->posts) {
			echo '<p>Aucun produit trouvé.</p>';
			return;
		}
		$post = $q->posts[0];
		echo '<p>« ' . esc_html(get_the_title($post)) . ' » (n° ' . (int) $post->ID . ')</p>';
		$meta = get_post_meta($post->ID);
		echo '<table class="widefat striped" style="max-width:900px"><tbody>';
		foreach ($meta as $key => $values) {
			if (in_array($key, ['_edit_lock', '_edit_last'], true)) {
				continue;
			}
			self::row($key, self::preview($values[0] ?? ''));
		}
		echo '</tbody></table>';
	}

	private static function sample_vendor(): void {
		$users = get_users(['has_published_posts' => ['product'], 'number' => 1]);
		if (!$users) {
			echo '<p>Aucune boutique trouvée.</p>';
			return;
		}
		$u = $users[0];
		$settings = get_user_meta($u->ID, 'wcfmmp_profile_settings', true);
		echo '<p>Utilisateur n° ' . (int) $u->ID . '</p><table class="widefat striped" style="max-width:900px"><tbody>';
		if (is_array($settings)) {
			foreach ($settings as $key => $value) {
				// Keys and types only: values may contain the seller's personal details.
				self::row((string) $key, is_array($value) ? 'liste : ' . implode(', ', array_keys($value)) : ($value === '' ? '(vide)' : '(rempli)'));
			}
		} else {
			self::row('wcfmmp_profile_settings', 'non trouvé');
		}
		$shop = Locappci_Catalogue::shop($u->ID);
		self::row('→ Nom de boutique lu', $shop['name'] ?? '—');
		self::row('→ Commune reconnue', ($shop['cityId'] ?? '') ?: 'aucune');
		self::row('→ WhatsApp reconnu', ($shop['whatsapp'] ?? null) ? 'oui' : 'non');
		echo '</tbody></table>';
	}

	private static function preview($value): string {
		$value = is_string($value) ? $value : wp_json_encode($value);
		$value = wp_strip_all_tags((string) $value);
		return mb_strlen($value) > 80 ? mb_substr($value, 0, 80) . '…' : ($value === '' ? '(vide)' : $value);
	}
}
