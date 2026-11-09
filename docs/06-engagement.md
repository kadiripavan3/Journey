# Journey — Engagement and Growth

> **Status:** decided on 9 Nov 2026. Shared journeys and the weekly digest are in the first version; the [decisions](#decisions) are at the end.

## The short answer

Journey won't hold people in the app all day the way a video feed does, and it shouldn't try. We chose no endless feed, no autoplay and no streak guilt ([requirements §6](01-requirements.md#6-what-journey-should-not-have)), because people trust an app that respects their time.

What Journey can do is give people a reason to come back **every time a story moves on**, for months. A healthy picture: followers open it a few times a week because something new happened, and creators post a few times a week because someone answers.

Both **traffic** (new people arriving) and **engagement** (people coming back) start with creators. A journey that keeps getting entries is what followers return for. A creator sharing their link is what brings new people in.

## The three loops

| Loop | How it turns | What makes it stronger |
|---|---|---|
| **Creators keep posting** | Post an entry → people react → the creator feels heard → posts again | Posting in seconds, offline drafts, gentle reminders, seeing who follows along, milestones |
| **Followers come back** | New entry → one notification → read → like or comment → wait for the next one | Grouped notifications, "3 new since your last visit", Continue reading, a weekly digest |
| **New people arrive** | A creator shares the link → friends read it on the web → install → follow → some start their own journey | Share pages, the "Follow my journey" link, recap cards, shared journeys, search engines |

If one loop is weak, the others stall. Followers have nothing to return to without entries, and creators stop posting without followers.

## Already in the first version

- **For creators:** two-tap posting, templates with prompts, offline drafts, opt-in reminders, milestones, a recap card when a journey completes.
- **For followers:** grouped push notifications, the chronological Home feed, "new since your last visit" markers, Continue where you left off, likes and comments.
- **For growth:** share links with a web page for people without the app, rich link previews, the "Follow my journey" link for social bios, journeys to follow during sign-up.

## What we add, and when

Effort is my estimate for building with Claude Code, on the same basis as the roadmap.

| # | Idea | What it does | Helps | Effort | When |
|---|---|---|---|---|---|
| 1 | **Shared journeys** | Friends add to one journey together ([details below](#shared-journeys-how-it-works)) | Traffic and engagement | 1–1.5 weeks | First version |
| 2 | **Weekly digest** | One message a week, "This week in the journeys you follow", by push, and by email for people who opt in. It reaches people who stopped opening the app. | Engagement | 3 days | First version |
| 3 | **Journey pages that search engines can find** | Public journeys show up for searches like "Ha Giang loop by motorbike". Slow to start, then steady. | Traffic | 2–3 days | During the beta |
| 4 | **Featured journeys** | A "Journey of the week" and small themed collections in Discover, picked by hand. Gives creators something to aim for. | Engagement | 2 days | During the beta |
| 5 | **Story cards** | An entry or milestone as a ready-made image for Instagram, TikTok or WhatsApp, with the follow link on it | Traffic | 4–5 days | First update |
| 6 | **Polls and questions** | "Where should I go next?" Followers vote and shape the story. | Engagement | 1 week | First update |
| 7 | **Creator summary** | Once a week: readers, new followers, the entry people loved most | Creators keep posting | 3 days | First update |
| 8 | **"What's next?"** | Finishing a journey offers the creator a next one and offers readers similar journeys | Engagement | 2 days | First update |
| 9 | **Challenges you can join** | Many people do the same 30-day challenge at once, each on their own journey, with a shared page showing everyone's day. A new round starts each month. | Traffic and engagement | 2–3 weeks | After the beta |

**Why only two go into the first version:** every addition delays the launch, and the roadmap's rule is that the beta's numbers choose what comes next. Shared journeys and the digest are the two that pay back from day one. Ideas 3 and 4 can be added while the beta runs, with no delay. Ideas 5 to 9 wait until the beta shows which audience, travelers or challenge-takers, is the stronger one.

## What I would not add

| Not this | Why |
|---|---|
| An endless or algorithmic feed, or autoplay video | It raises time in the app for a while and costs the trust the product is built on. |
| Streaks you can lose, or "you're falling behind" messages | Guilt makes people quit challenges. A missed day stays a gap. |
| Notification tricks (fake urgency, "someone looked at your profile") | People switch notifications off, and then the real ones don't arrive either. |
| Follower leaderboards | They reward the few and discourage everyone else. |
| Paying for adverts before people stay | Bought traffic leaves again if the loops above don't hold it. Fix retention in the beta first. |

## Shared journeys: how it works

One person starts a journey and invites friends to add to it. The screens are in the hub's Screens page, in the group *Shared journeys*.

- **Inviting:** the owner invites up to 3 friends, so a journey has at most 4 authors. They pick someone they know in the app or send a one-time link. A friend without the app installs it from the link and lands on the invitation.
- **Joining:** nobody is added without saying yes. The invitation says what joining means and who can see the journey.
- **What friends can do:** add entries, and edit or delete their own.
- **What only the owner can do:** change the title, cover and who can see the journey, complete it, and remove people or entries.
- **Profiles:** the journey sits on every author's profile with a **Shared** label and everyone's faces.
- **Story line:** all entries flow into one timeline in the order things happened. Each entry shows who posted it, and readers can filter by person.
- **Following:** one Follow brings everyone's entries. People who already follow one of the authors get the journey in their feed, as with any new journey from someone they follow.
- **Leaving:** a friend can leave at any time. Their entries stay in the story unless they delete them.
- **Safety:** only people you follow can invite you in the app, a blocked person never can, and reports work on shared entries as on any other.

**Why it helps:** each invitation can bring a new person into the app, and each friend who joins brings their own followers to the journey. Trips are rarely made alone, so it also fits how people travel.

**Not in the first version of sharing:** separate progress for each person in a shared 30-day challenge (that comes with idea 9), approving a friend's entry before it shows, and more than 4 authors.

**Building it:** every entry already records its author, so the data model was made for this. It needs one new table for a journey's members, a few new rules in the API, and the six screens. It is built with the Create and Follow milestones.

## How we'll know it works

The beta measures the loops, on top of the [success metrics](01-requirements.md#8-success-metrics):

| Loop | Number to watch |
|---|---|
| Creators keep posting | Creators who post 3 or more entries in their first 14 days |
| Followers come back | New-entry notifications that get opened; people active again after 7 and 30 days |
| New people arrive | Share-link views → installs → follows; invitations sent → accepted |

## Decisions

Decided with you on 9 Nov 2026 and recorded in the [requirements](01-requirements.md#9-decisions):

| # | Decision | Answer |
|---|---|---|
| 1 | Shared journeys in the first version? It adds 1 to 1.5 weeks. | Yes |
| 2 | Weekly digest in the first version? It adds about 3 days. | Yes |
| 3 | Search-friendly journey pages and featured journeys during the beta? No delay. | Yes |
| 4 | Ideas 5 to 9 wait for the beta's numbers? | Yes |

With these two, the first version grew from 13–15 weeks to 15–17. The Java backend, decided the same day, makes it about 17 to 20 ([tech page](02-tech-stack.md#the-backend-decision-java)).
