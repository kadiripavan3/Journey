# Go live: connect the real services

Everything in Journey runs on one computer with stand-ins. This page is the list of what to do, account by account, to run it for real people. Do them in this order; each step says what you create, which values to copy, where each value goes, and how to check it worked.

> **Status:** 10 Nov 2026. The code for every service below is written and tested against small fakes of those services. None of it has talked to the real service yet, because the accounts don't exist. Expect a few small fixes the first time each one is connected; tell me what you see.

**You don't need every account on day one.** Steps 1 to 4 give you a working app with real sign-in and photos. Clips, push notifications, email and the automatic photo check each have an "off" switch (the table in step 3), so the API runs without them and you add them one at a time.

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

The phone sends each photo straight to R2, into a folder called `incoming`, with a link that is good for fifteen minutes and for that one file. The API then opens it, saves the photo it keeps (in three sizes) under `photos`, and deletes the upload. Nothing else is needed for the small photos: no resizing service.

Two rules to add to the bucket, so that nothing waiting in `incoming` can be passed around or left lying:

- **A lifecycle rule** (the bucket's Settings, Object lifecycle rules): delete objects under the prefix `incoming/` one day after they were created. The API removes unfinished uploads itself; this is the second lock on the same door.
- **A rule on the public address** (in Cloudflare, for the domain from step 2: Security, WAF, Custom rules): block requests whose path starts with `/incoming/`. Photos are only ever shown from `/photos/`.

**Check:** post an entry with a photo. It shows in the story, and its address starts with your public address.

## 3. Fly.io: where the API runs

1. Install `flyctl`, sign up, and in `apps/api` run `fly apps create <a name of your own>`. Put that name and the region next to your Supabase project in `apps/api/fly.toml` (`app` and `primary_region`).
2. Set every secret from steps 1 and 2, and from the later steps as you do them, with `fly secrets set`. Also set `JOURNEY_PUBLIC_URL` to the address people will reach the API at (first `https://<app>.fly.dev`, later your own domain): links that leave the app are built from it.
3. Run `fly deploy` from `apps/api`. The first start creates the `journey` schema and every table.
4. To deploy from GitHub from then on: create a deploy token (`fly tokens create deploy`) and add it to the repository's GitHub secrets as `FLY_API_TOKEN`. The **Deploy** workflow then runs whenever `main` changes, and by hand from the Actions tab. Until the secret exists it does nothing.

`fly.toml` already says: sign-in by Supabase, files in R2, one machine that is always on (the weekly digest and reminders run inside the API), a health check, and 1 GB of memory.

**Switch off what you haven't connected yet.** Each of these is a line in `fly.toml` under `[env]` (they are not secrets). Remove the line when you do that step.

| Line in `fly.toml` | What it does | Remove it in |
|---|---|---|
| `JOURNEY_VIDEO_MODE = "off"` | The app offers photos only; no clips | Step 6 |
| `JOURNEY_PUSH_MODE = "off"` | Nothing is pushed to phones; Activity in the app still shows everything | Step 7 |
| `JOURNEY_EMAIL_MODE = "off"` | The weekly digest is shown in the app but not emailed | Step 8 |
| `JOURNEY_MODERATION_MODE = "off"` | Photos are shown without the automatic check. Reports and the reviewer's pages still work. Photos posted meanwhile are checked once you switch it on. | Step 9 |

A switch set to a word the API doesn't know stops it from starting, and the message says which words it takes.

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

## 6. Mux: short clips

1. Create an account at mux.com and an environment (Mux's word for a project; "Production" is fine).
2. In Settings, Access Tokens, create a token with **Mux Video: read and write**. Copy the **token id** and the **token secret** (shown once).
3. In Settings, Webhooks, add a webhook for the same environment that calls `https://<your API address>/webhooks/mux`. Copy its **signing secret**. This is how Mux tells the API a clip is ready to watch.

| Value | Where it goes | Name |
|---|---|---|
| Token id, token secret | Fly secrets | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` |
| Webhook signing secret | Fly secrets | `MUX_WEBHOOK_SECRET` |

Then remove `JOURNEY_VIDEO_MODE = "off"` from `fly.toml` and deploy.

The phone sends each clip straight to Mux. The API never holds the file; it keeps Mux's id for it, and the person who posted sees "Your clip is getting ready" until Mux calls back, usually within a minute.

**Check:** post an entry with a clip of a few seconds. It shows a still frame with a play button; tapping it plays. In Mux's dashboard the clip is under Assets, and the webhook shows a delivery that was answered with 204.

## 7. Push notifications

Push needs a real build of the app (step 4): Expo Go can't receive them.

1. `eas init` (step 4) has given the app its project id. The app uses it to ask Expo for the phone's push address; nothing to copy.
2. **iPhone:** run `eas credentials`, choose iOS, and let it create a push key in your Apple Developer account (or say yes when the first `eas build` offers to). Expo keeps the key.
3. **Android:** in the Firebase console, create a project, add an Android app with your package name, download `google-services.json` into `apps/mobile` and point to it in `app.json` (`android.googleServicesFile`). Then create a service account key (Project settings, Service accounts) and upload it with `eas credentials` (Android, Google Service Account, "Push Notifications: FCM V1").

Nothing is needed on Fly unless you switch on "enhanced security for push notifications" in the Expo project's settings. Then create an access token on expo.dev and set it as the Fly secret `EXPO_ACCESS_TOKEN`.

Then remove `JOURNEY_PUSH_MODE = "off"` from `fly.toml` and deploy.

**Check:** on a phone with a `preview` build, choose "Turn on notifications" while signing up (or later: Settings, Notifications). From a second account, comment on one of your entries. The push arrives within a minute, and tapping it opens the entry with its comments. Likes are gathered for an hour before they are pushed, and new entries for ten minutes, so a burst arrives as one message.

## 8. Resend: email

Two kinds of email leave Journey: the **sign-in code** (sent by Supabase) and the **weekly digest** for people who asked for it by email (sent by the API). Both should come from your own domain.

1. Create an account at resend.com, add your domain and add the DNS records it shows, at your domain's registrar. Wait until Resend says the domain is verified.
2. Create an API key with sending access.
3. **Sign-in codes:** in Supabase, Authentication, Emails, SMTP settings, switch on custom SMTP and enter Resend's SMTP details (host `smtp.resend.com`, port `465`, user `resend`, password: the API key) and a sender address at your domain. Without this, Supabase sends sign-in emails through its own test service, which only delivers to your own team's addresses and only a few an hour: nobody else could sign in.

| Value | Where it goes | Name |
|---|---|---|
| API key | Fly secrets | `RESEND_API_KEY` |
| The sender, such as `Journey <hello@yourdomain.com>` | Fly secrets | `JOURNEY_EMAIL_FROM` |

Then remove `JOURNEY_EMAIL_MODE = "off"` from `fly.toml` and deploy.

The API reads each person's email address from Supabase's own table of people, in the same database. The database user from step 1 is allowed to; nothing to set.

**Check:** sign in with an address that is not yours: the code arrives. For the digest: in the app, Settings, Notifications, switch on "Also send it by email"; it is sent on Sunday at six in the evening (UTC) if a journey you follow had new entries that week.

## 9. AWS Rekognition: the automatic photo check

Every photo is looked at by a machine when it is uploaded. One it flags for nudity or violence is hidden from everyone but the person who posted it, until a reviewer (step 10) decides. Nothing is removed automatically.

1. Create an AWS account. In IAM, create a user for the API with one permission and nothing else: `rekognition:DetectModerationLabels`.
2. Create an access key for that user.

| Value | Where it goes | Name |
|---|---|---|
| Access key id, secret access key | Fly secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| The AWS region to use, if not Ireland (`eu-west-1`) | `fly.toml`, under `[env]` | `JOURNEY_MODERATION_REGION` |

Then remove `JOURNEY_MODERATION_MODE = "off"` from `fly.toml` and deploy. Photos posted before that are checked in the background, a few at a time.

If Rekognition can't be reached, photos are shown and looked at again every quarter of an hour; an outage never stops people from posting. Clips are checked the same way, through three of their still frames. If the API is set to use Rekognition and has no credentials, it says so and doesn't start.

**So that AWS doesn't keep the photos:** by default AWS may store what is sent to Rekognition to improve the service. Opt out for the account (AWS Organizations, Policies, "AI services opt-out policies"), so the privacy policy's sentence "the service that checks photos does not keep them" is true.

**Check:** post an ordinary photo: it shows as usual. The API's log (`fly logs`) has no line about the photo check failing.

## 10. The reviewer's pages

Reports, held photos and comments, and requests to delete an account wait on one page: `https://<your API address>/admin`.

| Value | Where it goes | Name |
|---|---|---|
| A long password of your own (30 characters or more, from a password manager) | Fly secrets | `JOURNEY_ADMIN_PASSWORD` |
| The address people can write to, shown on the contact page | Fly secrets | `JOURNEY_CONTACT_EMAIL` |

A reviewer signs in with any name (it is written next to what they do) and that password. Until the password is set, the pages don't exist. Both app stores expect reports to be looked at within a day.

**Check:** open `/admin`, sign in, and see "No open reports". Report a journey from a second account: it appears there.

## 11. Links that open the app

A shared link (`/j/…`, `/e/…`, `/u/…`, `/i/…`) is a web page served by the API. Once the app is in the stores, the same link can open the app instead, on phones that have it. That needs a domain of your own, because the link's address is what ties it to the app.

1. Point a domain (or a subdomain such as `go.yourdomain.com`) at the API: `fly certs add go.yourdomain.com` in `apps/api`, and add the DNS record it shows. Set the Fly secret `JOURNEY_PUBLIC_URL` to `https://go.yourdomain.com`.
2. Tell the API which app the links belong to:

| Value | Where it goes | Name |
|---|---|---|
| Apple team id, a dot, the app's identifier (`ABCDE12345.com.yourname.journey`) | Fly secrets | `JOURNEY_IOS_APP_ID` |
| The Android package name | Fly secrets | `JOURNEY_ANDROID_PACKAGE` |
| The SHA-256 fingerprints of the Android signing keys, separated by commas (from `eas credentials`, and from Play Console once Google re-signs the app) | Fly secrets | `JOURNEY_ANDROID_FINGERPRINTS` |

3. Tell the app which address it answers to: set `EXPO_PUBLIC_LINK_HOST` to `go.yourdomain.com` in the app build settings and make a new build.

**Check:** `https://go.yourdomain.com/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` answer with a small file. Send yourself a journey's link in Messages and tap it: the app opens on that journey.

Until then, links open the web page, which has a button that opens the app.

## 12. PostHog and Sentry: what people do, and what breaks

Both are off until their key is in the build. Neither is ever sent a name, an email address, a title or anything a person wrote: only which kind of thing happened, and counts.

| Value | Where it goes | Name |
|---|---|---|
| PostHog project key | App build settings (safe to be public) | `EXPO_PUBLIC_POSTHOG_KEY` |
| PostHog address, if your project is not on the US cloud (the EU cloud is `https://eu.i.posthog.com`) | App build settings | `EXPO_PUBLIC_POSTHOG_HOST` |
| Sentry DSN | App build settings (safe to be public) | `EXPO_PUBLIC_SENTRY_DSN` |

**Check:** use the app for a minute. PostHog's activity page shows events such as `entry_posted`. In Sentry, nothing: it only hears about crashes.

## 13. Android: the map

The map of a journey uses Apple Maps on iPhones (nothing to set up) and Google Maps on Android, which needs a key: create one in the Google Cloud project from step 5 (Maps SDK for Android, restricted to your package name and signing fingerprint) and put it in `app.json` under `android.config.googleMaps.apiKey`. This key is safe to be in the app.

## Letting Claude test against the real services

When an account exists and you want me to check it from a session like this one, add the service's address to the cloud environment's network allowlist and its key as a secret there. The addresses are: your Supabase project's address, your R2 endpoint, `api.mux.com`, `exp.host`, `api.resend.com`, `rekognition.<region>.amazonaws.com` and your Fly app's address.

## Every setting, in one place

**The API (Fly secrets, or `[env]` in `fly.toml` for the ones that aren't secret)**

| Name | Step | Secret |
|---|---|---|
| `JOURNEY_DB_URL`, `JOURNEY_DB_USER`, `JOURNEY_DB_PASSWORD` | 1 | yes |
| `JOURNEY_DB_SCHEMA` (`journey`) | 1 | no |
| `SUPABASE_URL` | 1 | no |
| `SUPABASE_SERVICE_KEY` | 1 | yes |
| `SUPABASE_JWT_SECRET` (older projects only) | 1 | yes |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_URL` | 2 | no |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | 2 | yes |
| `JOURNEY_PUBLIC_URL` | 3, 11 | no |
| `JOURNEY_AUTH_MODE`, `JOURNEY_MEDIA_MODE`, `JOURNEY_FORWARD_HEADERS` | already in `fly.toml` | no |
| `JOURNEY_VIDEO_MODE`, `JOURNEY_PUSH_MODE`, `JOURNEY_EMAIL_MODE`, `JOURNEY_MODERATION_MODE` (`off` until connected) | 3 | no |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET` | 6 | yes |
| `EXPO_ACCESS_TOKEN` (only with enhanced push security) | 7 | yes |
| `RESEND_API_KEY` | 8 | yes |
| `JOURNEY_EMAIL_FROM` | 8 | no |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | 9 | yes |
| `JOURNEY_MODERATION_REGION` | 9 | no |
| `JOURNEY_ADMIN_PASSWORD` | 10 | yes |
| `JOURNEY_CONTACT_EMAIL` | 10 | no |
| `JOURNEY_IOS_APP_ID`, `JOURNEY_ANDROID_PACKAGE`, `JOURNEY_ANDROID_FINGERPRINTS` | 11 | no |

**The app (build settings; all of these end up inside the app, so none may be a secret)**

| Name | Step |
|---|---|
| `EXPO_PUBLIC_API_URL` | 4 |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 1 |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | 5 |
| `EXPO_PUBLIC_LINK_HOST` | 11 |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_SENTRY_DSN` | 12 |

**GitHub secrets:** `FLY_API_TOKEN` (step 3).
