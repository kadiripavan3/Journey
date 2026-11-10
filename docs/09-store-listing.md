# Store listing and privacy forms

Drafts for the App Store and Google Play pages, and the answers to their privacy forms. The answers come from what the app and the API actually do; check them again before you submit, because both stores hold you to them.

> **Status:** 10 Nov 2026. Drafts. The name is still open ("Journey" is taken in both stores), and the screenshots are taken once the look is final.

## The listing

| Field | Draft | Limit |
|---|---|---|
| Name | *(to choose: "Journey" is taken)* | 30 characters |
| Subtitle (App Store) | Stories told day by day | 30 characters |
| Promotional text (App Store) | Follow the journey, not just the moment. | 170 characters |
| Short description (Google Play) | Share a trip, a challenge or a build as a story people follow day by day. | 80 characters |
| Category | Social Networking (second: Travel) | |
| Age rating | 12+ on the App Store (people post their own content, with reporting and blocking), Teen on Google Play. The app asks everyone to confirm they are 13 or older. | |

**Description**

> Every post on Journey is part of a story.
>
> Start a journey: a trip, a 30-day challenge, something you're learning or building. Add an entry whenever something happens: a few photos, a short clip, a few words, the place. Your followers get each new chapter in order and can read the whole story from day one at any time.
>
> **Follow journeys, not feeds.** Home shows what's new in the journeys you follow, in the order it happened, and ends with "You're all caught up". When you want something new, Discover shows what's trending this week.
>
> **Made for trips and challenges.** A map of where you've been. "Day 12 of 30" with a ring that fills. A recap card when you finish.
>
> **Share a journey with friends.** Invite up to three friends to write in the same story.
>
> **Works without a signal.** Write on the road; entries upload when you're back online.
>
> **You choose who sees it.** Public, by link only, or private. Places are shown at city level unless you choose the exact spot. Report and block are one tap away, and you can delete your account in the app.

**Keywords (App Store, 100 characters):** `travel journal,trip diary,30 day challenge,photo story,follow,road trip,habit,progress,map`

**What to show in the screenshots** (in this order): Home with new entries, a journey page, the story line, an entry with a photo, the map, the challenge ring, Discover.

**Notes for the reviewer:** a test account they can sign in with (an email whose code you can read), that user content can be reported and blocked from the ••• menu on every journey, entry, comment and profile, that reports are reviewed by a person, and where account deletion is (Settings, Account, Delete account).

## What the stores require, and where it is

| Requirement | Where it is |
|---|---|
| Sign in with Apple offered next to Google (App Store 4.8) | The first button on the sign-in screen |
| Deleting an account also ends its link with Apple (App Store 5.1.1) | The API revokes the person's Apple token when the account is deleted, once the Apple key is set ([step 5](08-connect-services.md#5-apple-and-google-sign-in)) |
| Report and block for user content, and a way to act on reports (App Store 1.2) | The ••• menus; the reviewer's pages in the API |
| Delete the account in the app (both stores) | Settings, Account |
| A web page to ask for deletion (Google Play) | The API's deletion-request page (its address goes into the Play listing) |
| Privacy policy, terms, guidelines, contact | Web pages served by the API, linked from Settings. They are drafts until a lawyer has read them. |
| Why the app asks for photos, location and notifications | The permission sentences in `app.json`; each is asked for when it is first needed, never at launch |

## Privacy answers

What Journey collects, why, and whether it is tied to the person. Nothing is used to track people across other companies' apps or sites, and nothing is sold.

| Data | Collected | Why | Tied to the person |
|---|---|---|---|
| Email address | Yes | Signing in; the weekly digest by email if switched on | Yes |
| Name and username | Yes | The profile | Yes |
| Photos and video | Yes, only what the person chooses to post or use as a profile picture | The app's purpose | Yes |
| Other content: entries, comments, likes, follows | Yes | The app's purpose | Yes |
| Location | Only the place a person adds to an entry: city level by default, the exact spot only if they choose it. Location data inside a photo is removed on the phone, and the API keeps only a fresh copy of the picture with nothing else from the file. A clip is sent to the video service as the phone recorded it; people who watch get the converted clip, not that file. No live location, nothing in the background. | Showing where an entry happened; the map | Yes |
| Device push token | Yes, if notifications are allowed | Sending notifications | Yes |
| Usage data (which screens and actions) | Only when analytics is switched on in the build | Understanding what works. No names, emails or content are sent. | By an id, not by name |
| Crash reports | Only when crash reporting is switched on in the build | Fixing crashes | No |
| Contacts, health, finances, browsing history, advertising id | No | | |

**App Store privacy label:** "Data Linked to You": Contact Info (email, name), User Content (photos or videos, other user content), Location (coarse; precise only if the person chooses an exact pin), Identifiers (user id, device id for notifications), Usage Data (product interaction, if analytics is on). "Data Not Linked to You": Diagnostics (crash data, if crash reporting is on). "Data Used to Track You": none.

**Google Play Data safety:** the same data types; all collected, none shared with other companies except the services that process it for Journey (hosting, storage, video, email, notifications, moderation); data is encrypted in transit; people can ask for deletion in the app and on the web page.

**Photo screening:** photos, and still frames of clips, are checked automatically for nudity and violence when they are uploaded, by a service that processes them for Journey. That service keeps nothing only if its "use my content to improve the service" setting is switched off for the account ([step 9](08-connect-services.md#9-aws-rekognition-the-automatic-photo-check)); do that before saying so in the privacy policy.

## Before submitting

- Choose the name and check it in both stores and as a trademark.
- Have the terms and the privacy policy read by a lawyer, and replace the drafts.
- Set the app's own identifier in `app.json` (it can't change after the first store build).
- Take the screenshots from a production build, in light and in dark.
- Fill in the two privacy forms from the table above, after checking it against the build you submit.
