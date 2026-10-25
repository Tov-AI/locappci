import type { Category, City, Product, Shop } from '@/api/contract';

/**
 * Sample data for development only. Names, shops, prices and numbers are invented
 * examples. Real data comes from WooCommerce through the gateway.
 */

export const cities: City[] = [
  { id: 'cocody', name: 'Cocody', region: 'Abidjan' },
  { id: 'yopougon', name: 'Yopougon', region: 'Abidjan' },
  { id: 'marcory', name: 'Marcory', region: 'Abidjan' },
  { id: 'plateau', name: 'Plateau', region: 'Abidjan' },
  { id: 'treichville', name: 'Treichville', region: 'Abidjan' },
  { id: 'abobo', name: 'Abobo', region: 'Abidjan' },
  { id: 'bingerville', name: 'Bingerville', region: 'Abidjan' },
];

export const categories: Category[] = [
  { id: 'electromenager', name: 'Électroménager', universe: 'vente', parentId: null },
  { id: 'ventilation', name: 'Ventilation et climatisation', universe: 'vente', parentId: 'electromenager' },
  { id: 'cuisine', name: 'Cuisine', universe: 'vente', parentId: 'electromenager' },
  { id: 'telephones', name: 'Téléphones', universe: 'vente', parentId: null },
  { id: 'mode', name: 'Mode', universe: 'vente', parentId: null },
  { id: 'energie', name: 'Énergie', universe: 'location', parentId: null },
  { id: 'evenementiel', name: 'Événementiel', universe: 'location', parentId: null },
  { id: 'chantier', name: 'Chantier et outillage', universe: 'location', parentId: null },
];

export const shops: Shop[] = [
  { id: 'kone-electro', name: 'Boutique Koné Électro', initials: 'KE', logoUrl: null, cityId: 'yopougon', whatsapp: '2250700000001', role: 'vendeur' },
  { id: 'maison-riviera', name: 'Maison Riviera', initials: 'MR', logoUrl: null, cityId: 'cocody', whatsapp: '2250700000002', role: 'vendeur' },
  { id: 'plateau-mobile', name: 'Plateau Mobile', initials: 'PM', logoUrl: null, cityId: 'plateau', whatsapp: '2250700000003', role: 'vendeur' },
  { id: 'marcory-loc', name: 'Marcory Bâtiment Loc', initials: 'MB', logoUrl: null, cityId: 'marcory', whatsapp: '2250700000004', role: 'loueur' },
  { id: 'fete-treich', name: 'Fête et Déco Treichville', initials: 'FD', logoUrl: null, cityId: 'treichville', whatsapp: null, role: 'loueur' },
];

const web = (slug: string) => `https://locappci.fr/produit/${slug}/`;
/** Plain brand-coloured placeholder pictures ("Photo 1"…), only to test the photo carousel. */
const photo = (n: number) => `https://placehold.co/800x600/E9EDF7/002366/png?text=Photo+${n}`;
const at = '2026-10-24T09:00:00Z';

