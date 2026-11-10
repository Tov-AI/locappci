# Installing the LOCAPPCI API plugin on locappci.fr

Version 0.1 only **reads** the shop (products, shops, stock). It changes nothing on the site.
Products to download (songs, e-books) are not shown in the app yet: they stay on the website.
Rental items are the products of the **location** category, as on the site.
Since 0.2.3 the app hides products the site marks as **waiting, refused or hidden** (`_locappci_validation_status`,
`_locappci_catalogue_visible`, `_locappci_public_visibility` filled with anything other than `validee` / `yes` / `visible`).
Products without these fields (most of the catalogue) are shown, as on the website.

## Before you start (2 minutes, for safety)

1. Hostinger → **Sites web** → locappci.fr → **Sauvegardes** → **Créer une sauvegarde**.
   *Why:* a fresh copy of the site, in case anything goes wrong.

## Install

1. Download `locappci-api.zip` (sent in the conversation, or zip the `gateway/locappci-api` folder).
2. WordPress admin → **Extensions** → **Ajouter une extension** → **Téléverser une extension** (top of the page).
3. **Choisir un fichier** → `locappci-api.zip` → **Installer maintenant** → **Activer l’extension**.

## Update to a new version

Same steps as Install, with the new `locappci-api.zip`. WordPress then shows
**« Remplacer la version installée par la version téléversée »**: click it. Nothing to deactivate first.

## Check it answers

1. In a browser, open `https://locappci.fr/wp-json/locappci/v1/health`.
   You should see something like `{"ok":true,"version":"0.3.0","plugins":{...}}`.
2. Open `https://locappci.fr/wp-json/locappci/v1/products?page_size=3`: three of your real products as JSON.

## Diagnostics (send this to the app team)

1. WordPress admin → **Outils** → **LOCAPPCI API**.
2. Take screenshots of section **1. Diagnostic** (including the table **Validation et visibilité des produits**: how many
   products the app shows and hides, and the values found in each approval field): plugins found, product types, LOCAPPCI modules
   (`_locappci_module`) with counts, the site's content types, user roles, the fields of one product per
   module, the table **Toutes les boutiques** (per seller: record used, commune, WhatsApp, logo, phone hidden),
   and one shop (its linked "boutique" record if any, and its WCFM settings).
   Phone numbers, e-mails, addresses and file links are **masked** (« (rempli) »): screenshots can be shared.
3. Section **2. WhatsApp LOCAPPCI dans l’appli**: the number the app uses for help and for rental requests sent on WhatsApp.
   Type it with the country code (e.g. `+44 7748 039794` or `+225 07 00 00 00 00`) and click **Enregistrer le numéro**.
   The app picks it up within an hour, no new app version needed.
4. Section **3. Communes**: check the list (one commune per line) and click **Enregistrer les communes**.

## Settings to check

- **Réglages → Général → Fuseau horaire: Abidjan.** Rental dates are compared with "today" in this time zone.
- **LiteSpeed Cache → Cache → Exclure**: add `/wp-json/locappci/v1/products/*/stock` and `/wp-json/locappci/v1/cart/check`
  to "Ne pas mettre en cache les URI". (The plugin already sends "no-cache" headers; this is belt and braces.)
- **Wordfence**: if the app gets "403" errors, look in Wordfence → **Outils → Trafic en direct** for blocked
  `/wp-json/locappci/` requests and allow them.

## Remove it

Extensions → LOCAPPCI API → **Désactiver** → **Supprimer**. Nothing else to clean: the plugin only stores
the communes list (`locappci_cities`) and a 1-hour categories cache.
