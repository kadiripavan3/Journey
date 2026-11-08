# Journey Hub

One page with everything about Journey: the screens, design system, design cues, inspiration, requirements, roadmap and tech plan. It is published at **https://claude.ai/artifact/Hmc5sAXD5cRtgof87L354X** and built from the files in this repo. The repo is the record; the page is a view of it.

## What each page is built from

| Hub page | Source |
|---|---|
| Overview | [`status.json`](status.json) (phase, next steps, open questions, updates) and §9 Decisions of [`docs/01-requirements.md`](../../docs/01-requirements.md) |
| Screens | [`src/screens.html`](src/screens.html) and the photos in [`img/`](img/) |
| Design system | [`design/tokens.json`](../tokens.json) |
| Cues | [`docs/04-design-brief.md`](../../docs/04-design-brief.md) |
| Inspiration | [`docs/05-inspiration.md`](../../docs/05-inspiration.md) and [`inspiration/`](inspiration/) |
| Requirements | [`docs/01-requirements.md`](../../docs/01-requirements.md) |
| Roadmap | [`docs/03-roadmap.md`](../../docs/03-roadmap.md) |
| Tech | [`docs/02-tech-stack.md`](../../docs/02-tech-stack.md); [`src/architecture.html`](src/architecture.html) replaces its mermaid chart |

The page shell is [`src/page.html`](src/page.html), with styles in [`src/styles.css`](src/styles.css), behaviour in [`src/app.js`](src/app.js) and icons in [`src/icons.svg`](src/icons.svg). [`build.mjs`](build.mjs) fills the shell's `{{PLACEHOLDERS}}`.

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
- Photos are from Unsplash via Lorem Picsum and are credited in the footer of `src/page.html`. The images in `inspiration/` are Airbnb's: keep the hub private, or remove them before sharing it publicly.
