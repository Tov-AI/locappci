# Installing the LOCAPPCI API plugin on locappci.fr

Version 0.1 only **reads** the shop (products, shops, stock). It changes nothing on the site.

## Before you start (2 minutes, for safety)

1. Hostinger → **Sites web** → locappci.fr → **Sauvegardes** → **Créer une sauvegarde**.
   *Why:* a fresh copy of the site, in case anything goes wrong.

## Install

1. Download `locappci-api.zip` (sent in the conversation, or zip the `gateway/locappci-api` folder).
2. WordPress admin → **Extensions** → **Ajouter une extension** → **Téléverser une extension** (top of the page).
3. **Choisir un fichier** → `locappci-api.zip` → **Installer maintenant** → **Activer l’extension**.

## Check it answers

1. In a browser, open `https://locappci.fr/wp-json/locappci/v1/health`.
   You should see something like `{"ok":true,"version":"0.1.0","plugins":{...}}`.
2. Open `https://locappci.fr/wp-json/locappci/v1/products?page_size=3`: three of your real products as JSON.

## Diagnostics (send this to the app team)

1. WordPress admin → **Outils** → **LOCAPPCI API**.
2. Take screenshots of section **1. Diagnostic** (plugins found, product types, the fields of one
   rental product, the fields of one sale product, one shop's WCFM settings).
   Shop settings show field **names only**, never the sellers' personal details.
3. Section **2. Communes**: check the list (one commune per line) and click **Enregistrer les communes**.

## Settings to check

- **Réglages → Général → Fuseau horaire: Abidjan.** Rental dates are compared with "today" in this time zone.
- **LiteSpeed Cache → Cache → Exclure**: add `/wp-json/locappci/v1/products/*/stock` and `/wp-json/locappci/v1/cart/check`
  to "Ne pas mettre en cache les URI". (The plugin already sends "no-cache" headers; this is belt and braces.)
- **Wordfence**: if the app gets "403" errors, look in Wordfence → **Outils → Trafic en direct** for blocked
  `/wp-json/locappci/` requests and allow them.

## Remove it

Extensions → LOCAPPCI API → **Désactiver** → **Supprimer**. Nothing else to clean: the plugin only stores
the communes list (`locappci_cities`) and a 1-hour categories cache.
