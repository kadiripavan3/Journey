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
- **Look:** every colour, size and radius comes from `src/theme/tokens.ts`, generated from `design/tokens.json`. The design system is in `src/ui` (it knows nothing about journeys, people or the API); components that do are in `src/features`. The linter keeps sizes, corners, colours and emoji coming from the tokens (see "App structure and standards" in the repo's `CLAUDE.md`).
- **API:** `src/api/generated` is generated from the API's description. Don't edit it by hand.
- **Adding a library:** use `npx expo install <name>` so the version matches the Expo SDK.

Setup for a Mac and an iPhone: [docs/07-run-locally.md](../../docs/07-run-locally.md).

## Links that open the app

Shared links are web pages served by the API: `/j/{id}` (a journey), `/e/{id}` (an entry), `/u/{username}` (a person) and `/i/{token}` (a one-time invitation). Each page has an "Open in the app" button.

**What works today.** The button uses the app's own scheme (`journey://entry/…`, set as `scheme` in `app.json`), which opens the installed app on the right screen. A link that arrives before the person has signed in is remembered and opened once they are in (`src/lib/links.ts`, `src/app/+native-intent.ts`).

**What is left for the store builds** (it needs the real web address and the store accounts, so it is not in `app.json` yet): making a tap on the web address itself open the app, without the page in between.

1. Tell the API which app may open its links. It then serves the two files Apple and Google look for, at `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` (they don't exist while these are unset):
   - `JOURNEY_IOS_APP_ID`: the Apple team id, a dot, and the bundle id, such as `ABCDE12345.app.journey`
   - `JOURNEY_ANDROID_PACKAGE`: the Android package name
   - `JOURNEY_ANDROID_FINGERPRINTS`: the SHA-256 fingerprints of the keys the Android app is signed with, separated by commas (Expo shows them with `eas credentials`; Play shows the one it signs with under App integrity)
2. Add the web address to `app.json`, with the real domain in place of `journey.app`:

   ```json
   "ios": { "associatedDomains": ["applinks:journey.app"] },
   "android": {
     "intentFilters": [
       {
         "action": "VIEW",
         "autoVerify": true,
         "data": [
           { "scheme": "https", "host": "journey.app", "pathPrefix": "/j/" },
           { "scheme": "https", "host": "journey.app", "pathPrefix": "/e/" },
           { "scheme": "https", "host": "journey.app", "pathPrefix": "/u/" },
           { "scheme": "https", "host": "journey.app", "pathPrefix": "/i/" }
         ],
         "category": ["BROWSABLE", "DEFAULT"]
       }
     ]
   }
   ```

3. Make a new build (this changes the native app, so an update over the air is not enough) and tap a shared link on a phone. Apple fetches its file through its own servers within a day of the first install; if a link still opens the browser, check that the file is served over https without a redirect.

The app already knows what to do with such a link: `+native-intent.ts` turns `/e/…` into the entry screen, and so on. Nothing else in the app changes.
