<?php
// Two shops (WCFM-style settings), sale and rental products, categories, stock cases.
function vendor($login, $store, $phone, $city) {
	$id = username_exists($login) ?: wp_create_user($login, wp_generate_password(), "$login@example.com");
	(new WP_User($id))->set_role('shop_manager');
	update_user_meta($id, 'wcfmmp_profile_settings', ['store_name' => $store, 'phone' => $phone, 'address' => ['street_1' => 'Rue 1', 'city' => $city, 'country' => 'CI']]);
	return $id;
}
function cat($name, $parent = 0) { $t = term_exists($name, 'product_cat'); if (!$t) $t = wp_insert_term($name, 'product_cat', ['parent' => $parent]); return (int) $t['term_id']; }
$kone = vendor('kone', 'Boutique Koné Électro', '07 00 00 00 01', 'Yopougon');
$riv  = vendor('riviera', 'Maison Riviera', '+225 0700000002', 'Cocody Riviera 2');
$loc  = vendor('marcory', 'Marcory Bâtiment Loc', '', 'Marcory');
$elec = cat('Électroménager'); $vent = cat('Ventilation', $elec); $chantier = cat('Chantier et outillage');
function prod($author, $name, $price, $cats, $type = 'simple', $stock = null, $meta = []) {
	$cls = $type === 'redq_rental' ? 'WC_Product_Redq_Rental' : 'WC_Product_Simple';
	$p = new $cls(); $p->set_name($name); $p->set_regular_price($price); $p->set_category_ids($cats);
	$p->set_description("<p>$name : description <strong>HTML</strong>.</p><p>Deuxième paragraphe &amp; détails.</p>");
	if ($stock !== null) { $p->set_manage_stock(true); $p->set_stock_quantity($stock); }
	$p->set_status('publish'); $id = $p->save();
	wp_update_post(['ID' => $id, 'post_author' => $author]);
	if ($type === 'redq_rental') wp_set_object_terms($id, 'redq_rental', 'product_type');
	// Approved and visible, like a product the LOCAPPCI team has validated (override through $meta).
	$meta += ['_locappci_validation_status' => 'validee', '_locappci_catalogue_visible' => 'yes', '_locappci_public_visibility' => 'visible'];
	foreach ($meta as $k => $v) { if ($v !== null) update_post_meta($id, $k, $v); }
	return $id;
}
$ids = [
	'vent16' => prod($kone, 'Ventilateur sur pied 16"', 18500, [$vent], 'simple', 4),
	'clim'   => prod($kone, 'Climatiseur mobile', 185000, [$vent], 'simple', 2),
	'mix'    => prod($riv, 'Mixeur 1,5 L', 12000, [$elec], 'simple', 0),
	'pagne'  => prod($riv, 'Pagne wax', 15000, [$elec]),
	'groupe' => prod($loc, 'Groupe électrogène 5 kVA', 15000, [$chantier], 'redq_rental', null, ['general_price' => 15000, 'redq_security_deposit' => 50000, 'redq_max_rental_days' => 30]),
];
$hidden = prod($kone, 'Produit caché', 1000, [$elec]); $h = wc_get_product($hidden); $h->set_catalog_visibility('hidden'); $h->save();
// A song to download: not sold in the app yet (no delivery or rental flow for downloads).
$song = prod($riv, 'Chanson à télécharger', 350, [$elec], 'simple', null, ['_locappci_module' => 'musique']); $sg = wc_get_product($song); $sg->set_virtual(true); $sg->set_downloadable(true); $sg->save();
// locappci.fr style rentals: products in the "location" category, with the site's own fields.
$location = cat('Location'); $event = cat('Événementiel', $location);
$chaises = prod($loc, 'Chaises VIP (lot de 10)', 5000, [$event], 'simple', null, [
	'_locappci_location_deposit' => '25 000 FCFA', '_locappci_location_condition' => 'Très bon état',
	'_locappci_location_delivery' => 'Livraison possible à Abidjan', '_locappci_location_city' => 'Plateau']);
$tente = prod($loc, 'Tente de réception', '', [$location]);
// Not approved yet, approved but hidden by the team, and an old product with no approval fields: all hidden in the app.
$pending = prod($kone, 'Fer à repasser en attente', 9000, [$elec], 'simple', 3, ['_locappci_validation_status' => 'en_attente']);
$masked = prod($kone, 'Bouilloire masquée', 7000, [$elec], 'simple', 3, ['_locappci_public_visibility' => 'masquee']);
$nofields = prod($riv, 'Ancien produit sans validation', 5000, [$elec], 'simple', 3,
	['_locappci_validation_status' => null, '_locappci_catalogue_visible' => null, '_locappci_public_visibility' => null]);
// A category and a loueur whose only products are not approved: neither should appear.
$attente = cat('En attente seulement');
$newloc = vendor('nouveau', 'Nouveau Loueur', '07 00 00 00 09', 'Yopougon');
$pending_cat = prod($kone, 'Lampe en attente', 4000, [$attente], 'simple', 2, ['_locappci_validation_status' => 'en_attente']);
$pending_rental = prod($newloc, 'Sono en attente', 20000, [$location], 'simple', null, ['_locappci_validation_status' => 'en_attente']);
echo json_encode($ids + ['pending' => $pending, 'masked' => $masked, 'nofields' => $nofields, 'pendingCat' => $attente, 'pendingRental' => $pending_rental, 'newLoueur' => $newloc] + ['song' => $song, 'hidden' => $hidden, 'chaises' => $chaises, 'tente' => $tente]);
