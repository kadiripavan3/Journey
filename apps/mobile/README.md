# Journey app

The iOS and Android app: Expo (React Native, TypeScript) with Expo Router.

```sh
npm install
npx expo start        # or ../../scripts/dev.sh, which also starts the database and the API
npm run check         # types, lint and tests
npm run theme         # after design/tokens.json changes
npm run api:generate  # after ../api/openapi.json changes
```

- **Screens** live in `src/app` (one file per screen). The designs they follow are in `design/hub/src/screens`.
- **Look:** every colour, size and radius comes from `src/theme/tokens.ts`, generated from `design/tokens.json`. Shared components are in `src/ui`.
- **API:** `src/api/generated` is generated from the API's description. Don't edit it by hand.
- **Adding a library:** use `npx expo install <name>` so the version matches the Expo SDK.

Setup for a Mac and an iPhone: [docs/07-run-locally.md](../../docs/07-run-locally.md).
