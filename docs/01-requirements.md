# Journey — Product Requirements (MVP)

> **Status:** v1.1, decisions confirmed · **Updated:** 7 Nov 2026
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
| **Journey** | A story with a title, cover, category, start date, visibility and status. Owned by one creator. |
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

### E. Social

- **E1 Follow** journeys and creators.
- **E2 Like** entries (one heart).
- **E3 Comment** on entries, with one level of replies. Creators can delete comments on their own journeys.
- **E4 Home feed (Following):** new entries from journeys you follow, newest first, grouped per journey ("*Vietnam by motorbike* · 3 new entries"), ending with "You're all caught up". It is **chronological, not algorithmic**, so followers can trust they won't miss a chapter.
- **E5 Notifications** (push and an in-app inbox): a new entry in a followed journey (batched per journey), a journey completed, a new follower, comments and replies, likes (batched). Each type can be switched off.
- **E6 Share:** the phone's share sheet for a journey or an entry. Links open the app if it's installed, otherwise a **public web page** (the journey, read-only, with "Follow in the app"). Links show rich previews on WhatsApp, Instagram and X. Plus a **"Follow my journey"** link for social bios.

### F. Discovery

- **F1 Discover tab:** category chips (Travel · Fitness · Learning · Food · Creative · Projects · Life) and the sections **Trending now · New journeys · Recently completed**, personalised by the interests picked at onboarding.
- **F2 Search:** journeys (title, tags, places), people, and tags (#solotravel).
- **F3 Quality bar:** only public journeys with a cover and 3+ entries appear in Discover. Paused journeys rank lower. Reported content is hidden until reviewed.
- **F4 Simple ranking, no machine learning yet:** recent entries, follower growth, engagement, completion.

### G. Profiles

- **G1 Profile:** photo, bio, counts, a **Follow** button for the creator, and **Active** and **Completed** tabs of journeys.
- **G2 Your own profile** also shows your drafts and private journeys (only to you).

### H. Trust, safety and store rules (needed for App Store and Google Play approval)

- **H1 Report** a journey, entry, comment or user.
- **H2 Block** a user: they can't see, follow or comment on your content, and you don't see theirs.
- **H3 Automatic screening** of uploaded photos and video clips (nudity, violence) and a profanity filter on comments. Flagged items are held for review.
- **H4 Moderation queue** for the team (start with a simple internal page).
- **H5 Account deletion** in the app, plus a web page for deletion requests (Google Play requires both).
- **H6 Location privacy:** city level by default, exact pins only if you choose, GPS data stripped from photos on upload, no live location.
- **H7 Legal:** terms, privacy policy, community guidelines and contact details in the app. Users must be 13+ (16+ where local law requires). App Store privacy labels and the Google Play Data safety form.

### I. Quality bar

- **I1** iOS and Android phones from one codebase; portrait; light and dark mode; dynamic text sizes; screen-reader labels; 44 pt touch targets; AA colour contrast.
- **I2** A smooth 60 fps timeline. Photos and video stills load progressively with placeholders. Photos and clips are compressed on the phone before upload.
- **I3** Works on bad networks: retries, offline drafts, and recently viewed journeys readable offline.
- **I4** Analytics and crash reporting from day one.
- **I5** English at launch, with all text ready for translation.

## 5. Later (not in the MVP)

| When | Feature | Why later |
|---|---|---|
| **v1.1** | **Polls on entries** ("Where should I go next?"), the simple version of "choose your own adventure" | A big engagement win, but it needs an audience first |
| | **Story cards** for Instagram and TikTok with a "Follow my journey" link | A growth loop, once the core works |
| | **Creator stats** (views, followers over time) | |
| | Scheduled entries and smarter reminders | |
| **v1.2** | **Co-authors** (up to 4 people on one journey) | Permissions are complex |
| | Badges for completion and milestones: celebratory, never punishing | |
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
| Growth loop | Share-link views → installs → follows | Track and improve |

Track every metric separately for travel journeys and challenge journeys. The beta decides which audience to double down on.

## 9. Decisions

Confirmed with you on 7 Nov 2026:

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

Still open: the store name, needed before the beta ends (see the [roadmap](03-roadmap.md)).
