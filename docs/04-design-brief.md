# Journey — Design Brief (Figma)

> **Figma file:** link added once the file is created.
>
> Built from the [requirements](01-requirements.md). The Figma file follows this brief, so change the brief first.

## Principles

1. **Story first:** big photos, editorial titles, generous space. It should feel like a beautiful travel journal, not a dashboard.
2. **Time is the spine:** the timeline line, its dots and the **DAY 5** labels are the signature element everywhere.
3. **Posting is effortless:** **+** is always one tap away, and an entry fits on one screen.
4. **Calm, not addictive:** few badges, no autoplay, and a clear "You're all caught up" ending.
5. **Accessible by default:** AA contrast, 44 pt touch targets, dynamic type, and status never shown by colour alone.

## Foundations

### Colour (semantic tokens, light and dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | #FAF7F2 | #15120F | App background ("paper") |
| `surface` | #FFFFFF | #201C18 | Cards, sheets |
| `surface-sunken` | #F2EDE6 | #2A2520 | Inputs, chips, image placeholders |
| `border` | #E6DFD6 | #3A332C | Dividers, outlines |
| `text` | #1F1B16 | #F3EEE7 | Primary text |
| `text-muted` | #6B6259 | #B3A99E | Secondary text |
| `accent` | #C9461F | #F07A52 | Primary buttons, active tab, timeline dots |
| `on-accent` | #FFFFFF | #15120F | Text and icons on `accent` |
| `accent-soft` | #FBE9E1 | #3A2219 | Tinted backgrounds |
| `accent-text` | #A93A18 | #F07A52 | Accent-coloured text and links |
| `route` | #1F6F6B | #5FBDB5 | Map routes, place labels |
| `route-soft` | #E0F0EE | #17302E | Map and place backgrounds |
| `status-active` / `-soft` | #276B43 / #E3F2E8 | #6FCF97 / #173326 | Active pill |
| `status-paused` / `-soft` | #855900 / #FBF0D9 | #E8B04B / #3A2D12 | Paused pill |
| `status-completed` / `-soft` | #3D4DB7 / #E6E9FA | #9AA6F5 / #232845 | Completed pill |

Text pairs meet WCAG AA (at least 4.5:1). For example: white on `accent` is 4.8:1, `text-muted` on `bg` is 5.6:1, and each status colour on its soft background is at least 5.4:1.

### Type

| Style | Font | Size / line height | Use |
|---|---|---|---|
| Display | Fraunces SemiBold | 32 / 38 | Journey title on the cover |
| Title 1 | Fraunces SemiBold | 26 / 32 | Screen titles |
| Title 2 | Fraunces SemiBold | 20 / 26 | Card titles |
| Headline | Inter SemiBold | 17 / 22 | Section headers, names |
| Body | Inter Regular | 16 / 24 | Entry text |
| Callout | Inter Regular | 15 / 20 | Secondary text |
| Caption | Inter Medium | 13 / 18 | Details (place · time) |
| Label | Inter SemiBold, capitals, +0.6 spacing | 12 / 16 | DAY 5, section labels |

Fraunces (a warm editorial serif) for story titles, Inter for everything else. Both are free Google Fonts.

### Space, shape, icons

- A 4-point spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48. Screen side margin: 16.
- Corner radius: 8 for chips and inputs, 14 for cards, 20 for photos inside cards, 28 for sheets, fully round for avatars and pills.
- Line icons at 24 px with a 2 px rounded stroke.
- Photos: full-bleed covers with a dark gradient at the bottom so titles stay readable.

## Layout

- Base frame **393 × 852** (iPhone 15/16). Check layouts at 360 × 800 (a common Android size).
- Safe areas: 54 pt at the top (status bar) and 34 pt at the bottom (home indicator).
- **Tab bar:** Home · Discover · **+** · Activity · Profile.
- Platform differences (back gesture, share sheet, date picker) are handled in code, not with separate designs.

## Screens (MVP)

| # | Screen | Shows |
|---|---|---|
| 1 | Welcome | Photo collage, tagline, Get started and Sign in |
| 2 | Pick interests | Category chips, Continue |
| 3 | Home (Following) | Your active journeys (quick add), new entries grouped by journey, "You're all caught up" |
| 4 | Discover | Search, category chips, Trending now, New journeys, Recently completed |
| 5 | Journey page | Cover, title, creator, status, counts, Follow, Highlights, timeline with DAY labels |
| 6 | Entry | Photos, text, place, likes, comments |
| 7 | Map | Numbered pins joined in order, entry cards |
| 8 | New journey: template | Trip · 30-Day Challenge · Learn a Skill · Build Something · Open Journal |
| 9 | New journey: details | Title, cover, category, start date, visibility |
| 10 | Add entry | Photos, text, date, place, milestone toggle, journey picker, offline state |
| 11 | Profile | Header, Follow, Active and Completed tabs |
| 12 | Activity | Notifications grouped by today and earlier |
| 13 | Journey completed | Celebration, recap card, Share |
| 14 | Home in dark mode | The same screen with the dark tokens |

## Components

Button (primary, secondary, ghost; large and medium) · Chip (default, selected) · Status pill (active, paused, completed) · Avatar · Day label · Timeline node (default, milestone) · Journey card (feature, compact) · Tab bar · Top bar · Text field · Toast and banner · List row

## Sample content

Fictional, and consistent across screens:

- **Vietnam by motorbike** by @maya.rides · Travel · Active · Day 14 · 23 entries · 1.2k followers
- **30 days of guitar** by @leo.strums · Learning · Active · Day 12 of 30
- **Camino de Santiago** by @ana.walks · Travel · Completed · 34 days
- **Couch to 10K** by @sam.runs · Fitness · Active · Week 5
- **Building our tiny cabin** by @the.kims · Projects · Paused
