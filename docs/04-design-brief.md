# Journey — Design Principles and Cues

> **Status:** Design 2.1, 59 screens · **Updated:** 8 Nov 2026
>
> The design source of truth is the **Journey Hub** (`design/hub`): the screens, the design system and these cues. Every colour, font size and corner radius lives in `design/tokens.json`, which the hub and the app both read. We don't use Figma.

## Direction

Real photography, bold Plus Jakarta Sans, glass controls that float over the content, and light and dark themes designed together. The layouts borrow the clean, friendly feel of Airbnb (see [Inspiration](05-inspiration.md)). One accent colour carries the brand: **Sun** (golden yellow), chosen on 8 Nov 2026. Iris (violet-blue) and Lagoon (mint-teal) stay in the hub for comparison until all screens are reviewed.

## Principles

1. **Photos lead.** Real photos and clips, edge to edge. The interface stays quiet so the story shows.
2. **Time is the spine.** Day labels, progress rings and the route line always show where a journey is.
3. **One clear next step.** Each screen has one primary action in the accent colour: Follow, Post, Get started.
4. **Calm, not addictive.** No autoplay, no streaks to lose, no red badges everywhere, and a clear "You're all caught up".
5. **Friendly and plain.** Short words people already use. No jargon, no blame.

## Visual cues

| Cue | Rule |
|---|---|
| Photos | Full-bleed covers. 20 px rounded corners inside cards. A dark gradient under any text that sits on a photo. |
| Type | Plus Jakarta Sans only. Titles in ExtraBold (800) with tight letter-spacing; body text in Medium (500). |
| Colour | Neutral surfaces with a faint cool tint. The accent only for primary actions, progress and milestones. Pink-red only for likes. |
| Glass | The tab bar, the Follow bar and buttons over photos use frosted glass (16–24 px blur). |
| Shape | Cards 20 px, panels 24 px, sheets 30 px. Buttons, chips and pills fully round. |
| Icons | 24 px line icons with 2 px rounded strokes. Category tabs use 3D-style icons (emoji for now). |
| Depth | Soft shadows in light mode. Hairline borders instead of shadows in dark mode. |

## Interaction cues

- Video clips never autoplay: tap to play, swipe to the next part of the story.
- Entries open as cards you swipe through, with the next one peeking in from the side.
- The tab bar floats above the content, and the content scrolls underneath it.
- The **+** button always creates: a new entry first, a new journey second.
- Posting late or offline just works. Show what is waiting to upload, never an error.
- A missed day in a challenge is a gap in the grid, never a lost streak.
- Every screen ends somewhere: "You're all caught up", not an endless feed.

## Writing cues

| Do | Don't |
|---|---|
| Post today's check-in | Submit |
| Follow journey | Subscribe to updates |
| You're offline. This entry is saved and will post when you're back. | Network error 503 |
| You're all caught up | No more items |
| Day 14 · Hoi An | 14/03/2026 14:32 · Hội An Province |
| 46 people cheering you on | 46 followers engaged |

## Accessibility

- Text contrast is at least 4.5:1, checked in both themes and with all three accents.
- Touch targets are at least 44 pt.
- Dynamic text sizes and screen readers are supported; status is never shown by colour alone (pills always carry a label).
- Reduced motion is respected.

## Screens

59 screens in 12 groups, all designed in light and dark. They live in the hub's Screens page, one file per group in `design/hub/src/screens/`. The numbers match the hub.

| # | Group | Screens |
|---|---|---|
| 1 | Login | Welcome · How it works · Log in or sign up · Email · Email code |
| 2 | Registration | Create your profile · Interests · Journeys to follow · Notifications · All set |
| 3 | Feed | Home · Following feed · All caught up · Home, before following |
| 4 | Discover and search | Discover · Search · Search results · Category |
| 5 | Story line | Journey · Story line · Jump to · Map · Challenge · Paused journey · Complete a journey · Recap |
| 6 | Posts | Entry · Video clip · Photo viewer · Comments · Entry options · Share |
| 7 | Create | The + button · New entry · Pick photos and clips · Choose a template · Journey details · Who can see it · Journey is live · Drafts and uploads |
| 8 | Activity | Activity · Push notifications |
| 9 | Profile | Your profile · Creator profile · Edit profile · Followers |
| 10 | Settings | Settings · Notification settings · Privacy and safety · Appearance · Account · Delete account · Blocked accounts |
| 11 | Safety | Report · Block · Held for review |
| 12 | States | Loading · Offline · Something went wrong |

The people in the screens are made up. Nora Lind is the person using the app from sign-up onwards; Maya, Lea, Kai, Ana and the others are creators she follows.

## Open design questions

1. Accent colour: Sun is chosen. Final check once you've reviewed all the screens.
2. Custom 3D category icons, or keep emoji.
3. Real photos for the store listing and marketing. The current ones are Unsplash stand-ins.

## History

- **v1, 7 Nov 2026:** a warm paper look with serif titles and drawn illustrations, built in Figma ([archive](https://www.figma.com/design/ilasSskZONkRkg8FL7JqLl)). Replaced by Design 2.0 after review; the Figma file is no longer updated.
- **Design 2.0, 7 Nov 2026:** real photos, bold sans-serif type, glass controls, light and dark, three accent options.
- **Design 2.1, 8 Nov 2026:** Sun chosen as the accent; the eight key screens grew to 59 end-to-end screens in 12 groups, built from one set of shared components.
