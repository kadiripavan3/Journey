# Journey — Run It on Your Mac

> Everything runs on your computer: the database, the Java API and the app. The only account you need is a free Expo login, so that Expo Go on your iPhone will open the app.
>
> **Status:** 10 Nov 2026. I built this in the cloud and checked it in a browser: a walk-through signs up a new person and uses every screen below, in light and dark. I could not try it on a real iPhone from there, so your first run is that test. If a step fails, tell me what you saw.

## What works today

The app opens with **ten sample creators and their journeys**, so there is something to read and follow from the first minute.

- **Sign-up:** Welcome, how it works, sign-in with any email and the test code **123456** (no email is sent), your profile, your interests, journeys to follow
- **Reading:** Home with what's new from the journeys you follow, the Following feed that ends with "You're all caught up", Discover with category filters, a journey's page and its story line (with quiet days and "new since your last visit"), and entries you swipe through
- **Creating:** the + button, starting a journey in three steps (template, details with a cover, who can see it), adding an entry with photos, a place and a milestone, editing and deleting entries, pausing and deleting a journey
- **People:** like and comment on entries (with replies), creator profiles, following people, followers and following, and Activity with a dot on its tab
- **Finishing:** challenge journeys show their progress and a grid of days; complete a journey with a closing note and get its recap; change a journey's details later
- **Finding:** search for journeys and people, with popular tags
- **You:** your profile with your journeys, editing it (photo, name, username, bio, link, interests), and Settings: notifications, privacy, appearance, your account, and deleting it
- **Safety:** report a journey, an entry, a comment or a person; block and unblock people
- Light and dark mode, following your phone or your own choice

**Testing alone:** when you post an entry to a public journey, two of the sample creators like it, one comments and one starts following you. That is only so you can see likes, comments and Activity work with one phone.

Not built yet: shared journeys, the map, the weekly digest, share links, clips, working offline, push notifications, and Apple and Google sign-in. [The roadmap](03-roadmap.md) has the order.

## One-time setup

About 20 minutes.

| # | What | How |
|---|---|---|
| 1 | **Node 22** | `brew install node@22`, then check with `node -v` (22.13 or newer) |
| 2 | **Java 21 or newer** | Any JDK you already use is fine. Check with `java -version`. |
| 3 | **Docker Desktop** | For the database. Open it once so it is running. |
| 4 | **The code** | `git clone https://github.com/kadiripavan3/Journey.git`, then `cd Journey` and `git checkout claude/gifted-galileo-2tmuf5` |
| 5 | **Expo Go on your iPhone** | Install it from the App Store. Create a free account at expo.dev and sign in inside Expo Go. |
| 6 | **The same Expo login on your Mac** | `cd apps/mobile`, then `npx expo login` |
| 7 | **Xcode** (optional) | From the App Store. It adds the iOS Simulator now, and real builds on your iPhone later. |

## Start it

From the `Journey` folder:

```sh
./scripts/dev.sh
```

It starts the database, then the API, then the app, and prints a QR code.

| Where | How |
|---|---|
| **Your iPhone** | Be on the same Wi-Fi as the Mac. Scan the QR code with the Camera app; it opens in Expo Go. |
| **iOS Simulator** | Press `i` in the terminal (needs Xcode). |
| **A browser** | Press `w`. |

Sign in with any email. The code is **123456**.

The first time, macOS may ask whether Java and Node may accept incoming connections. Choose **Allow**: your iPhone reaches the API through that.

## Debug the API in your IDE

1. Open `apps/api` in IntelliJ (or any Java IDE). It is a normal Maven project.
2. Run `JourneyApiApplication` with the active profile `local`, in debug mode if you like.
3. Start `./scripts/dev.sh` afterwards. It sees the API is already running and uses yours.

Every endpoint can be tried in a browser at http://localhost:8080/swagger-ui.html. To call the ones under `/v1`, get a token from `POST /local-auth/token` first and paste it into **Authorize**.

## Everyday commands

| What | Command |
|---|---|
| The API's tests (need the database running) | `cd apps/api && ./mvnw test` |
| The app's checks: types, lint, tests | `cd apps/mobile && npm run check` |
| After changing the API: refresh its description, then the app's client | `cd apps/api && UPDATE_OPENAPI=1 ./mvnw test`, then `cd apps/mobile && npm run api:generate` |
| After changing `design/tokens.json`: refresh the app's theme | `cd apps/mobile && npm run theme` |
| Empty the local database | `docker compose down -v` |

## If something goes wrong

| What you see | What to do |
|---|---|
| Expo Go asks you to log in, or won't open the project | Sign in to Expo Go with the same account you used for `npx expo login` on the Mac. |
| Expo Go says the project uses a different SDK version | Update Expo Go from the App Store. |
| The app opens but says "Can't reach Journey right now" | The phone can't reach the API. Check both are on the same Wi-Fi, and that you allowed incoming connections for Java. On some networks devices can't see each other: try `./scripts/dev.sh --tunnel` for the app, and tell me, because the API then needs another route. |
| "No database found" | Docker Desktop isn't running. Start it and run the script again. |
| Port 5432 is already in use | You already run a PostgreSQL. Run `./scripts/local-db.sh` once to create Journey's databases in it; the script then uses it. |
| The API stops while starting | The end of `.dev/api.log` says why. Send it to me if it isn't clear. |

## What is real and what is a stand-in

We build local first (decided on 10 Nov 2026). Each outside service has a stand-in until its account exists:

| Real service, connected later | Stand-in today |
|---|---|
| Sign-in with Apple, Google or an email code | Any email with the test code |
| Photo storage | Photos are saved in a folder next to the API (`apps/api/.dev/media`) and served by it |
| Video | Arrives with the Video milestone: clips stored and played as plain files |
| Push notifications | Shown in the Activity inbox only |
| Email | Written to the API's log |
| Other people | Ten sample creators, added to an empty database. They react when you post, as described above |

Switching a stand-in for the real service is a setting in the API. The app and the rest of the API don't change.

## A real build on your iPhone, later

Expo Go can't run everything: push notifications, Google sign-in and video compression need a build of Journey itself. With Xcode and your free Apple ID, `npx expo run:ios --device` installs one on your iPhone for 7 days at a time. We'll set that up when the first feature needs it.
