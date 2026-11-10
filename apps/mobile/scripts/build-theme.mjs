// Turns design/tokens.json (the single source for colours, type and shapes) into the app's theme.
// Run `npm run theme` after the tokens change. The output is committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, '../../../design/tokens.json'), 'utf8'));

const camel = (key) => key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const camelKeys = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [camel(k), v]));

const accentName = tokens.accent.chosen ?? tokens.accent.default;
const accent = tokens.accent.options[accentName];
if (!accent) throw new Error(`tokens.json: accent "${accentName}" is not one of the options`);

const palette = (mode) => ({
  ...camelKeys(tokens.color[mode]),
  accent: accent.accent,
  onAccent: accent.onAccent,
  accentText: mode === 'light' ? accent.textLight : accent.textDark,
  accentSoft: mode === 'light' ? accent.softLight : accent.softDark,
  onPhoto: tokens.onPhoto.text,
  photoGlass: tokens.onPhoto.glass,
  photoGlassLine: tokens.onPhoto.glassLine,
  photoTint: tokens.onPhoto.tint,
  stage: tokens.fixed.stage,
  black: tokens.fixed.black,
  white: tokens.fixed.white,
  scrim: tokens.fixed.scrim,
});

// "Body small" becomes bodySmall.
const variantName = (name) => name.toLowerCase().replace(/ ([a-z0-9])/g, (_, c) => c.toUpperCase());

const type = Object.fromEntries(
  tokens.type.map((t) => [
    variantName(t.name),
    {
      fontSize: t.size,
      lineHeight: t.line,
      weight: t.weight,
      letterSpacing: Math.round(t.tracking * t.size * 100) / 100,
      ...(t.caps ? { uppercase: true } : {}),
    },
  ]),
);

const out = `// Generated from design/tokens.json by scripts/build-theme.mjs. Do not edit: change the tokens and run \`npm run theme\`.

export const accentName = ${JSON.stringify(accentName)} as const;

export const palettes = ${JSON.stringify({ light: palette('light'), dark: palette('dark') }, null, 2)} as const;

/**
 * Shadows as CSS box-shadow values: "md" lifts cards and bars, "sm" outlines quiet surfaces. The rest are the same
 * in light and dark: under a sheet, under a switch's knob, around a picture that overlaps a photo, under a card on the stage.
 */
export const shadows = ${JSON.stringify(
  Object.fromEntries(
    ['light', 'dark'].map((mode) => [
      mode,
      {
        md: tokens.shadow[mode].shadow,
        sm: tokens.shadow[mode]['shadow-sm'],
        sheet: tokens.shadow.fixed.sheet,
        knob: tokens.shadow.fixed.knob,
        float: tokens.shadow.fixed.float,
        stage: tokens.shadow.fixed.stage,
      },
    ]),
  ),
  null,
  2,
)} as const;

export const radius = ${JSON.stringify(tokens.radius, null, 2)} as const;

/** The spacing scale, in points. */
export const space = ${JSON.stringify(tokens.space)} as const;

/** Where a screen's content starts from the edge ("gutter" for text and cards, "rowGutter" for full-width rows, "barGutter" for bars and rails), and the room above a section. */
export const layout = ${JSON.stringify(Object.fromEntries(Object.entries(tokens.layout).filter(([key]) => key !== 'note')))} as const;

export const type = ${JSON.stringify(type, null, 2)} as const;

/** Motion: how far a pressed thing shrinks, and durations in milliseconds. "stagger" is the gap between list items entering. */
export const motion = ${JSON.stringify(tokens.motion, null, 2)} as const;
`;

writeFileSync(join(here, '../src/theme/tokens.ts'), out);

// The public share pages (served by the API) use the same colours, as CSS variables.
const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/([a-z])([0-9])/g, '$1-$2');
const cssVars = (mode) => Object.entries(palette(mode)).map(([key, value]) => `  --${kebab(key)}: ${value};`).join('\n');
const css = `/* Generated from design/tokens.json by apps/mobile/scripts/build-theme.mjs. Do not edit: change the tokens and run \`npm run theme\`. */
:root {
${cssVars('light')}
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
${cssVars('dark').replace(/^/gm, '  ')}
  }
}
`;
writeFileSync(join(here, '../../api/src/main/resources/static/share/tokens.css'), css);
console.log(`Theme written with the ${accentName} accent.`);
