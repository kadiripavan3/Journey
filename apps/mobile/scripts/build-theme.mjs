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
});

const type = Object.fromEntries(
  tokens.type.map((t) => [
    t.name.toLowerCase(),
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

export const radius = ${JSON.stringify(tokens.radius, null, 2)} as const;

/** The spacing scale, in points. */
export const space = ${JSON.stringify(tokens.space)} as const;

export const type = ${JSON.stringify(type, null, 2)} as const;
`;

writeFileSync(join(here, '../src/theme/tokens.ts'), out);
console.log(`Theme written with the ${accentName} accent.`);
