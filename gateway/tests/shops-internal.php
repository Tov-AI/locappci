<?php
/**
 * Since 0.10.0 the public shop never carries the seller's WhatsApp (paid contacts), so the contract test can't see
 * how the number is found. This checks it inside WordPress: wp eval-file shops-internal.php (after seed.php).
 */
$wa = function (int $vendor): ?string {
	$s = Locappci_Catalogue::shop($vendor);
	return $s ? $s['whatsapp'] : 'NO SHOP';
};
$vendor_of = fn(int $product) => Locappci_Catalogue::vendor_id(wc_get_product($product));
$ids = json_decode(getenv('SEED_IDS') ?: '{}', true);
$checks = [
	'WCFM phone'                         => [$wa($vendor_of((int) $ids['vent16'])), '2250700000001'],
	'second WCFM shop'                   => [$wa($vendor_of((int) $ids['pagne'])), '2250700000002'],
	'record linked from a product'       => [$wa((int) $ids['bazar']), '2250722222222'],
	'record by author, telephone'        => [$wa((int) $ids['auteur']), '2250733333333'],
	'record not validated: WCFM'         => [$wa((int) $ids['attenteb']), '2250700000004'],
	'hidden phone'                       => [$wa((int) $ids['discret']), null],
	'hidden phone wins over the record'  => [$wa((int) $ids['discret2']), null],
];
$fail = 0;
foreach ($checks as $name => [$got, $want]) {
	if ($got !== $want) {
		$fail++;
		echo "FAIL $name: got " . var_export($got, true) . ', want ' . var_export($want, true) . "\n";
	}
}
echo $fail ? "SHOPS INTERNAL: $fail FAILED\n" : "SHOPS INTERNAL OK\n";
