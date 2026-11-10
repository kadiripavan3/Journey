# Journey

**A social app where every post is part of a story.** People start a journey (a trip, a 30-day challenge, a build), add entries to it over time, and others follow along for the next chapter.

iOS and Android · Expo (React Native) app, Spring Boot (Java) API, PostgreSQL · Status: **Phase 1: building. Most of the app works locally; see [what works today](docs/07-run-locally.md#what-works-today)**

## Run it

`./scripts/dev.sh` starts the database, the Java API and the app on your computer. Sign in with any email and the code 123456. The setup steps for a Mac and an iPhone are in [docs/07-run-locally.md](docs/07-run-locally.md).

## Start here

**[Journey Hub](https://claude.ai/artifact/Hmc5sAXD5cRtgof87L354X)** is one page with everything: the screens, design system, design cues, inspiration, requirements, engagement plan, roadmap and tech plan. It is built from the files below, so the repo is the source of truth. See [design/hub/README.md](design/hub/README.md) for how it is rebuilt.

| File | What's in it |
|---|---|
| [docs/01-requirements.md](docs/01-requirements.md) | What we build, what we don't, and the decisions made |
| [docs/02-tech-stack.md](docs/02-tech-stack.md) | The final stack and why, architecture, data model, testing, accounts, costs |
| [docs/03-roadmap.md](docs/03-roadmap.md) | Phases, beta and launch plan, monetization |
| [docs/04-design-brief.md](docs/04-design-brief.md) | Design principles and cues |
| [docs/05-inspiration.md](docs/05-inspiration.md) | References and what we take from each |
| [docs/06-engagement.md](docs/06-engagement.md) | What brings people back and brings new people in; shared journeys |
| [docs/07-run-locally.md](docs/07-run-locally.md) | Run the app and the API on your Mac, and open it on your iPhone |
| [apps/api/](apps/api/) | The Journey API: Spring Boot (Java) |
| [apps/mobile/](apps/mobile/) | The app: Expo (React Native, TypeScript) |
| [design/tokens.json](design/tokens.json) | Colours, type, shapes: the single source for the hub and the app |
| [design/hub/](design/hub/) | The hub's source: screens, styles, status and build script |
| [scripts/e2e/](scripts/e2e/) | A browser walk-through that uses every built screen, for checking changes |
| [CLAUDE.md](CLAUDE.md) | How Claude picks up the work in every session |
