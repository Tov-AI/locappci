# What is really on locappci.fr (diagnostics, 1 Nov 2026)

From the LOCAPPCI API 0.1.1 diagnostics page on the live site. Personal values were masked.

## Main finding

The site is built on its **own LOCAPPCI code** (custom content types and fields), on top of WooCommerce and WCFM.
The rental plugin (RnB) is installed but **unused** (0 `redq_rental` products).
Most universes are **not WooCommerce products**: they are separate content types.

## WooCommerce products (159: 158 simple, 1 variable)

| `_locappci_module` | Count | Notes |
|---|---|---|
| `musique` | 30 | All downloadable (song + 30 s excerpt URL). Also a `locappci_musique` content type (31). |
| `librairie` | 12 | Physical books: `_locappci_type_ouvrage`, `_auteur_ouvrage`, `_etat_ouvrage` (occasion…), `_livraison_ouvrage` text |
| (none) | 117 | Ordinary shop products |

Visibility fields on products: `_locappci_validation_status` (`validee`), `_locappci_catalogue_visible` (`yes`),
`_locappci_public_visibility` (`visible`). Live counts (9 Nov, 159 published products): **129 have none of these fields** (created before the approval flow),
18 are validated and visible, and about 6 are marked `en_attente` (3), `no` (1) or `hidden` (2).
**Rule since plugin 0.2.3:** the app hides a product only when one of these fields is filled with another value;
a product without the fields is shown, as on the website. Counts are in Outils → LOCAPPCI API →
« Validation et visibilité des produits ». With 0.2.3 live (10 Nov): 3 products hidden, 156 shown before downloads are removed.
To confirm with the client: are the 129 field-less products all meant to be public?

## Other content types (published)

| Content type | Label | Count | Likely universe |
|---|---|---|---|
| `locappci_boutique` | Boutiques LOCAPPCI | 6 | Shops (linked from products by `_locappci_boutique_id`) |
| `locappci_loueur` | Loueurs / Bailleurs | 3 | Location |
| `locappci_loc_req`, `locappci_demande_loc` | Demandes (de) location | 3 + 1 | Location: **request-based?** |
| `bien_immobilier`, `demande_immo` | Biens / Demandes immobilières | 9 + 4 | Immobilier |
| `locappci_service`, `loc_service_request` | Services / Demandes services | 7 + 1 | Services |
| `offre_emploi`, `candidature_emploi`, `locappci_candidat` | Emploi | 2 + 1 + 1 | Emploi |
| `locappci_annonce` | Annonces | 2 | Annonces |
| `locappci_podcast` | Podcasts | 2 | Podcasts |
| `locappci_music_prop` | Propositions musique | 8 | Musique (artists' submissions) |
| `locappci_pro_request` | Validations professionnelles | 4 | Seller / pro validation |

User roles: customer 38, wcfm_vendor 7, prestataire 5, loueur_bailleur 2, agence_immobiliere 2, locappci_recruteur 1.

## Shops

`locappci_boutique` record: logo, banner, type (`professionnel`), ville, pays, téléphone, WhatsApp, e-mail, site web,
statut (`validee`), verified, featured, refusal reason. The seller account also has WCFM settings
(store name, address, geolocation lat/lng, shipping by distance, **store_hide_phone / store_hide_address**).
The sample shop's city was outside Abidjan, so no commune matched: the app must read the boutique record and
respect the hide flags.

## Where the custom code is (Code Snippets export, 1 Nov)

87 snippets in Code Snippets (no custom plugin, no custom mu-plugin). Groups: Emploi, Location, Vente, Boutiques,
Services, Annonces, central onboarding flow. Musique, Librairie and Immobilier are not in the snippets
(probably the child theme). The export is not stored in this repository.

### How Location really works (snippets "Ma demande de location", "Demandes Location OFFICIEL STABLE", "Calendrier")

- Rental items are **ordinary WooCommerce products in the product category `location`** (or its sub-categories).
  Extra fields: `_locappci_location_city`, `_condition`, `_delivery`, `_deposit`.
- An item goes live when the admin **publishes** it (pending → publish), from "Validation matériels location".
- No cart, no online payment for rentals (the cart is removed from Location product pages).
- The customer builds a **request list** ("Ma demande de location", saved in the browser): for each item a start date,
  a number of days, a quantity and a city. The price shown is the product's price text, or "Prix à confirmer".
- Two ways to send it:
  1. **WhatsApp to LOCAPPCI** (number 2250788727319 in the code), with the summary as the message.
  2. **Request to each loueur** (logged-in users only): one `locappci_loc_req` record per item, linked to the product's
     author. Fields `_locappci_req_*`: product, start_date, days, qty, city, customer name/phone/WhatsApp/e-mail, notes,
     batch id. Phone or WhatsApp is required.
- The loueur sees the requests ("Mes demandes location") and sets a status: `new` → `processing` → `done` / `archived`.
- The loueur's calendar only **shows** requested periods; nothing is booked automatically.

## Consequences for the app

1. **Location is request-based**, confirmed by the code: the app's rental booking with payment (features 7–9) must
   become "Ajouter à ma demande" → "Ma demande de location" → send to the loueur (and/or WhatsApp LOCAPPCI).
   Rentals leave the cart and the payment screen. To agree with the client before building.
2. Location = products in the `location` category, not RnB. Vente = the other products (minus downloads).
3. Universes beyond Vente/Location come from content types and `_locappci_module`.
4. Two support numbers exist: +44 7748 039794 (client's answer) and 225 07 88 72 73 19 (in the site's code): to confirm.
