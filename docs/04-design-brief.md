# Journey — Design Principles and Cues

> **Status:** Design 2.1, 66 screens · **Updated:** 9 Nov 2026
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
| Type | Plus Jakarta Sans only. Titles in ExtraBold (800) with tight letter-spacing; body text in Medium (500). Every size is one of the 24 styles in the [type scale](#type-scale); nothing is sized by hand. |
| Colour | Neutral surfaces with a faint cool tint. The accent only for primary actions, progress and milestones. Pink-red only for likes. |
| Glass | The tab bar, the Follow bar, and the buttons and labels over photos use frosted glass. The one bar, sheet or button a screen has on a photo is blurred (16–24 px). Labels that repeat down a list ("3 new", "1 / 4") are tinted, not blurred: it looks the same at that size and keeps lists smooth. On Android the glass is a denser tint instead of a blur: a real blur there needs each bar wired to what lies behind it, which the app doesn't do yet. |
| Shape | Corners come in eleven steps (chip 8 · tile 12 · thumb 14 · field 16 · photo 18 · card 20 · cardLarge 22 · panel 24 · stage 28 · sheet 30 · pill full). Cards 20–22 px, panels 24 px, sheets 30 px. Buttons, chips, pills, avatars and thin bars are fully round. |
| Icons | 24 px line icons with 2 px rounded strokes. Categories, interests, templates and empty states use 3D icons: Microsoft's Fluent Emoji (free, MIT licence) for now. Custom art can replace them file by file in `design/hub/icons3d`. |
| Motion | Small and quick, never in the way. Things you press shrink a touch and spring back. A like makes the heart pop. Progress rings fill. Lists arrive one item after another, rising a little. The only thing that repeats is the soft breathing of the grey shapes while something loads. Nothing moves when the phone's Reduce Motion is on. The numbers are in the tokens. |
| Depth | Soft shadows in light mode. Hairline borders instead of shadows in dark mode. |
| Space | Content starts 22 px from the edge, full-width rows 20 px, bars and sideways rails 16 px. A section's title has 24 px above it. See [Spacing](#spacing). |

## Type scale

Every piece of text in the app is one of these styles. They live in `design/tokens.json` (`type`); the hub shows them, and in the app each is a `Txt` variant. A style sets the size, line height, weight and letter spacing together. The weight can be changed where a design calls for it (`<Txt variant="caption" weight={700}>`); the size and line height cannot.

| Style | In the app | Size / line | Weight | Used for |
|---|---|---|---|---|
| Hero | `hero` | 41 / 42 | 800 | The one line on the welcome screen |
| Display large | `displayLarge` | 36 / 38 | 800 | The big number on a full-photo screen |
| Display | `display` | 34 / 36 | 800 | A big number or initials |
| Heading | `heading` | 31 / 35 | 800 | The title at the top of a screen |
| Title large | `titleLarge` | 27 / 30 | 800 | A journey's or a person's name on their own page |
| Title | `title` | 23 / 27 | 800 | An entry's title when it is open |
| Title small | `titleSmall` | 20 / 25 | 800 | Titles of sheets, sections and empty states |
| Subtitle | `subtitle` | 19 / 24 | 800 | The headline of a card or a group |
| Subheading | `subheading` | 17 / 22 | 800 | Bar titles and titles in a list of entries |
| Headline | `headline` | 16 / 21 | 700 | The title of a row or a small card |
| Body large | `bodyLarge` | 16 / 24 | 500 | Text being read or typed on its own |
| Lead | `lead` | 15.5 / 23 | 500 | The sentence under a screen's title |
| Body | `body` | 15 / 22 | 500 | Ordinary text |
| Item | `item` | 15 / 20 | 700 | Labels of rows, links and names |
| Body small | `bodySmall` | 14.5 / 22 | 500 | Longer text in a tight place |
| Control | `control` | 14.5 / 20 | 700 | Chips, small buttons and card titles |
| Callout | `callout` | 14 / 20 | 500 | A sentence that explains a choice |
| Note | `note` | 13.5 / 19 | 500 | The start of an entry under its title |
| Caption | `caption` | 13 / 18 | 600 | A line of detail under a title |
| Footnote | `footnote` | 12.5 / 17 | 500 | Detail under a row's label |
| Small | `small` | 12 / 16 | 600 | Pills, tab labels and timestamps |
| Tiny | `tiny` | 11.5 / 14 | 700 | Numbers in a grid and fine print |
| Label | `label` | 11.5 / 14 | 800, capitals | The small capital line above a title |
| Micro | `micro` | 10.5 / 13 | 800 | Tab bar labels and tiny badges |

When a design needs a size that isn't here, add a style to the tokens (with what it is for) rather than a number in a screen.

## Spacing

- **Gutters come from the tokens** (`layout`): `gutter` 22 for text and cards, `rowGutter` 20 for full-width rows and section titles, `barGutter` 16 for bars and sideways rails. A screen's content never sits at another distance from the edge.
- **A section's title has `section` (24) above it.** `SectionHeader` does this by itself.
- **Gaps inside a component are plain numbers on a 2-point grid** (4, 6, 8, 10, 12, 14, 16 …): the space between an icon and its label, a card's padding, the gap between two lines. They belong to the component, not to the page, so they are not tokens. The `space` scale in the tokens is the set to pick from when in doubt.
- A few odd values (9, 11, 13) are left from matching the first designs pixel for pixel. Don't add new ones.

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
- Touch targets are at least 44 pt. Where a control is drawn smaller (a 36 pt button, a 24 pt remove cross), the area that takes the touch is still 44 pt.
- Dynamic text sizes and screen readers are supported; status is never shown by colour alone (pills always carry a label). Text follows the phone's text size up to 1.6 times; bars and rows grow with it instead of cutting it off.
- Reduced motion is respected.

## Screens

66 screens in 13 groups, all designed in light and dark. They live in the hub's Screens page, one file per group in `design/hub/src/screens/`. The numbers match the hub.

| # | Group | Screens |
|---|---|---|
| 1 | Login | Welcome · How it works · Log in or sign up · Email · Email code |
| 2 | Registration | Create your profile · Interests · Journeys to follow · Notifications · All set |
| 3 | Feed | Home · Following feed · All caught up · Home, before following |
| 4 | Discover and search | Discover · Search · Search results · Category |
| 5 | Story line | Journey · Story line · Jump to · Map · Challenge · Paused journey · Complete a journey · Recap |
| 6 | Posts | Entry · Video clip · Photo viewer · Comments · Entry options · Share |
| 7 | Create | The + button · New entry · Pick photos and clips · Choose a template · Journey details · Who can see it · Journey is live · Drafts and uploads |
| 8 | Shared journeys | Add people · Invitation · Shared journey · Shared story line · On both profiles · People on this journey |
| 9 | Activity | Activity · Push notifications · Weekly digest |
| 10 | Profile | Your profile · Creator profile · Edit profile · Followers |
| 11 | Settings | Settings · Notification settings · Privacy and safety · Appearance · Account · Delete account · Blocked accounts |
| 12 | Safety | Report · Block · Held for review |
| 13 | States | Loading · Offline · Something went wrong |

The people in the screens are made up. Nora Lind is the person using the app from sign-up onwards; Maya, Lea, Kai, Ana and the others are creators she follows. Alex Strand is the friend who joins her Iceland journey.

## Open design questions

1. Accent colour: Sun is chosen. Final check once you've reviewed all the screens.
2. 3D icons: Fluent Emoji are in for now (10 Nov 2026). Keep them, or commission custom ones?
3. Real photos for the store listing and marketing. The current ones are Unsplash stand-ins.
4. Still to design, when we build them during the beta: the "Journey of the week" and themed collections in Discover.

## History

- **v1, 7 Nov 2026:** a warm paper look with serif titles and drawn illustrations, built in Figma ([archive](https://www.figma.com/design/ilasSskZONkRkg8FL7JqLl)). Replaced by Design 2.0 after review; the Figma file is no longer updated.
- **Design 2.0, 7 Nov 2026:** real photos, bold sans-serif type, glass controls, light and dark, three accent options.
- **Design 2.1, 8 Nov 2026:** Sun chosen as the accent; the eight key screens grew to 59 end-to-end screens in 12 groups, built from one set of shared components.
- **9 Nov 2026:** shared journeys (six screens) and the weekly digest added, after the decisions in the [engagement plan](06-engagement.md).
- **10 Nov 2026:** the type scale grew from six named styles to the 24 the screens use, corners to eleven steps, and gutters became tokens, so the app takes every size from `design/tokens.json`.