export const products: Product[] = [
  {
    id: 'p-ventilateur-16', universe: 'vente', name: 'Ventilateur sur pied 16"',
    description:
      'Ventilateur sur pied 16 pouces (40 cm), 3 vitesses, hauteur réglable de 1,10 m à 1,30 m et oscillation automatique pour rafraîchir toute la pièce. ' +
      'Moteur silencieux en cuivre, 45 W, adapté à un usage quotidien. Grille amovible pour le nettoyage. ' +
      'Garantie boutique 6 mois. Livraison possible partout à Abidjan ou retrait en boutique à Yopougon.',
    images: [photo(1), photo(2), photo(3)], categoryId: 'ventilation', shopId: 'kone-electro', cityId: 'yopougon', webUrl: web('ventilateur-16'), updatedAt: at,
    price: 18500, stock: { status: 'in_stock', quantity: 4 },
  },
  {
    id: 'p-ventilateur-table', universe: 'vente', name: 'Ventilateur de table 12"',
    description: 'Compact et silencieux, 2 vitesses.',
    images: [], categoryId: 'ventilation', shopId: 'maison-riviera', cityId: 'cocody', webUrl: web('ventilateur-table'), updatedAt: at,
    price: 9900, stock: { status: 'in_stock', quantity: 12 },
  },
  {
    id: 'p-climatiseur', universe: 'vente', name: 'Climatiseur mobile 9000 BTU',
    description: 'Avec télécommande et kit fenêtre.',
    images: [photo(1)], categoryId: 'ventilation', shopId: 'kone-electro', cityId: 'yopougon', webUrl: web('climatiseur'), updatedAt: at,
    price: 185000, stock: { status: 'low_stock', quantity: 2 },
  },
  {
    id: 'p-mixeur', universe: 'vente', name: 'Mixeur 1,5 L',
    description: 'Bol en verre, 5 vitesses, fonction glace pilée.',
    images: [], categoryId: 'cuisine', shopId: 'maison-riviera', cityId: 'cocody', webUrl: web('mixeur'), updatedAt: at,
    price: 12000, stock: { status: 'in_stock', quantity: 7 },
  },
  {
    id: 'p-friteuse', universe: 'vente', name: 'Friteuse sans huile 4 L',
    description: 'Écran tactile, 8 programmes.',
    images: [], categoryId: 'cuisine', shopId: 'maison-riviera', cityId: 'cocody', webUrl: web('friteuse'), updatedAt: at,
    price: 39000, stock: { status: 'out_of_stock', quantity: 0 },
  },
  {
    id: 'p-telephone', universe: 'vente', name: 'Smartphone 128 Go double SIM',
    description: 'Écran 6,6", batterie 5000 mAh, garantie 6 mois.',
    images: [], categoryId: 'telephones', shopId: 'plateau-mobile', cityId: 'plateau', webUrl: web('smartphone-128'), updatedAt: at,
    price: 89000, stock: { status: 'in_stock', quantity: 9 },
  },
  {
    id: 'p-chargeur', universe: 'vente', name: 'Chargeur rapide 33 W',
    description: 'Câble USB-C inclus.',
    images: [], categoryId: 'telephones', shopId: 'plateau-mobile', cityId: 'plateau', webUrl: web('chargeur-33w'), updatedAt: at,
    price: 5500, stock: { status: 'in_stock', quantity: 30 },
  },
  {
    id: 'p-pagne', universe: 'vente', name: 'Pagne wax 6 yards',
    description: 'Coton imprimé, plusieurs motifs disponibles.',
    images: [], categoryId: 'mode', shopId: 'maison-riviera', cityId: 'cocody', webUrl: web('pagne-wax'), updatedAt: at,
    price: 15000, stock: { status: 'in_stock', quantity: 20 },
  },
  {
    id: 'r-groupe-5kva', universe: 'location', name: 'Groupe électrogène 5 kVA',
    description: 'Essence, démarrage électrique. Vérifié avant chaque location.',
    images: [], categoryId: 'energie', shopId: 'marcory-loc', cityId: 'marcory', webUrl: web('groupe-5kva'), updatedAt: at,
    pricePerDay: 15000, deposit: 50000, minDays: 1, maxDays: 30,
  },
  {
    id: 'r-brasseur', universe: 'location', name: "Brasseur d'air industriel",
    description: 'Idéal pour cérémonies et entrepôts.',
    images: [], categoryId: 'evenementiel', shopId: 'fete-treich', cityId: 'treichville', webUrl: web('brasseur-air'), updatedAt: at,
    pricePerDay: 8000, deposit: 20000, minDays: 1, maxDays: 14,
  },
  {
    id: 'r-chaises', universe: 'location', name: 'Chaises pliantes (lot de 10)',
    description: 'Chaises blanches, livraison possible.',
    images: [], categoryId: 'evenementiel', shopId: 'fete-treich', cityId: 'treichville', webUrl: web('chaises-lot-10'), updatedAt: at,
    pricePerDay: 5000, deposit: 15000, minDays: 1, maxDays: 7,
  },
  {
    id: 'r-bache', universe: 'location', name: 'Bâche de réception 5 × 10 m',
    description: 'Montage inclus dans Abidjan.',
    images: [], categoryId: 'evenementiel', shopId: 'fete-treich', cityId: 'treichville', webUrl: web('bache-5x10'), updatedAt: at,
    pricePerDay: 35000, deposit: 50000, minDays: 1, maxDays: 5,
  },
  {
    id: 'r-betonniere', universe: 'location', name: 'Bétonnière 160 L',
    description: 'Moteur électrique, roues de transport.',
    images: [], categoryId: 'chantier', shopId: 'marcory-loc', cityId: 'marcory', webUrl: web('betonniere-160'), updatedAt: at,
    pricePerDay: 12000, deposit: 40000, minDays: 1, maxDays: 30,
  },
];
