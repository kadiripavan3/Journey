# Journey — Product Requirements (MVP)

> **Status:** v1.3, decisions confirmed · **Updated:** 10 Nov 2026
>
> This pulls the earlier feedback from DeepSeek, Gemini and ChatGPT into one set of decisions. Where they disagreed, the decision and the reason are written down. The decisions confirmed with you are in [§9](#9-decisions).

## 1. The idea in one line

**Journey is a social app where every post is part of a story.** Instead of one-off posts, people start a *journey* (a trip, a 30-day challenge, building a cabin) and add *entries* to it over time, on a timeline. Others follow the journey and come back for the next chapter.

> Instagram shows a moment. Journey shows how it unfolds.

## 2. Who it is for

| | |
|---|---|
| **Launch audiences** (equal priority) | 1. **Travelers** documenting a trip (backpacking, road trips, study abroad, pilgrimages, family holidays) and the friends, family and fans who follow along. |
| | 2. **Challenge-takers** doing a 30-day fitness challenge, learning a skill or a creative "100 days of…", and the people cheering them on. |
| **Later** | Projects (DIY, renovation, building a startup) and life events (moving abroad, a wedding, a new baby). The data model supports any journey from day one; only templates and marketing change. |

**Why these two:** a trip has a clear start and end, strong photos, a natural map and a built-in audience (family wants updates). A challenge has a built-in arc (Day 1 to Day 30), daily posting and supporters who cheer, with far less direct competition. Launching with both shows the format works for any journey, and the beta tells us which group to double down on.

**The catch on the travel side:** [Polarsteps](https://www.polarsteps.com/news/polarsteps-hits-15-million-users-as-travelers-embrace-authentic-storytelling) (15M+ users) already owns *trip tracking*: automatic GPS routes, followers, printed travel books. Journey must not be a Polarsteps clone. It wins on three things:

1. **Story over tracking:** entries, milestones, recaps and comments, not a GPS line.
2. **Discovery:** you follow strangers' journeys found in Discover, not only friends'.
3. **Any journey:** the same creator follows their trip with a fitness challenge, and their followers stay.

There are two roles, and everyone can be both:

- **Creator:** "Let me document my trip once and let everyone who cares follow along, without spamming my Instagram or sending 20 WhatsApp updates."
- **Follower:** "Let me follow a story I care about, know when there's a new chapter, and catch up on what I missed."

## 3. Core concepts

| Concept | Definition |
|---|---|
| **Journey** | A story with a title, cover, category, start date, visibility and status. Owned by one creator, who can share it with friends. |
| **Shared journey** | A journey with up to 4 authors. The owner invites friends, everyone's entries flow into one timeline, and the journey shows on each author's profile. |
| **Entry** | One update in a journey: photos, text, an optional place, and the date it happened. |
| **Timeline** | Entries always show in the order they *happened*, not the order they were posted. You can post Day 3 after Day 4 and the story stays right. |
| **Day / Part label** | An automatic label on each entry: "Day 5" for dated journeys (trips, challenges), "Part 5" for the rest. |
| **Milestone** | An entry the creator flags as a highlight ("Reached Ha Giang!"). Milestones form a **Highlights** strip for quick navigation. |
| **Status** | **Active** → **Paused** (automatic after 30 days without entries) → **Completed** (the creator closes it, which unlocks the recap). |
| **Follow** | Follow a **journey** to get its new entries. Follow a **creator** to auto-follow their future journeys. |
| **Template** | A starting point with gentle prompts: Trip · 30-Day Challenge · Learn a Skill · Build Something · Open Journal. Trip and 30-Day Challenge are the two flagship templates. |
| **Recap** | An automatic summary when a journey completes (days, entries, places, photos, top moments) as a card you can share. |

## 4. MVP features (must have at launch)

### A. Accounts and onboarding

- **A1 Sign in** with Apple, Google, or an email one-time code. *(App Store rule 4.8: if you offer Google sign-in, you must also offer a privacy-focused option such as Sign in with Apple.)*
- **A2 Profile:** photo, name, @username, short bio, one link.
- **A3 Onboarding** in under a minute: at most 3 intro cards → pick interests → follow suggested journeys → optional "Start your first journey".
- **A4 Settings:** notification controls, default visibility, blocked users, **delete account** (in the app; both stores require it), sign out.

### B. Creating a journey

- **B1 Create a journey in under 60 seconds:** title, template, category, start date and visibility. The cover photo is optional (the first photo is used by default). Up to 5 tags.
- **B2 Templates** (the five above) with prompts. Trip and 30-Day Challenge come first. Trip: "Where are you today? What surprised you?" 30-Day Challenge: a "Day 12 of 30" progress bar and a daily check-in prompt.
- **B3 Visibility per journey:**
  - **Public:** anyone; appears in Discover and search.
  - **Unlisted:** only people with the link (good for family).
  - **Private:** only you (a personal journal you can publish later).
- **B4 Manage:** edit details, change the cover, pause or resume, delete.
- **B5 Complete a journey:** closing note → celebration → automatic **recap card** to share.
- **B6 Shared journeys:** the owner invites up to 3 friends (4 authors in all), in the app or with a one-time link for a friend who isn't on Journey yet. Friends join only if they accept, and in the app only people you follow can invite you. Friends add entries and edit or delete their own. Only the owner changes the journey, completes it, or removes people and entries. A friend can leave at any time; their entries stay unless they delete them.

### C. Adding entries (the most important flow, so it must be fast)

- **C1 Add an entry:** up to 10 photos and short video clips (at most 3 clips, each up to 60 seconds), plus text (optional if there is a photo or clip). The date defaults to the photo's date or now and can be back-dated. The place is suggested from the photo or GPS and shown at city level unless you choose an exact pin.
- **C1b Video clips:** compressed on the phone, uploaded in the background, and streamed at a quality that suits the connection. In the app they show a still frame and their length, and play only when tapped (no autoplay).
- **C2 Quick add:** the **+** button posts to your current active journey in two taps.
- **C3 Offline drafts:** write entries (with photos and clips) with no signal; they upload automatically when you're back online, with progress and retry. *(Essential for travelers.)*
- **C4 Milestone toggle** on any entry.
- **C5 Edit or delete** entries at any time (edited ones are marked "edited").
- **C6 Gentle reminders (opt-in):** "It's been 3 days since your last update to *Vietnam by motorbike*." Daily for challenges, and never more than one a day.

### D. Reading a journey

- **D1 Journey page:** cover, title, creator, status, dates, counts (days · entries · followers), a **Follow** button, the Highlights strip, then the timeline.
- **D2 Timeline:** vertical and grouped by Day or Part, with sticky labels and swipeable photos and clips. Challenge journeys show their "Day 12 of 30" progress at the top. A **Jump to** sheet lists the days and milestones. New readers get **Start from the beginning**; followers get **Continue where you left off**.
- **D3 Entry view:** full-screen photos and video, text, place, likes and comments.
- **D4 Map view:** entries that have a place appear as numbered pins, joined in order. Tap a pin to open the entry.
- **D5 Catch up:** "3 new entries since your last visit" markers on the timeline and in the feed.
- **D6 Shared journeys read as one story:** the journey page shows every author, each entry shows who posted it, and readers can filter the timeline by person.

### E. Social

- **E1 Follow** journeys and creators. One Follow on a shared journey brings every author's entries.
- **E2 Like** entries (one heart).
- **E3 Comment** on entries, with one level of replies. Creators can delete comments on their own journeys.
- **E4 Home feed (Following):** new entries from journeys you follow, newest first, grouped per journey ("*Vietnam by motorbike* · 3 new entries"), ending with "You're all caught up". It is **chronological, not algorithmic**, so followers can trust they won't miss a chapter.
- **E5 Notifications** (push and an in-app inbox): a new entry in a followed journey (batched per journey), a journey completed, a new follower, an invitation to a shared journey, comments and replies, likes (batched). Each type can be switched off.
- **E6 Share:** the phone's share sheet for a journey or an entry. Links open the app if it's installed, otherwise a **public web page** (the journey, read-only, with "Follow in the app"). Links show rich previews on WhatsApp, Instagram and X. Plus a **"Follow my journey"** link for social bios.
- **E7 Weekly digest:** one message a week, "This week in the journeys you follow", by push, and by email for people who opt in. It opens a page that ends like the feed does. Nothing is sent in a week with nothing new, and it can be switched off.

### F. Discovery

- **F1 Discover tab:** category chips (Travel · Fitness · Learning · Food · Creative · Projects · Life) and the sections **Trending now · New journeys · Recently completed**, personalised by the interests picked at onboarding.
- **F2 Search:** journeys (title, tags, places), people, and tags (#solotravel).
- **F3 Quality bar:** only public journeys with a cover and 3+ entries appear in Discover. Paused journeys rank lower. Reported content is hidden until reviewed.
- **F4 Simple ranking, no machine learning yet:** recent entries, follower growth, engagement, completion.

### G. Profiles

- **G1 Profile:** photo, bio, counts, a **Follow** button for the creator, and **Active** and **Completed** tabs of journeys. A shared journey appears on every author's profile with a **Shared** label.
- **G2 Your own profile** also shows your drafts and private journeys (only to you).

### H. Trust, safety and store rules (needed for App Store and Google Play approval)

- **H1 Report** a journey, entry, comment or user.
- **H2 Block** a user: they can't see, follow, comment on or invite you to anything, and you don't see their content.
- **H3 Automatic screening** of uploaded photos and video clips (nudity, violence) and a profanity filter on comments. Flagged items are held for review.
- **H4 Moderation queue** for the team (start with a simple internal page).
- **H5 Account deletion** in the app, plus a web page for deletion requests (Google Play requires both).
- **H6 Location privacy:** city level by default, exact pins only if you choose, GPS data stripped from photos on upload, no live location.
- **H7 Legal:** terms, privacy policy, community guidelines and contact details in the app. Users must be 13+ (16+ where local law requires). App Store privacy labels and the Google Play Data safety form.

### I. Quality bar

- **I1** iOS and Android phones from one codebase; portrait; light and dark mode; dynamic text sizes; screen-reader labels; 44 pt touch targets; AA colour contrast.
- **I2** A smooth 60 fps timeline. Photos and video stills load progressively with placeholders. Photos and clips are compressed on the phone before upload.
- **I3** Works on bad networks: retries, offline drafts, and what was read in the last week readable offline.
- **I4** Analytics and crash reporting from day one.
- **I5** English at launch, with all text ready for translation. The app's own text is in one place for that; the sentences the API sends (errors, pushes, emails, web pages) are in English, each with a stable code, and are translated when a second language is chosen.

## 5. Later (not in the MVP)

| When | Feature | Why later |
|---|---|---|
| **During the beta** | Journey pages that search engines can find | Added while the beta runs, so the first version isn't delayed |
| | Hand-picked **featured journeys** in Discover ("Journey of the week", small themed collections) | Needs real journeys to feature |
| **v1.1** | **Polls on entries** ("Where should I go next?"), the simple version of "choose your own adventure" | A big engagement win, but it needs an audience first |
| | **Story cards** for Instagram and TikTok with a "Follow my journey" link | A growth loop, once the core works |
| | **Creator stats** (views, followers over time) and a weekly summary for creators | |
| | **"What's next?"** when a journey completes: a next journey for the creator, similar journeys for readers | |
| | Scheduled entries and smarter reminders | |
| **v1.2** | Badges for completion and milestones: celebratory, never punishing | |
| | **Challenges you can join:** many people do the same 30-day challenge at once, each on their own journey, with a shared page and separate progress for each person | The biggest lever for challenge-takers; the beta shows if they are the stronger audience |
| | Download whole journeys for offline reading | |
| | **Journey+** subscription (see the [roadmap](03-roadmap.md#monetization-staged)) | |
| | **Longer videos** (over 60 s), as a Journey+ perk | Storage and streaming cost |
| | **Export** a completed journey as a PDF or a printed photo book | Proven revenue in travel |
| | Optional AI help: draft a recap or caption, translate entries. The creator always edits and approves. | |
| **v2** | Creator tips and paid "exclusive" journeys | Needs scale and payments work |
| | Clearly labeled sponsored journeys with brands | Needs an audience |
| | Personalised recommendations (machine learning), "Journeys like this" | Needs data |
| | A web app for reading and writing; tablet layouts | |
| | Private accounts with follow requests; close-friends lists | |
| | Audio notes, chapters, Q&A | |

## 6. What Journey should NOT have

| Not this | Why |
|---|---|
| **Standalone posts outside a journey** | Every post belongs to a story; that *is* the product. Quick add and the Open Journal template keep posting easy. |
| **24-hour stories or disappearing posts** | Journey is about keeping a story, not losing it. |
| **An endless, algorithmic or autoplaying video feed** | Home is chronological from what you follow. Discover uses simple, explainable rules. Clips play only when tapped. |
| **Direct messages (in the MVP)** | The biggest moderation and safety burden. Comments cover conversation. Revisit after launch. |
| **Automatic GPS route tracking or live location** | Safety and battery life, and it's Polarsteps' game. Places come from entries. |
| **Live streaming, AR/VR, heavy photo or video editing** | Expensive and off-mission. The phone's own editor is enough. |
| **Ads in the MVP, and never selling user data** | Fewer posts make ads weak, and trust matters more. Revenue comes later from subscriptions and creator tools. |
| **Streak guilt** | No "you lost your 12-day streak". Journeys can have gaps. |
| **AI-generated journeys or auto-posting** | Content is real. AI may help a creator write, but the creator approves everything. |
| **Groups, events, a marketplace, shopping** | Focus. |
| **Desktop or tablet apps, or posting from the web (in the MVP)** | Phones first. The web is read-only, for shared links. |

## 7. How the hard problems are solved

| Concern from the AI reviews | Answer in this design |
|---|---|
| Keeping a journey going takes effort | Templates with prompts, two-tap quick add, offline drafts, opt-in reminders, back-dating, photo-only entries, the Open Journal template |
| Journeys get buried; discovery is hard | Categories, tags, search, Discover sections, share links with web previews, "Follow my journey" bio links |
| Abandoned journeys clutter feeds | Statuses, auto-pause after 30 days with a nudge, paused journeys rank lower, and Completed gives closure and a recap |
| Followers lose interest or miss updates | Batched push per new entry, "new since your last visit" markers, Continue reading, the Highlights strip |
| Long journeys are hard to navigate | Day labels, milestones, the Jump to sheet, the map view |
| Quality control | The Discover quality bar, simple ranking, reporting and moderation |
| Video storage cost | Clips only: at most 3 per entry, each up to 60 s, compressed on the phone, then transcoded and streamed by a managed video service. Longer videos come later as a Journey+ perk. |
| Unclear monetization | A free MVP to prove retention, then a subscription, photo books, creator tips and labeled sponsorships ([roadmap](03-roadmap.md#monetization-staged)) |
| Competition (Instagram, TikTok, Substack, Polarsteps) | Visual stories told in parts, for any journey, with followers and discovery (see §2) |
| Single posts for casual users (ChatGPT's "hybrid" idea) | Rejected on purpose (see §6). The Open Journal template covers casual posting. |

## 8. Success metrics

| Metric | Definition | Suggested beta target |
|---|---|---|
| **North star: Weekly Active Journeys** | Journeys that got a new entry this week and have at least one follower | Grows week over week |
| Creator activation | New creators who post 3+ entries within 14 days | ≥ 40% |
| Follower engagement | New-entry notifications that get opened | ≥ 30% |
| Retention | Users active again on day 7 and day 30 | D30 ≥ 20% |
| Completion | Journeys marked complete, or reaching their template's end | Track and improve |
| Growth loop | Share-link views → installs → follows; invitations sent → accepted | Track and improve |

Track every metric separately for travel journeys and challenge journeys. The beta decides which audience to double down on.

## 9. Decisions

Confirmed with you between 7 and 10 Nov 2026:

| # | Topic | Decision |
|---|---|---|
| 1 | Launch audience | Travelers **and** challenge-takers, with equal priority. Trip and 30-Day Challenge are the flagship templates. |
| 2 | Name | *Journey* is the working name. The store name is chosen before launch, because [Journey – Diary, Journal](https://apps.apple.com/app/id1300202543) (Two App Studio) already uses it; check trademarks, both stores and the domain. Unchecked ideas to start from: *Journeyline*, *Trailbook*, *Storytrail*. |
| 3 | Follow model | Follow journeys **and** creators. |
| 4 | Video | Short clips in the MVP: at most 3 per entry, each up to 60 seconds. |
| 5 | Visibility | Public, Unlisted or Private. No followers-only mode until v2. |
| 6 | Money | Free at launch with no ads. Journey+ and photo books come after the beta. |
| 7 | Market | Worldwide, in English at launch. All text is ready for translation. |
| 8 | Team | You, building with Claude Code. |
| 9 | Accent colour | **Sun** (golden yellow), chosen 8 Nov 2026. Iris and Lagoon stay in the hub for comparison until all screens are reviewed. |
| 10 | Shared journeys | In the first version: up to 4 authors on one journey (9 Nov 2026). |
| 11 | Weekly digest | In the first version, by push, and by email for people who opt in (9 Nov 2026). |
| 12 | Growth during the beta | Search-friendly journey pages and hand-picked featured journeys are added while the beta runs. |
| 13 | Other engagement ideas | Story cards, polls, a creator summary, "What's next?" and challenges you can join wait for the beta's numbers. See the [engagement plan](06-engagement.md). |
| 14 | Tech stack | An Expo (React Native) app, a Java (Spring Boot) API, and PostgreSQL and sign-in on Supabase. The backend is Java so that you can debug it; it adds 2 to 3 weeks. Final on 9 Nov 2026: see the [tech page](02-tech-stack.md). |
| 15 | Build order | Local first: every feature is built and tested on one computer, with stand-ins for the outside services. The accounts are created and connected at the end. There is no rush to release (10 Nov 2026). |
| 16 | Blocking and old comments | When you block someone, the comments they left on your journeys are removed for everyone, with the replies under them. What they wrote as a friend in a journey you own stays visible to you, so that you can remove it. Decided 10 Nov 2026. |
| 17 | Small photos | Every photo gets two smaller versions (320 and 800 pixels on the long side) for lists and cards. The API makes them once, when the upload finishes, and stores them next to the original. No resizing service and no monthly cost; the work is the same with local files and with R2. Decided 10 Nov 2026. |
| 18 | Reaching the database, and the rate limit | The API uses plain SQL only (no JPA). The rate limit counts sign-in attempts in the database, shared by every copy of the API, and counts reads and ordinary changes in memory, so neither costs a database write. Left to Claude and decided 10 Nov 2026; the second review moved ordinary changes to memory. |
| 19 | Places | An entry's place comes from the phone: from the photo's location or the phone's own place search (Apple's on iPhone, Google's on Android), so no map provider account is needed. It is shown at city level unless the person chooses an exact pin. Decided 10 Nov 2026 as part of "finish the build". |
| 20 | Old comments of someone you block | Confirmed 10 Nov 2026: they are removed for everyone (row 16). |
| 21 | Small photos, and what is kept of an upload | Confirmed 10 Nov 2026 ("if it is worth it"): the API makes the smaller versions itself (row 17). It also makes the full photo afresh from what was uploaded and keeps only that: really a JPEG or PNG, the right way up, with nothing that travelled inside the file (location, camera, notes). |

Left to Claude ("think about this and decide yourself", 10 Nov 2026) and made while fixing the second review. Each can be changed; tell me which you see differently.

| # | Topic | The call |
|---|---|---|
| 22 | Private journeys' photos | Served from addresses that can't be guessed, like every photo, and listed nowhere a reader may not look. Short-lived signed links for private journeys wait until after the beta: they need a second storage path and would slow every private photo. |
| 23 | What "Private" means | The owner and the friends invited to write in it, not "only you". Someone invited sees the title, cover and authors before answering. The screens and the privacy page say so. |
| 24 | Blocking | Hides people from each other in the app. A public journey's web page stays open to anyone who isn't signed in, and the app and the privacy page say "in the app". |
| 25 | Reports | A person can have one open report about a thing and make twenty a day, and only about what they can see. One report takes a journey out of Discover, search and suggestions until a reviewer has looked; it still opens by its link. |
| 26 | Entries on a shared journey | Their author can always delete their own entry, also after leaving the journey. Changing one needs to still be on the journey. |
| 27 | Before a profile exists | Someone who has signed in but not yet confirmed their age and made a profile can read nothing. |
| 28 | Removing a person | A reviewer can remove an account that broke the guidelines. A fingerprint of the address it signed in with is kept, so the same address can't make a new profile; the address itself is not kept. |
| 29 | The weekly digest's hour | It goes out on each person's own Sunday evening (by their phone's time zone), not at one moment for the whole world. |
| 30 | New-entry notifications | They go to the people who followed the journey when the entry was posted. Someone who follows a minute later isn't told about the entry before. |
| 31 | Numbers on a category's page | "In progress" and "finished this month" are counted once an hour, so they can be up to an hour old. |
| 32 | A real build on an iPhone | Needs the paid Apple Developer Program: Apple doesn't sign Sign in with Apple and push notifications for a free Apple ID. Expo Go covers everything else. |
| 33 | Deleting an account and Apple | The API ends the account's link with Apple when it is deleted, as the App Store asks. It needs a key from the Apple Developer account and is switched off until that is set. |
| 34 | Glass on Android | A dense tint instead of a real blur, until it can be checked on a device. |
| 35 | Large text | Text grows with the phone's text size up to 1.6 times; beyond that, bars and rows made for one line stop holding their words. |
| 36 | Watching the API | Logs with an id per request, and Fly's own health checks. No error-reporting service for the API yet. |
| 37 | Java | The API is written for Java 21 and runs on Java 25 in production; the automatic checks run on both. |

Still open: the store name, needed before the beta ends (see the [roadmap](03-roadmap.md)); whether one report should be enough to take a journey out of Discover, or several from different people; whether the app should have its own switch for counting what people do; and translating the sentences that come from the API when a second language is chosen (the app's own text is ready).
