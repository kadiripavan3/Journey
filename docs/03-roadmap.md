# Journey — Approach and Roadmap

## Principles

1. **Prove the core loop first:** start a journey → add entries → people follow → they come back for the next entry. Nothing else matters until this works.
2. **Make creating effortless.** No entries means no app, so the entry composer gets the most polish.
3. **Seed real content before launch.** An empty Discover tab kills a social app.
4. **Ship small, measure, then add.** The beta's data chooses the v1.1 features.
5. **Store-ready from day one.** Moderation, account deletion and privacy are part of the MVP, so app review doesn't block the launch.

## Phases

Durations are rough, for you working with Claude Code (give or take 50%).

### Phase 0: Shape (1–2 weeks) ← we are here

- [x] Requirements, tech stack and approach (these docs; decisions confirmed 7 Nov 2026)
- [x] Design 2.0: the design system and design cues, kept in the Journey Hub (`design/hub`; see the [design principles and cues](04-design-brief.md))
- [x] Accent colour: Sun (8 Nov 2026)
- [x] All 59 screens, end to end, in 12 groups (Design 2.1)
- [ ] Review the screens and comment on anything to change in the hub
- [ ] Prototype tested with 5–8 travelers and 5–8 challenge-takers. Can they create a journey and add an entry without help? Would they share it?
- [ ] Accounts: Apple Developer, Google Play Console, Expo, Supabase, Mux, PostHog, Sentry

### Phase 1: Build the MVP (about 13–15 weeks)

Each milestone ends with a build on your phone.

| Milestone | Scope | Weeks (approx.) |
|---|---|---|
| **M1 Foundations** | Repo scaffold, CI, design tokens, sign-in, profiles, onboarding shell, a development build on your phone, the environment setup script | 2 |
| **M2 Create** | Create a journey with templates (Trip and 30-Day Challenge first); add an entry (photos, text, date, place); offline drafts and the upload queue; the journey page and timeline; edit and delete | 3 |
| **M3 Video** | Short clips: pick and compress on the phone, upload to the video service, processing status, tap-to-play in the timeline and entry view, screening of clips | 2 |
| **M4 Follow** | Follow journeys and creators, the Home feed, likes, comments, push notifications and the inbox, catch-up markers | 2 |
| **M5 Discover and share** | The Discover tab, categories, tags, search, the trending job, share links and web share pages | 2 |
| **M6 Finish and safety** | Map view, challenge progress, complete and recap, auto-pause, report and block, moderation, account deletion, settings, analytics, a performance and accessibility pass, store listings | 2–3 |

### Phase 2: Private beta (4–6 weeks)

- TestFlight (iOS) and a Google Play **closed test**.
- Recruit **30–50 creators**, about half with a trip during the beta and half starting a 30-day challenge: friends, micro-influencers, and travel, fitness and learning communities. Give them a **starter kit** with templates, tips and their "Follow my journey" link. Their followers become the first readers.
- Measure the two groups separately, then double down on the one that keeps posting and following.
- Choose the store name, domain and social handles before the beta ends.
- Ship updates weekly over the air, and interview 10 users.
- **Suggested exit criteria:** at least 40% of beta creators post 5+ entries; at least 30% of new-entry notifications are opened; at least 99.5% of sessions are crash-free; D30 retention is heading toward 20%.

> **Google Play rule to plan for:** a *personal* developer account created after 13 Nov 2023 must run a closed test with **at least 12 testers opted in for 14 days in a row** before it can publish to production ([Google's help page](https://support.google.com/googleplay/android-developer/answer/14151465)). An *organization* account doesn't need this, but it needs a D-U-N-S number, which can take weeks to get. Plan the beta around it.

### Phase 3: Public launch

- Release on the App Store and Google Play, with store screenshots taken from the app itself.
- Launch worldwide in English, where both audiences already are: creators' bios ("Follow my journey"), travel, fitness and learning communities on Reddit and in forums (respect their self-promotion rules), Product Hunt.
- Watch the metrics daily for two weeks and fix friction fast.

### Phase 4: Grow and monetize

v1.1, then v1.2, then v2, as listed in the [requirements](01-requirements.md#5-later-not-in-the-mvp), in the order the data supports.

## Monetization (staged)

1. **MVP (confirmed):** free, with no ads. Earn retention first.
2. **Journey+ subscription** (test around US$3–5 a month): videos longer than 60 seconds, offline downloads, creator stats, themes, PDF export.
3. **Printed photo books** of completed journeys through a print-on-demand partner. Polarsteps shows that travelers pay for this.
4. **Creator earnings:** tips and paid exclusive journeys, with a platform fee.
5. **Brands:** clearly labeled sponsored journeys, once there's an audience.

> Digital subscriptions sold inside the app must use Apple's and Google's in-app purchases (RevenueCat makes that easier). Physical photo books can be paid by card, through Stripe for example.

## How we'll work together

- Each milestone is a set of pull requests on this repo, built by Claude Code in the **Journey** cloud environment. You try each one on your phone, then merge.
- These docs are the source of truth. When a decision changes, the doc changes in the same pull request.
- **Done means:** it works on iOS and Android, in light and dark mode, with screen-reader labels, an analytics event, and tests for the logic.

## Next steps

1. Decisions: done on 7 Nov 2026 (see [§9 of the requirements](01-requirements.md#9-decisions)).
2. Review all 59 screens and leave comments in the Journey Hub. I update the screens, then we confirm the accent colour (Sun for now).
3. Start the Apple Developer and Google Play accounts now. Verification can take days, and the Google Play rule above needs 14 days.
4. Then scaffold the app (M1) and finish setting up the environment.
