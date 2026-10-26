# Decisions log

One line per decision, newest first. Why we chose it matters more than what.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-26 | Gateway = a "LOCAPPCI API" WordPress plugin on the Hostinger site (not a separate server) | No extra cost; direct access to WooCommerce, WCFM and RnB; Simple JWT Login already installed |
| 2026-10-26 | Payment v1 = Wave / Orange Money transfer to the LOCAPPCI number + transaction reference, checked by the team | No merchant accounts yet; works now; the screens stay when automatic payment arrives |
| 2026-10-26 | "Paiement à la livraison" removed | Client: no cash on delivery |
| 2026-10-26 | Delivery priced by distance from the shop to the commune in the address | Client: delivery paid by the customer, by distance; sample tariff 1 000 + 150 FCFA/km until the real one |
| 2026-10-26 | Order screen always refreshes the status on open (staleTime 0) | A transfer can be validated any minute; a 5-minute cache showed an old status |
| 2026-10-26 | Tracking bars stay grey until the payment is confirmed | "Confirmée" in green was wrong while the transfer was being checked |
| 2026-10-25 | The mock fails when the phone is offline (real or dev switch) | It used to answer anyway, which hid the "offline with nothing saved" case |
| 2026-10-25 | "Pas de connexion" state when there is no network and nothing saved (`waitingForNetwork`) | Without it, screens showed loading skeletons forever; the page fills itself in when the network returns |
| 2026-10-25 | Favoris offline: falls back to cards already seen in Accueil/Recherche | Hearts are on the phone; the cards often are too |
| 2026-10-25 | Rental screen says when availability couldn't load | Free-looking days must not mislead; the live check at "Réserver" still protects |
| 2026-10-25 | Root error boundary (crash screen with "Réessayer") and a "Page introuvable" route | No white screen or closed app on a bug or an old link; cart and favourites are safe on the phone |
| 2026-10-25 | Offline banner text depends on the screen | "Annonces enregistrées à …" only when there are saved listings |
| 2026-10-25 | "Mes commandes" from orders saved on this phone (max 50); the order screen starts from that copy | Works offline and without an account; with login (Feature 14) the gateway list replaces it |
| 2026-10-25 | Favoris tab built here: saved hearts + `GET /v1/products?ids=` in one request | Compte links to it; one request instead of one per product |
| 2026-10-25 | "Se déconnecter" clears account, saved details and the order list from the phone; favourites and cart stay | Shared phones are common; favourites and cart aren't personal data |
| 2026-10-25 | "Supprimer mon compte" in the app, confirmed with the password | Required by Apple and Google store rules |
| 2026-10-25 | Phone shown masked in Compte ("+225 07 •• •• •• 04") | Readable to the owner, not over a shoulder |
| 2026-10-25 | Same login error for unknown number and wrong password | Doesn't reveal which numbers have an account |
| 2026-10-25 | "Ma boutique" (seller tools) not shown yet | v1 or v1.1 is an open client question; no dead buttons |
| 2026-10-25 | Support WhatsApp number and terms URL in `src/config.ts` | Unknown yet; one place to change; support opens the website until we have a number |
| 2026-10-25 | Notifications switch in Compte stores yes/no; system prompt with Feature 16 | Lets people change their answer from the soft ask |
| 2026-10-25 | Confirmation opened with "replace" after payment | "Retour" must never lead back to a paid checkout |
| 2026-10-25 | Order carries its shops, items and a tracking step | "Suivi" needs one plain sentence per shop (delivery, pickup, rental date) |
| 2026-10-25 | Account offer only when no account on this phone; password sent once, never stored | Matches the design; safe by default; the real session arrives with Feature 14 |
| 2026-10-25 | Notification soft ask stores the answer; the system prompt comes with Feature 16; "Plus tard" = 7 days | Asking in our words first gets more "yes"; push needs a development build and admin access |
| 2026-10-25 | One shop: "Vendeur" WhatsApp button in the bar; several shops: a small link under each shop | Big buttons for 3 shops pushed everything down |
| 2026-10-25 | Amounts, "N jours" and « » use non-breaking spaces | "11 / 400 FCFA" split across lines on a 360 phone |
| 2026-10-25 | Guest checkout: name, phone, address; no account | Design says "Pas besoin de compte"; accounts come after payment (Feature 10/14) |
| 2026-10-25 | "Nom et prénom" added to the design's fields | WooCommerce orders and sellers need a name to hand over the item |
| 2026-10-25 | Phone accepted in any common form, stored as `225` + 10 digits, shown "07 00 00 00 00" | People type "+225…", "00225…" or local; one clean format for the gateway and WhatsApp |
| 2026-10-25 | Contact details saved on the phone after checkout | Faster next order; nothing leaves the phone except in the order itself |
| 2026-10-25 | Address required only for home delivery, and must be more than the commune | Riders need a district or landmark; pickup needs no address |
| 2026-10-25 | One delivery choice per shop; rental shops: pickup only | Marketplace: each shop hands over its own items; rentals are checked together at pickup |
| 2026-10-25 | Orders carry an idempotency key | Weak mobile networks: a retry or double tap must never create (or charge) two orders |
| 2026-10-25 | "Payer" re-checks the cart before creating the order; the gateway checks again (`cart_changed`) | Price and stock can change between Panier and Paiement |
| 2026-10-25 | Wave / Orange Money simulated by a sheet in the mock | Real hand-off needs the payment plugin (Feature 15, blocked); success, refusal and abandon can be tested now |
| 2026-10-25 | Temporary `/commande/[id]` screen | Proves the end of the flow; Feature 10 builds the full Confirmation |
| 2026-10-25 | Tab bar: 12 pt side padding and a minimum 12 pt bottom gap | On the OPPO A79 (full-screen gestures) the phone reports no bottom inset, so "Accueil" and "Compte" sat in the rounded corners and looked cut |
| 2026-10-25 | Contract gains `checkCart` (POST `/v1/cart/check`): the whole cart in one request | One round trip on mobile data instead of one per item; Paiement (Feature 9) reuses it |
| 2026-10-25 | "Commander" stops when something changed: blocking problems in red, price/quantity updates in orange; a second tap goes on | People never pay a price they haven't seen |
| 2026-10-25 | Cart lines grouped by shop | Each shop delivers or hands over its own items (marketplace) |
| 2026-10-25 | Deposits shown apart from the total ("Cautions à prévoir en plus") | How deposits are paid is still a client question; we don't hide or merge them |
| 2026-10-25 | On Panier, messages and "Annuler" are shown in the page, not as toasts | Tab bar + action bar leave no room for a toast without covering "Commander" |
| 2026-10-25 | Product toasts are cleared when leaving the product screen | A message about one product shouldn't cover the next screen |
| 2026-10-25 | Temporary `/paiement` screen after a successful check | Proves the flow end to end; Feature 9 replaces it |
| 2026-10-25 | Rentals: start day (Aujourd'hui / Demain / Autre date) + duration stepper, not a two-tap date range | Matches the design; one tap for the usual case; the calendar shades the whole period |
| 2026-10-25 | Contract gains `getRentalCalendar` and `checkRental` | Show booked days before choosing; re-check live before "Réserver" (same rule as stock) |
| 2026-10-25 | Dates as `YYYY-MM-DD` strings, formatted by hand in French | Côte d'Ivoire is GMT all year; avoids time-zone and phone-locale surprises |
| 2026-10-25 | One booking per rental item in the cart; booking again replaces it ("Modifier la réservation") | Simple to understand; avoids two clashing bookings of the same item |
| 2026-10-25 | "Réserver" puts the booking in the cart until Paiement exists (Feature 9) | Lets us test the full flow now; Feature 9 will route straight to payment |
| 2026-10-25 | No "reminder the day before" promise on screen yet | Push notifications are Feature 16 (blocked); we don't promise what the app can't do |
| 2026-10-25 | Conditions de location built only from product data (duration, price, deposit, ID) | Deposit and late-return rules are still open client questions |
| 2026-10-25 | Detail screens split into `src/screens/` + shared parts (`PhotoHeader`, `SellerRow`, `WhatsAppButton`, `Description`, `InfoBlock`) | The route file stays small; sale and rental screens share one look |
| 2026-10-25 | Contract gains `reportProduct` (POST `/v1/products/{id}/reports`) | "Signaler cette annonce" must reach the team; the gateway decides how (email first) |
| 2026-10-25 | "Ajouter au panier" always runs the live stock check first; the screen trusts its answer at once | Never add a sold-out item or a stale price; offline, adding is refused with a clear message |
| 2026-10-25 | Cart saved on the phone (`cart.v1`), never above the shop's stock | Survives closing the app and works offline until payment, where everything is checked again |
| 2026-10-25 | One global toast (`showToast`) instead of alerts | Confirms an action without blocking the screen; offers "Voir le panier" |
| 2026-10-25 | WhatsApp via `https://wa.me/` link, button hidden when the shop has no number | Works with WhatsApp and WhatsApp Business without extra setup in Expo Go |
| 2026-10-25 | Photos fall back to a tinted placeholder with an icon behind | Missing or slow photos (common on mobile data) never leave a blank hole |
| 2026-10-25 | Mock "next stock check" switch on the Données screen | Lets us test "sold out meanwhile" and "price changed" on the phone |
| 2026-10-25 | `ProductSummary` gains `categoryId` (contract v2, cache buster bumped) | "Affiner par catégorie" suggests categories found in the results, not a fixed list |
| 2026-10-25 | Search runs 300 ms after typing stops; recent searches saved on the phone (max 6) | Fewer requests on mobile data; quick repeat searches |
| 2026-10-25 | Filtres sheet edits a draft; live count on the button | Closing without applying never changes results; users see the outcome before applying |
| 2026-10-25 | Bottom sheet wrapped in KeyboardAvoidingView | The keyboard must not cover the price fields |
| 2026-10-25 | Commune choice saved on the phone; asked once at first launch with "Passer" | Lists are local; no tutorial slides (NN/g research in the design brief) |
| 2026-10-25 | Accueil search bar is a button that opens Recherche | Keeps the keyboard and search logic in one place (feature 5) |
| 2026-10-25 | Temporary `/produit/[id]` screen | Lets cards be tapped and tested now; features 6 and 7 replace it |
| 2026-10-24 | Phone cache on AsyncStorage behind `src/data/storage.ts`, not MMKV yet | MMKV needs a development build; AsyncStorage runs in Expo Go. Swapping later touches one file |
| 2026-10-24 | TanStack Query with persisted cache: fresh 5 min, kept 24 h, `offlineFirst` | Screens open instantly from cache and keep working offline, as the brief requires |
| 2026-10-24 | Stock check is a mutation, never cached | Price and stock must always come live from the server before cart and payment |
| 2026-10-24 | Prices formatted by hand (`formatFcfa`), not `toLocaleString` | Android locale data varies and can produce odd spaces |
| 2026-10-24 | Bottom sheet built on React Native `Modal` + `Animated`, no extra library | Works in Expo Go today; swipe-to-close can be added later with gesture-handler |
| 2026-10-24 | Components catalogue screen at `/composants`, linked from Compte in development only | Lets us review every component on a real phone before screens use them |
| 2026-10-24 | JavaScript tabs (`Tabs` from expo-router), not native tabs | Matches the designed white tab bar with labels and badges on both platforms |
| 2026-10-24 | DM Sans as the app font | Stand-in until the brand font is confirmed (open question) |
| 2026-10-24 | Brand colours measured from the logo: navy #002366, orange #F86200, green #00A032 | No official colour codes yet |
| 2026-10-24 | Feather icons from `@expo/vector-icons` | Bundled with Expo Go, consistent stroke style |
| 2026-10-24 | Build v1 against mock data first | Client access and plugin answers are pending; the API contract keeps the switch to real data small |
