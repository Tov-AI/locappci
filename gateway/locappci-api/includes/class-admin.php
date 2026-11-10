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
	/** Given by the client for v1; changeable below without a new app version. */
	const DEFAULT_WHATSAPP = '447748039794';

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
		if (isset($_POST['locappci_whatsapp']) && check_admin_referer('locappci_whatsapp')) {
			$digits = preg_replace('/\D+/', '', sanitize_text_field(wp_unslash($_POST['locappci_whatsapp'])));
			if ($digits === '' || (strlen($digits) >= 10 && strlen($digits) <= 15)) {
				update_option('locappci_whatsapp', $digits);
				echo '<div class="notice notice-success"><p>Numéro WhatsApp enregistré. L’appli l’utilise dans l’heure.</p></div>';
			} else {
				echo '<div class="notice notice-error"><p>Numéro invalide : indiquez l’indicatif du pays, ex. +225 07 00 00 00 00.</p></div>';
			}
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

		echo '<p><em>Les numéros, e-mails, adresses et liens de fichiers sont masqués : « (rempli) » veut dire qu’une valeur existe.</em></p>';

		echo '<h3>Modules LOCAPPCI des produits</h3>';
		self::module_counts();
		echo '<h3>Comptes clients de l’appli</h3>';
		[$created, $open] = Locappci_Accounts::counts();
		echo '<table class="widefat striped" style="max-width:900px"><tbody>';
		self::row('Comptes créés depuis l’appli', (string) $created);
		self::row('Comptes avec une session ouverte dans l’appli', (string) $open);
		echo '</tbody></table>';
		echo '<h3>Validation et visibilité des produits</h3>';
		self::approval_counts();
		echo '<h3>Types de contenu du site</h3>';
		self::post_type_counts();
		echo '<h3>Rôles des utilisateurs</h3>';
		self::role_counts();

		echo '<h3>Un produit par module (champs enregistrés)</h3>';
		// The shop shown below: from a physical product if there is one (music shops are a special case).
		$vendor_from = 0;
		$any = 0;
		foreach (self::modules() as $module) {
			$id = self::sample_meta_for_module($module);
			$any = $any ?: $id;
			if ($id && !$vendor_from && $module !== 'musique') {
				$vendor_from = $id;
			}
		}
		if (!$vendor_from) {
			$q = new WP_Query(['post_type' => 'product', 'post_status' => 'publish', 'posts_per_page' => 1, 'fields' => 'ids',
				'meta_query' => [Locappci_Catalogue::supported_meta_query()]]);
			$vendor_from = (int) ($q->posts[0] ?? 0) ?: $any;
		}
		echo '<h3>Un produit en location RnB (champs enregistrés)</h3>';
		self::sample_meta(Locappci_Catalogue::rental_types(), 'IN');

		echo '<h3>Toutes les boutiques (vendeurs avec des produits publiés)</h3>';
		self::shops_overview();
		echo '<h3>Une boutique</h3>';
		self::sample_vendor($vendor_from);

		echo '<h2>2. WhatsApp LOCAPPCI dans l’appli</h2>';
		echo '<p>Utilisé pour l’aide et pour « Envoyer sur WhatsApp LOCAPPCI » (demandes de location). Avec l’indicatif du pays.</p>';
		echo '<form method="post">';
		wp_nonce_field('locappci_whatsapp');
		$wa = (string) get_option('locappci_whatsapp', self::DEFAULT_WHATSAPP);
		echo '<p><label>Numéro WhatsApp <input name="locappci_whatsapp" value="' . esc_attr($wa !== '' ? '+' . $wa : '') . '" placeholder="+225 07 00 00 00 00"></label></p>';
		submit_button('Enregistrer le numéro');
		echo '</form>';

		echo '<h2>3. Communes affichées dans l’appli</h2>';
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

	/** Values of the _locappci_module field on published products, most used first. */
	private static function modules(): array {
		global $wpdb;
		$rows = $wpdb->get_col(
			"SELECT pm.meta_value FROM {$wpdb->postmeta} pm
			 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			 WHERE pm.meta_key = '_locappci_module' AND p.post_type = 'product' AND p.post_status = 'publish'
			 GROUP BY pm.meta_value ORDER BY COUNT(*) DESC LIMIT 20"
		);
		return array_values(array_filter(array_map('strval', $rows)));
	}

	private static function module_counts(): void {
		global $wpdb;
		$rows = $wpdb->get_results(
			"SELECT pm.meta_value AS module, COUNT(*) AS n,
			        SUM(CASE WHEN d.meta_value = 'yes' THEN 1 ELSE 0 END) AS downloads
			 FROM {$wpdb->postmeta} pm
			 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			 LEFT JOIN {$wpdb->postmeta} d ON d.post_id = p.ID AND d.meta_key = '_downloadable'
			 WHERE pm.meta_key = '_locappci_module' AND p.post_type = 'product' AND p.post_status = 'publish'
			 GROUP BY pm.meta_value ORDER BY n DESC LIMIT 20"
		);
		$without = (int) $wpdb->get_var(
			"SELECT COUNT(*) FROM {$wpdb->posts} p
			 WHERE p.post_type = 'product' AND p.post_status = 'publish'
			 AND NOT EXISTS (SELECT 1 FROM {$wpdb->postmeta} pm WHERE pm.post_id = p.ID AND pm.meta_key = '_locappci_module')"
		);
		echo '<table class="widefat striped" style="max-width:900px"><tbody>';
		foreach ((array) $rows as $r) {
			self::row((string) $r->module, (int) $r->n . ' produits publiés, dont ' . (int) $r->downloads . ' à télécharger');
		}
		self::row('(sans module)', $without . ' produits publiés');
		echo '</tbody></table>';
	}

	/** How many published products the approval rule shows or hides, and the values found in each field. */
	private static function approval_counts(): void {
		global $wpdb;
		$total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish'");
		$hidden = Locappci_Catalogue::hidden_ids();
		$hidden_published = 0;
		if ($hidden) {
			$hidden_published = (int) $wpdb->get_var(
				"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish' AND ID IN (" . implode(',', array_map('intval', $hidden)) . ')'
			);
		}
		$approved = $total - $hidden_published;
		$keys = array_keys(Locappci_Catalogue::approval_fields());
		$none = $total;
		if ($keys) {
			$in = implode(',', array_fill(0, count($keys), '%s'));
			$none = (int) $wpdb->get_var($wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->posts} p WHERE p.post_type = 'product' AND p.post_status = 'publish'
				 AND NOT EXISTS (SELECT 1 FROM {$wpdb->postmeta} pm WHERE pm.post_id = p.ID AND pm.meta_key IN ($in))",
				$keys
			));
		}
		echo '<p>L’appli cache un produit seulement si un des trois champs ci-dessous a une autre valeur que celle attendue (en attente, refusé, masqué). Un produit sans ces champs est montré, comme sur le site.</p>';
		echo '<table class="widefat striped" style="max-width:900px"><tbody>';
		self::row('Produits publiés', (string) $total);
		self::row('Montrés dans l’appli (avant d’enlever les téléchargements)', (string) $approved);
		self::row('Cachés : en attente, refusés ou masqués', (string) ($total - $approved));
		self::row('Sans aucun champ de validation (montrés)', (string) $none);
		foreach (Locappci_Catalogue::approval_fields() as $key => $value) {
			$rows = $wpdb->get_results($wpdb->prepare(
				"SELECT pm.meta_value AS v, COUNT(DISTINCT p.ID) AS n FROM {$wpdb->postmeta} pm
				 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE pm.meta_key = %s AND p.post_type = 'product' AND p.post_status = 'publish'
				 GROUP BY pm.meta_value ORDER BY n DESC LIMIT 12",
				$key
			));
			$with = 0;
			$parts = [];
			foreach ((array) $rows as $r) {
				$with += (int) $r->n;
				$label = (string) $r->v === '' ? '(vide)' : sanitize_key((string) $r->v);
				$parts[] = $label . ' : ' . (int) $r->n;
			}
			$parts[] = '(absent) : ' . max(0, $total - $with);
			self::row($key . ' (attendu : ' . $value . ')', implode(' · ', $parts));
		}
		echo '</tbody></table>';
	}

	private static function post_type_counts(): void {
		$parts = [];
		foreach (get_post_types(['_builtin' => false], 'objects') as $type) {
			$n = (int) (wp_count_posts($type->name)->publish ?? 0);
			if ($n > 0) {
				$parts[] = $type->name . ' (' . $type->label . ') : ' . $n;
			}
		}
		echo '<p>' . esc_html($parts ? implode(' · ', $parts) : '—') . '</p>';
	}

	private static function role_counts(): void {
		$parts = [];
		foreach ((count_users()['avail_roles'] ?? []) as $role => $n) {
			if ($n > 0) {
				$parts[] = $role . ' : ' . (int) $n;
			}
		}
		echo '<p>' . esc_html(implode(' · ', $parts)) . '</p>';
	}

	/** The newest published product of one module. Returns its id, or 0. */
	private static function sample_meta_for_module(string $module): int {
		$q = new WP_Query([
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'meta_query'     => [['key' => '_locappci_module', 'value' => $module]],
		]);
		echo '<h4>Module « ' . esc_html($module) . ' »</h4>';
		return self::meta_table($q->posts[0] ?? null);
	}

	/** Field names of one product, with a short preview of each value (personal details masked). */
	private static function sample_meta(array $types, string $operator): void {
		$q = new WP_Query([
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'tax_query'      => [['taxonomy' => 'product_type', 'field' => 'slug', 'terms' => $types, 'operator' => $operator]],
		]);
		self::meta_table($q->posts[0] ?? null);
	}

	private static function meta_table(?WP_Post $post): int {
		if (!$post) {
			echo '<p>Aucun produit trouvé.</p>';
			return 0;
		}
		$product = function_exists('wc_get_product') ? wc_get_product($post->ID) : null;
		$type = $product ? $product->get_type() : '?';
		echo '<p>« ' . esc_html(get_the_title($post)) . ' » (n° ' . (int) $post->ID . ', type ' . esc_html($type) . ', catégories : ' . esc_html(self::category_names($post->ID)) . ')</p>';
		echo '<table class="widefat striped" style="max-width:900px"><tbody>';
		foreach (get_post_meta($post->ID) as $key => $values) {
			if (in_array($key, ['_edit_lock', '_edit_last'], true)) {
				continue;
			}
			self::row($key, self::preview((string) $key, $values[0] ?? ''));
		}
		echo '</tbody></table>';
		return (int) $post->ID;
	}

	private static function category_names(int $post_id): string {
		$names = wp_get_post_terms($post_id, 'product_cat', ['fields' => 'names']);
		return is_wp_error($names) || !$names ? '—' : implode(', ', $names);
	}

	/** Shop of a sample product: the seller account, WCFM settings and the linked "boutique" post if any. */
	/** One line per seller with published products: what the app will show. No personal value is printed. */
	private static function shops_overview(): void {
		$authors = get_users(['has_published_posts' => ['product'], 'fields' => 'ID', 'number' => 200]);
		echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>Boutique</th><th>Fiche LOCAPPCI</th><th>Commune choisie sur la fiche</th><th>Ville écrite sur la fiche</th><th>Ville WCFM</th><th>Commune reconnue</th><th>WhatsApp</th><th>Logo</th><th>Téléphone masqué</th></tr></thead><tbody>';
		foreach ($authors as $uid) {
			$shop = Locappci_Catalogue::shop((int) $uid);
			if (!$shop) {
				continue;
			}
			$settings = get_user_meta((int) $uid, 'wcfmmp_profile_settings', true);
			$hidden = is_array($settings) && Locappci_Catalogue::flag($settings['store_hide_phone'] ?? '');
			$fiche = Locappci_Catalogue::boutique_id((int) $uid);
			// Town names only (never the street): needed to see why a commune is not recognised.
			$ville = $fiche ? trim((string) get_post_meta($fiche, '_locappci_boutique_ville', true)) : '';
			$wcfm_city = is_array($settings) && !Locappci_Catalogue::flag($settings['store_hide_address'] ?? '') ? trim((string) ($settings['address']['city'] ?? '')) : '';
			$commune = $fiche ? trim((string) get_post_meta($fiche, '_locappci_boutique_commune', true)) : '';
			echo '<tr><td>' . esc_html($shop['name']) . '</td><td>' . ($fiche ? 'oui' : 'non') . '</td><td>'
				. esc_html($commune !== '' ? $commune : '—') . '</td><td>'
				. esc_html($ville !== '' ? $ville : '—') . '</td><td>' . esc_html($wcfm_city !== '' ? $wcfm_city : '—') . '</td><td>'
				. esc_html($shop['cityId'] ?: 'aucune') . '</td><td>' . ($shop['whatsapp'] ? 'oui' : 'non') . '</td><td>'
				. ($shop['logoUrl'] ? 'oui' : 'non') . '</td><td>' . ($hidden ? 'oui' : 'non') . '</td></tr>';
		}
		echo '</tbody></table>';
	}

	private static function sample_vendor(int $product_id): void {
		$uid = 0;
		if ($product_id) {
			$uid = function_exists('wcfm_get_vendor_id_by_post') ? (int) wcfm_get_vendor_id_by_post($product_id) : 0;
			$uid = $uid ?: (int) get_post_field('post_author', $product_id);
		}
		if (!$uid) {
			echo '<p>Aucune boutique trouvée.</p>';
			return;
		}
		$u = get_userdata($uid);
		if (!$u) {
			echo '<p>Aucune boutique trouvée.</p>';
			return;
		}
		$boutique_id = (int) get_post_meta($product_id, '_locappci_boutique_id', true);
		if ($boutique_id && ($b = get_post($boutique_id))) {
			echo '<p>Fiche boutique liée au produit : n° ' . (int) $b->ID . ', type de contenu « ' . esc_html($b->post_type) . ' »</p>';
			echo '<table class="widefat striped" style="max-width:900px"><tbody>';
			foreach (get_post_meta($b->ID) as $key => $values) {
				if (in_array($key, ['_edit_lock', '_edit_last'], true)) {
					continue;
				}
				self::row((string) $key, self::preview((string) $key, $values[0] ?? ''));
			}
			echo '</tbody></table>';
		}
		$settings = get_user_meta($u->ID, 'wcfmmp_profile_settings', true);
		echo '<p>Compte vendeur : utilisateur n° ' . (int) $u->ID . ' (rôles : ' . esc_html(implode(', ', $u->roles)) . ')</p><table class="widefat striped" style="max-width:900px"><tbody>';
		if (is_array($settings)) {
			foreach ($settings as $key => $value) {
				// Keys and types only: values may contain the seller's personal details.
				self::row((string) $key, is_array($value) ? 'liste : ' . implode(', ', array_keys($value)) : ($value === '' ? '(vide)' : '(rempli)'));
			}
		} else {
			self::row('wcfmmp_profile_settings', 'non trouvé');
		}
		$shop = Locappci_Catalogue::shop($u->ID);
		$used = Locappci_Catalogue::boutique_id($u->ID);
		self::row('→ Fiche boutique utilisée par l’appli', $used ? 'oui (n° ' . $used . ')' : 'non (réglages WCFM seulement)');
		self::row('→ Téléphone masqué par le vendeur (store_hide_phone)', is_array($settings) && Locappci_Catalogue::flag($settings['store_hide_phone'] ?? '') ? 'oui : pas de WhatsApp dans l’appli' : 'non');
		self::row('→ Adresse masquée par le vendeur (store_hide_address)', is_array($settings) && Locappci_Catalogue::flag($settings['store_hide_address'] ?? '') ? 'oui' : 'non');
		self::row('→ Logo lu', ($shop['logoUrl'] ?? null) ? 'oui' : 'non');
		self::row('→ Nom de boutique lu', $shop['name'] ?? '—');
		self::row('→ Commune reconnue', ($shop['cityId'] ?? '') ?: 'aucune');
		self::row('→ WhatsApp reconnu', ($shop['whatsapp'] ?? null) ? 'oui' : 'non');
		echo '</tbody></table>';
	}

	/** Keys whose values are personal details or private file links: only say whether they are filled. */
	const MASKED = '/phone|tel|whatsapp|mail|address|adresse|file|password|pass|token|secret|iban|compte|account|cni|piece/i';

	private static function preview(string $key, $value): string {
		$value = is_string($value) ? $value : wp_json_encode($value);
		if ($value !== '' && preg_match(self::MASKED, $key)) {
			return '(rempli)';
		}
		if (is_serialized($value)) {
			$data = maybe_unserialize($value);
			return is_array($data) ? 'liste : ' . implode(', ', array_slice(array_map('strval', array_keys($data)), 0, 12)) : '(rempli)';
		}
		$value = wp_strip_all_tags((string) $value);
		return mb_strlen($value) > 80 ? mb_substr($value, 0, 80) . '…' : ($value === '' ? '(vide)' : $value);
	}
}
