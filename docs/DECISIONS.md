# Decisions log

One line per decision, newest first. Why we chose it matters more than what.

| Date | Decision | Why |
| --- | --- | --- |
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
