# Journey — Approach and Roadmap

## Principles

1. **Prove the core loop first:** start a journey → add entries → people follow → they come back for the next entry. Nothing else matters until this works.
2. **Make creating effortless.** No entries means no app, so the entry composer gets the most polish.
3. **Seed real content before launch.** An empty Discover tab kills a social app.
4. **Ship small, measure, then add.** The beta's data chooses the v1.1 features.
5. **Store-ready from day one.** Moderation, account deletion and privacy are part of the MVP, so app review doesn't block the launch.

## Phases

Durations are rough, for you working with Claude Code (give or take 50%).

### Phase 0: Shape (done)

- [x] Requirements and approach (these docs; decisions confirmed 7 Nov 2026)
- [x] Tech stack final (9 Nov 2026): an Expo app, a Java (Spring Boot) API, PostgreSQL and sign-in on Supabase ([tech page](02-tech-stack.md))
- [x] Design 2.0: the design system and design cues, kept in the Journey Hub (`design/hub`; see the [design principles and cues](04-design-brief.md))
- [x] Accent colour: Sun (8 Nov 2026)
- [x] All 66 screens, end to end, in 13 groups (Design 2.1)
- [ ] Review the screens and comment on anything to change in the hub
- [x] Engagement plan decided (9 Nov 2026): shared journeys and a weekly digest join the first version ([engagement plan](06-engagement.md#decisions))
- [ ] Prototype tested with 5–8 travelers and 5–8 challenge-takers. Can they create a journey and add an entry without help? Would they share it?
- [ ] Accounts, each when it is first needed ([the list](02-tech-stack.md#accounts-and-when-each-is-needed)). Enrol in the Apple Developer Program now: it can take weeks.

### Phase 1: Build the MVP (about 17–20 weeks) ← we are here

**Local first** (decided on 10 Nov 2026). Every feature is built and tested on one computer, with stand-ins for the outside services. The accounts are created and the real services connected at the end; expect a week or two of fixing then. There is no rush to release. You run each step on your Mac and open it on your iPhone in Expo Go ([how](07-run-locally.md)).

Progress:

- [x] **M1 Foundations** (10 Nov 2026): the app and the Java API side by side, sign-in with a test code, the sign-up flow (how it works, profile, interests, journeys to follow, all set), profiles with a photo, the tab bar, automatic checks
- [x] **The core loop** (10 Nov 2026; from M2, M4 and M5): start a journey from a template, add and edit entries with photos, the journey page and story line, follow journeys, the Home feed that ends with "You're all caught up", Discover with categories
- [x] **Likes, comments, following people and Activity** (10 Nov 2026; from M4), with creator profiles and the lists of followers
- [x] **Search, settings and safety** (10 Nov 2026; from M5 and M6): search for journeys and people, settings (notifications, privacy, appearance, account), deleting your account, report and block
- [x] **Finishing a journey** (10 Nov 2026; from M6): challenge progress, completing a journey with a closing note, its recap, and changing a journey's details
- [x] **Shared journeys** (10 Nov 2026; from M2 and M4): invite up to three followers, join by accepting, write together, people and roles, on every author's profile. Not yet: the one-time link for a friend who isn't on Journey (it comes with share links)
- [x] **The weekly digest and share links** (10 Nov 2026; from M4 and M5): "This week in the journeys you follow" with a weekly message (written to the log until push and email are connected), and a public web page for every public or unlisted journey, with link previews
- [x] **Look and feel** (10 Nov 2026): 3D icons, frosted glass on everything that sits on a photo, and motion (press feedback, the heart, progress rings, lists arriving) that stops when the phone's Reduce Motion is on
- [x] **More of the designed screens** (10 Nov 2026): Jump to on the story line, the full-screen photo viewer, the note on a paused journey, grey loading shapes instead of spinners, and the offline banner
- [x] **A code review, and everything it found** (10 Nov 2026): the foundation the rest is built on. In the API: one rule for who may see what, counts kept by the database, one way to reach the database, real enums, paged lists, a journey summary, small photos, sending twice makes one, clear errors, a rate limit, a Dockerfile, one code style. In the app: a design-system folder and features folders, every text size, corner and colour from the tokens (the linter enforces it), typed routes, long lists that only draw what is on screen, and updates that change what changed instead of fetching everything again. An independent second review of the new API code found six more defects; those are fixed too. Tests went from 48 to 73 in the API and from 21 to 77 in the app, and the browser walk-through now runs in CI on every push
- [x] **Places, the map, clips and writing without a connection** (10 Nov 2026; from M2, M3 and M6): a place on an entry from the phone's own search, shown at city level unless you choose the exact spot; the map of a journey; short clips through the video service; drafts that wait on the phone and go up when the connection is back
- [x] **Notifications and upkeep** (10 Nov 2026; from M4 to M6): pushes for every kind of news, gathered so a burst is one message; reminders you switch on; a journey that pauses itself after 30 quiet days; what's trending, by a rule anyone can check; the weekly digest by push and email; counting what people do, without names
- [x] **Safety, links and the store's rules** (10 Nov 2026; from M5 and M6): photos and clips looked at automatically and held when doubted, a word filter for comments, a queue for a reviewer; the one-time link that invites a friend who isn't on Journey; web pages for an entry, a person and an invitation; terms, privacy, guidelines and a page to ask for deletion; confirming you are 13 or older
- [x] **The real services, ready to switch on** (10 Nov 2026; M7, the code half): Supabase sign-in, Cloudflare R2, Mux, Expo Push, Resend and the photo check each have their real adapter behind a setting, tried against a small server in the tests; the API is packaged for Fly.io and deploys after a green build. [Connect the real services](08-connect-services.md) has every step
- [x] **A second code review, by five independent reviewers, and everything it found** (10 Nov 2026): about 150 findings. In the API: an uploaded photo is made afresh (really a picture, the right way up, nothing kept that travelled inside the file) and looked at before anyone sees it; nothing waits on an outside service with a transaction open; pushes, emails and file removals survive a restart; who may see what holds for covers, recaps and lists of authors too; every list is read from where the reader is, through an index; the database stops what runs long. In the app: it opens and shows what it kept without a connection, nothing written is lost on the way out, one entry card and one of each helper, text that grows with the phone's setting, and every sentence in one place, ready for translation. The docs were corrected wherever they had fallen behind. Tests went from 73 to 256 in the API and from 77 to 371 in the app
- [ ] **Your part, when you are ready:** run it on your Mac and iPhone ([how](07-run-locally.md)); create the accounts and connect the real services one at a time ([how](08-connect-services.md)), each with its own check; then the first real build on a phone, which is where everything that could only be written carefully, not tried, gets its first test (the list is in the hub's status)

| Milestone | Scope | Weeks (approx.) |
|---|---|---|
| **M1 Foundations** | Repo scaffold (app and API), CI, design tokens as a theme, the API skeleton with its database, the generated API client, sign-in, profiles, the sign-up flow, the app in Expo Go on your phone, the environment setup script | 3 |
| **M2 Create** | Create a journey with templates (Trip and 30-Day Challenge first); add an entry (photos, text, date, place); offline drafts and the upload queue; the journey page and timeline; edit and delete; shared journeys (invite friends, join, who can do what) | 5 |
| **M3 Video** | Short clips: pick and compress on the phone, upload to the video service, processing status, tap-to-play in the timeline and entry view, screening of clips | 2 |
| **M4 Follow** | Follow journeys and creators, the Home feed, likes, comments, push notifications and the inbox, catch-up markers; shared journeys in the feed and on profiles; the weekly digest | 3–4 |
| **M5 Discover and share** | The Discover tab, categories, tags, search, the trending job, share links and web share pages | 2 |
| **M6 Finish and safety** | Map view, challenge progress, complete and recap, auto-pause, report and block, moderation, account deletion, settings, analytics, a performance and accessibility pass, store listings | 2–3 |
| **M7 Connect the real services** | Create the accounts and switch each stand-in for the real thing: Supabase (database and sign-in), Cloudflare R2, Mux, Expo Push, Resend, hosting on Fly.io, moderation. Test each on a real phone. | 1–2 |

### Phase 2: Private beta (4–6 weeks)

- TestFlight (iOS) and a Google Play **closed test**.
- Recruit **30–50 creators**, about half with a trip during the beta and half starting a 30-day challenge: friends, micro-influencers, and travel, fitness and learning communities. Give them a **starter kit** with templates, tips and their "Follow my journey" link. Their followers become the first readers.
- Measure the two groups separately, then double down on the one that keeps posting and following.
- Choose the store name, domain and social handles before the beta ends.
- Ship updates weekly (over the air, once Expo Update is switched on: [step 4 of connecting the services](08-connect-services.md#4-the-app-on-your-iphone-for-real)), and interview 10 users.
- Add two growth pieces while the beta runs: journey pages that search engines can find, and hand-picked featured journeys in Discover.
- Count invitations to shared journeys: how many are sent and how many accepted.
- **Suggested exit criteria:** at least 40% of beta creators post 5+ entries; at least 30% of new-entry notifications are opened; at least 99.5% of sessions are crash-free; D30 retention is heading toward 20%.

> **Google Play rule to plan for:** a *personal* developer account created after 13 Nov 2023 must run a closed test with **at least 12 testers opted in for 14 days in a row** before it can publish to production ([Google's help page](https://support.google.com/googleplay/android-developer/answer/14151465)). An *organization* account doesn't need this, but it needs a D-U-N-S number, which can take weeks to get. Plan the beta around it.

### Phase 3: Public launch

- Release on the App Store and Google Play, with store screenshots taken from the app itself.
- Launch worldwide in English, where both audiences already are: creators' bios ("Follow my journey"), travel, fitness and learning communities on Reddit and in forums (respect their self-promotion rules), Product Hunt.
- Watch the metrics daily for two weeks and fix friction fast.

### Phase 4: Grow and monetize

v1.1, then v1.2, then v2, as listed in the [requirements](01-requirements.md#5-later-not-in-the-mvp), in the order the data supports. The [engagement plan](06-engagement.md) ranks the ideas: story cards, polls, a creator summary and "What's next?" first, then challenges you can join if challenge-takers turn out to be the stronger audience.

## Monetization (staged)

1. **MVP (confirmed):** free, with no ads. Earn retention first.
2. **Journey+ subscription** (test around US$3–5 a month): videos longer than 60 seconds, offline downloads, creator stats, themes, PDF export.
3. **Printed photo books** of completed journeys through a print-on-demand partner. Polarsteps shows that travelers pay for this.
4. **Creator earnings:** tips and paid exclusive journeys, with a platform fee.
5. **Brands:** clearly labeled sponsored journeys, once there's an audience.

> Digital subscriptions sold inside the app must use Apple's and Google's in-app purchases (RevenueCat makes that easier). Physical photo books can be paid by card, through Stripe for example.

## How we'll work together

- Each milestone is a set of pull requests on this repo, built by Claude Code in the **Journey** cloud environment. You try each one on your phone, then merge.
- The backend is Java, so you can read, debug and change it yourself. Every API change comes with tests.
- These docs are the source of truth. When a decision changes, the doc changes in the same pull request.
- **Done means:** it works on iOS and Android, in light and dark mode, with screen-reader labels, an analytics event, and tests for the logic.

## Next steps

1. Decisions: done on 7 Nov 2026 (see [§9 of the requirements](01-requirements.md#9-decisions)).
2. Review all 66 screens and leave comments in the Journey Hub. I update the screens, then we confirm the accent colour (Sun for now).
3. Run the first step on your Mac and open it on your iPhone ([instructions](07-run-locally.md)). It needs only a free Expo login.
4. I continue with M1, step 2. The other accounts wait until the features are built; the Apple Developer Program is needed for TestFlight and the App Store, and can take weeks to approve when you do enrol.
