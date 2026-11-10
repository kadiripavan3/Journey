# Go live: connect the real services

Everything in Journey runs on one computer with stand-ins. This page is the list of what to do, account by account, to run it for real people. Do them in this order; each step says what you create, which values to copy, where each value goes, and how to check it worked.

> **Status:** 10 Nov 2026. The code for every service below is written and tested against small fakes of those services. None of it has talked to the real service yet, because the accounts don't exist. Expect a few small fixes the first time each one is connected; tell me what you see.

## Where values go

There are four places. Each step below names one of them.

| Place | What it is for | How to set it |
|---|---|---|
| **Fly secrets** | What the API needs when it runs | `fly secrets set NAME=value` in `apps/api` |
| **App build settings** | What the app needs when it is built. Only values that are safe to be public: they end up inside the app. | `eas env:create` (or the project's page on expo.dev), for the `preview` and `production` profiles |
| **GitHub secrets** | What the deploy workflow needs | The repository's Settings, Secrets and variables, Actions |
| **Claude's cloud environment** | So I can test against the real service from here | The environment's settings: the service's address on the network allowlist, and its key as a secret |

Never put a key in a file in the repository, in a chat, or in an app build setting unless this page says it is safe to be public.

## 1. Supabase: the database and sign-in

1. Create a project at supabase.com. Pick a region near your users and note it: the API should run in the same region (step 3).
2. **Keep the API's tables out of Supabase's own data API.** Supabase serves every table in the `public` schema to anyone holding the project's public key, unless a rule on the table says otherwise. Journey doesn't use that data API at all: the Java API is the only door. So the API keeps its tables in a schema of its own, called `journey`, which Supabase does not serve. In the project's API settings, also switch the Data API off (or remove `public` from the exposed schemas). Either one is enough; do both.
3. Copy the database's connection details (the direct connection, not the pooler: Fly.io reaches it directly). The address for the API has this shape, with the schema at the end:

   `jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require&currentSchema=journey,extensions`

4. In the project's Authentication settings:
   - Email: switch on sign-in by email, and set the email template to send a **6-digit code** (the template's `{{ .Token }}`), not a link.
   - Leave anonymous sign-ins off.
   - Apple and Google are added in step 5.
5. Copy three values from the project's API settings: the **project URL**, the **publishable (anon) key** and the **secret (service role) key**.

| Value | Where it goes | Name |
|---|---|---|
| Database address (above) | Fly secrets | `JOURNEY_DB_URL` |
| Database user and password | Fly secrets | `JOURNEY_DB_USER`, `JOURNEY_DB_PASSWORD` |
| The word `journey` | Fly secrets | `JOURNEY_DB_SCHEMA` |
| Project URL | Fly secrets | `SUPABASE_URL` |
| Secret key | Fly secrets | `SUPABASE_SERVICE_KEY` (used for one thing: removing the sign-in when someone deletes their account) |
| Project URL | App build settings (safe to be public) | `EXPO_PUBLIC_SUPABASE_URL` |
| Publishable key | App build settings (safe to be public) | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

The API checks every sign-in token against the project's public keys, which it fetches from the project by itself. An older project that still signs tokens with a shared secret also works: set `SUPABASE_JWT_SECRET` in Fly secrets.

**Check:** after step 3, sign in with your email in a `preview` build of the app. A code arrives by email; the app opens on "Create your profile".

## 2. Cloudflare R2: photos

1. In Cloudflare, create an R2 bucket (for example `journey-media`).
2. Give the bucket a public address: connect a domain you own (for example `media.yourdomain.com`), which also puts Cloudflare's CDN in front of it. The `r2.dev` address works for a first test but is rate-limited.
3. Create an R2 API token with read and write access to that bucket only. Copy the **access key id**, the **secret access key** and the account's **S3 endpoint** (`https://<account-id>.r2.cloudflarestorage.com`).
4. Add a CORS rule to the bucket so the web preview can upload: allow `PUT` from your own addresses. Phones don't need it.

| Value | Where it goes | Name |
|---|---|---|
| S3 endpoint | Fly secrets | `R2_ENDPOINT` |
| Bucket name | Fly secrets | `R2_BUCKET` |
| Access key id, secret access key | Fly secrets | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |
| The bucket's public address, no slash at the end | Fly secrets | `R2_PUBLIC_URL` |

The phone sends each photo straight to R2 with a link that is good for fifteen minutes and for that one file. The API then reads the photo once to make the two smaller versions and stores them next to it. Nothing else is needed for the small photos: no resizing service.

**Check:** post an entry with a photo. It shows in the story, and its address starts with your public address.

## 3. Fly.io: where the API runs

1. Install `flyctl`, sign up, and in `apps/api` run `fly apps create <a name of your own>`. Put that name and the region next to your Supabase project in `apps/api/fly.toml` (`app` and `primary_region`).
2. Set every secret from steps 1 and 2, and from the later steps as you do them, with `fly secrets set`. Also set `JOURNEY_PUBLIC_URL` to the address people will reach the API at (first `https://<app>.fly.dev`, later your own domain): links that leave the app are built from it.
3. Run `fly deploy` from `apps/api`. The first start creates the `journey` schema and every table.
4. To deploy from GitHub from then on: create a deploy token (`fly tokens create deploy`) and add it to the repository's GitHub secrets as `FLY_API_TOKEN`. The **Deploy** workflow then runs whenever `main` changes, and by hand from the Actions tab. Until the secret exists it does nothing.

`fly.toml` already says: sign-in by Supabase, files in R2, one machine that is always on (the weekly digest and reminders run inside the API), a health check, and 1 GB of memory.

**Check:** `https://<app>.fly.dev/actuator/health` answers `{"status":"UP"}`. `https://<app>.fly.dev/local-auth/token` answers "not found": the test sign-in does not exist there.

The API refuses to start if a stand-in is switched on without the `local` profile, and says which one. If a deploy fails with a message about `SUPABASE_URL` or `R2_…`, that secret is missing.

## 4. The app on your iPhone, for real

1. Create an Expo account and, in `apps/mobile`, run `eas init` once. It writes the project's id into `app.json`.
2. Set the app's build settings (the table in step 1, and `EXPO_PUBLIC_API_URL` = the API's address from step 3) for the `preview` and `production` profiles.
3. Change `app.journey.dev` in `app.json` (`ios.bundleIdentifier`, `android.package`) to an identifier of your own before the first store build. It can't be changed afterwards.
4. Build: `eas build --profile preview --platform ios` for a build you install from a link. `eas.json` has three profiles: `development` (your own phone, with the test sign-in), `preview` (testers, real sign-in) and `production` (the stores).

Expo Go keeps working for everything that doesn't need a real build. Short clips shrunk on the phone, push notifications and Google sign-in need a real build.

## 5. Apple and Google sign-in

**Apple** (needs the paid Apple Developer Program):

1. In the Apple Developer account, switch on "Sign in with Apple" for the app's identifier.
2. In Supabase, Authentication, Providers, switch on Apple and enter the app's identifier as the client id. Nothing else is needed for the native sign-in the app uses.

The app shows "Continue with Apple" on iPhones. It is already in `app.json`.

**Google** (needs a Google Cloud project):

1. Create two OAuth client ids: one of type **Web** and one of type **iOS** (with the app's identifier). For Android add one of type Android later.
2. In Supabase, switch on Google and enter the Web client id (and its secret); add the iOS client id to the list of allowed client ids.
3. In `apps/mobile`: `npx expo install @react-native-google-signin/google-signin`, and add its plugin to `app.json` with the iOS URL scheme Google shows for the iOS client id:

   `["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<your-ios-client-id>" }]`

| Value | Where it goes | Name |
|---|---|---|
| Web client id | App build settings (safe to be public) | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| iOS client id | App build settings (safe to be public) | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |

Until the Web client id is set, "Continue with Google" says it isn't available and points to email.

**Check:** each button signs you in and lands on "Create your profile" the first time, and on Home after that.
