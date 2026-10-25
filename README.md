# LOCAPPCI — mobile app

Android and iOS app for [locappci.fr](https://locappci.fr/), the Ivorian marketplace for buying, renting and finding services.
Built with Expo (SDK 58), Expo Router and TypeScript.

## Run it

```bash
npm install
npx expo start
```

Then press `i` for the iOS simulator or `a` for the Android emulator, or scan the QR code with Expo Go on your phone.

## Checks before every pull request

```bash
npm run typecheck   # TypeScript, must pass with no errors
```

## Where things are

| Path | What lives there |
| --- | --- |
| `src/app/` | Screens. Every file is a route (Expo Router) |
| `src/app/(tabs)/` | The 5 bottom tabs: Accueil, Recherche, Favoris, Panier, Compte |
| `src/components/` | Reusable components (AppText, Screen, EmptyState…) |
| `src/theme/` | Design tokens: colours, type, spacing, radius. Never hard-code these in screens |
| `assets/` | Logo, app icon, splash |
| `docs/` | Feature roadmap and decisions |

## Design references

- **Design brief:** product, users, scope, sync design, architecture
- **Design handoff v1:** every screen, every tap, tokens, components, states
- **Design canvas:** "LOCAPPCI — Core screens v1"

Ask Leo for access to these if you don't have the links.

## How we work

See [CONTRIBUTING.md](CONTRIBUTING.md) and the roadmap in [docs/FEATURES.md](docs/FEATURES.md).
