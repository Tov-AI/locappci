# Feature roadmap — v1

One feature at a time, in order. Write your name in **Owner** when you start one.

| # | Feature | Status | Owner | Needs client answers? |
| --- | --- | --- | --- | --- |
| 1 | Foundation: theme tokens, DM Sans, logo, 5 tabs | In review | Leo | No |
| 2 | Core components: buttons, cards, chips, option card, bottom bar, sheet, badge, offline banner | In review | Leo | No |
| 3 | API contract + mock data + cache (TanStack Query, AsyncStorage) | In review | Leo | No |
| 4 | Accueil: universe cards, product grid, city chip | In review | Leo | No |
| 5 | Recherche + Filtres sheet | In review | Leo | No |
| 6 | Produit (sale detail) | In review | Leo | No |
| 7 | Location détail (dates, duration, deposit) | In review | Leo | Deposit rules (shown from product data until confirmed) |
| 8 | Panier + cart state | In review | Leo | No |
| 9 | Paiement (mock payment) | In review | Leo | Cash on delivery? (shown until confirmed) |
| 10 | Confirmation + account offer + notification soft ask | In review | Leo | Guest checkout? |
| 11 | Compte (+ Favoris tab, Mes commandes, Adresses) | In review | Leo | Support WhatsApp number, terms URL; seller tools v1 or v1.1? |
| 12 | Loading, empty, error, offline states on every screen | In review | Leo | No |
| 13 | Gateway: real WooCommerce data (WordPress plugin `gateway/locappci-api`) | In progress: 0.1.1 installed on locappci.fr (1 Nov); 0.2 in review | Leo | — |
| 13b | Location par demande (like the website): "Ajouter à ma demande", "Ma demande de location", send to loueurs or WhatsApp LOCAPPCI; rentals out of cart and payment; WhatsApp number editable in WordPress | In review | Leo | Sending to loueurs on the real site needs accounts (Feature 14) |
| 14 | Login with WordPress accounts (JWT) | Blocked | | JWT plugin |
| 15 | Wave / Orange Money hand-off + deep link back | Blocked | | Payment plugin |
| 16 | Push notifications (webhooks → Expo Push). Must ask the system permission of people who said "Oui, me prévenir" (Feature 10) before launch | Blocked | | Admin access |

**Client answers, round 2 (2026-11-01):** rentals in the app work like on the site (request, the loueur answers); the person chooses between sending to the loueurs or on the LOCAPPCI WhatsApp; the WhatsApp number stays +44 7748 039794 for now and the client can change it himself (Outils → LOCAPPCI API); the shops and products on the site are real.

**Client answers, round 1 (2026-10-26):** hosting Hostinger; plugins WooCommerce, WCFM Multivendor, WooCommerce Booking & Rental (RnB), Simple JWT Login, WP Job Manager (Emploi), TeraWallet; no Wave/OM merchant account (payments to standard accounts) → transfer + reference in v1; delivery paid by the customer, priced by distance; no cash on delivery; deposit online or cash at pickup, broken item charged, late return penalty; shop WhatsApp numbers shown (agreed); support WhatsApp +44 7748 039794. Gateway = WordPress plugin on the same site. Still to come: LOCAPPCI Wave/OM numbers that receive transfers, delivery tariff, penalty amounts, the other universes.

Status values: Not started · In progress · In review · Done · Blocked.
