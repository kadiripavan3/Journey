# Journey Hub

One page with everything about Journey: the screens, design system, design cues, inspiration, requirements, engagement plan, roadmap and tech plan. It is published at **https://claude.ai/artifact/Hmc5sAXD5cRtgof87L354X** and built from the files in this repo. The repo is the record; the page is a view of it.

## What each page is built from

| Hub page | Source |
|---|---|
| Overview | [`status.json`](status.json) (phase, next steps, open questions, updates) and §9 Decisions of [`docs/01-requirements.md`](../../docs/01-requirements.md) |
| Screens | [`src/screens/`](src/screens/): one file per group, in the order of [`src/screens/index.json`](src/screens/index.json); styles in [`src/phone.css`](src/phone.css); photos in [`img/`](img/); 3D icons in [`icons3d/`](icons3d/) |
| Design system | [`design/tokens.json`](../tokens.json) |
| Cues | [`docs/04-design-brief.md`](../../docs/04-design-brief.md) |
| Inspiration | [`docs/05-inspiration.md`](../../docs/05-inspiration.md) and [`inspiration/`](inspiration/) |
| Requirements | [`docs/01-requirements.md`](../../docs/01-requirements.md) |
| Engagement | [`docs/06-engagement.md`](../../docs/06-engagement.md) |
| Roadmap | [`docs/03-roadmap.md`](../../docs/03-roadmap.md) |
| Tech | [`docs/02-tech-stack.md`](../../docs/02-tech-stack.md); [`src/architecture.html`](src/architecture.html) replaces its mermaid chart |
| Run it | [`docs/07-run-locally.md`](../../docs/07-run-locally.md) |
| Go live | [`docs/08-connect-services.md`](../../docs/08-connect-services.md) |

The page shell is [`src/page.html`](src/page.html), with the hub's styles in [`src/styles.css`](src/styles.css), the phone screens' styles in [`src/phone.css`](src/phone.css), behaviour in [`src/app.js`](src/app.js) and icons in [`src/icons.svg`](src/icons.svg). [`build.mjs`](build.mjs) fills the shell's `{{PLACEHOLDERS}}`.

## Writing a screen

Each group file holds `<screen>` blocks. The build adds the phone frame, the camera island, the home indicator, the number (group.position, like 5.2) and the caption with its Comment button.

```html
<screen id="sign-in" title="Log in or sign up" note="The caption under the phone." [theme="dark"] [home="photo"] [class="s-signin"] [label="Screen-reader description"]>
  <sb>                         status bar (<sb photo> for white text on a photo)
  [[route]] [[star f]]         an icon from src/icons.svg, with extra classes after the name
  <kb> <kb email> <kb num>     the phone's keyboard
  <tabbar active="home" dot>   the tab bar: home, discover, activity or you; dot marks Activity
  ...the screen's own HTML, using the shared components in src/phone.css...
</screen>
```

Rules the build checks: ids are unique and use lowercase letters, digits and hyphens; every icon exists; nothing sits outside a `<screen>` block. While a new group is half written, `HUB_ALLOW_MISSING=1 node design/hub/build.mjs` skips group files that don't exist yet.

Class names in `phone.css` and `styles.css` share one page, so a new class must not reuse a name the other file already has (`.q`, `.next`, `.new` and `.m` have each broken a screen before). Add new components to the shared section of `phone.css`, and anything for one screen under its group's heading.

## Build

```sh
npm ci --prefix design/hub
npm run build --prefix design/hub      # writes design/hub/index.html (not committed)
node design/hub/build.mjs --files      # lists the images to publish with the page
```

The build stops on a placeholder it doesn't know and on an image that doesn't exist.

## Publish

Claude publishes `design/hub/index.html` with the Artifact tool to the same URL, with `root` set to `design/hub`, `files` set to the `--files` list, and `capabilities` set to `{"comments": {"composer_only": true}}`. That capability makes the Comment buttons open claude.ai's own comment box; Claude reads the comments at the start of each session.

## Rules

- Change the sources, never the built page.
- Colours, type and shapes live only in `design/tokens.json`.
- Links between views are plain `#names` (letters, digits, hyphens). claude.ai reserves `settings`, `sidebar`, `customize`, `upgrade`, `downloads` and `comment-*`.
- 3D icons live in `icons3d/`, one WebP per emoji, named by its code points (`2708-fe0f.webp` is ✈️). The build draws them wherever a screen has `<span class="em">` or `<span class="blob">` with that emoji. They are Microsoft's Fluent Emoji (MIT licence), taken from the `@lobehub/fluent-emoji-3d` package. After adding one, run `npm run icons` in `apps/mobile` so the app has it too, and publish the new file with the page.
- Photos are from Unsplash via Lorem Picsum and are credited in the footer of `src/page.html`. The images in `inspiration/` are Airbnb's: keep the hub private, or remove them before sharing it publicly.
