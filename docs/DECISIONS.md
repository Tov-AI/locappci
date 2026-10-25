# Decisions log

One line per decision, newest first. Why we chose it matters more than what.

| Date | Decision | Why |
| --- | --- | --- |
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
