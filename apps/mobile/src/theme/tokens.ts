// Generated from design/tokens.json by scripts/build-theme.mjs. Do not edit: change the tokens and run `npm run theme`.

export const accentName = "sun" as const;

export const palettes = {
  "light": {
    "bg": "#FFFFFF",
    "surface": "#FFFFFF",
    "fill": "#F3F3F6",
    "fill2": "#E6E6EC",
    "line": "#E9E9EE",
    "lineStrong": "#C2C2CB",
    "text": "#141418",
    "muted": "#6B6B75",
    "like": "#FF2D55",
    "ok": "#149A4E",
    "warn": "#B26B00",
    "done": "#2F6BF5",
    "danger": "#D92D20",
    "onDanger": "#FFFFFF",
    "glass": "rgba(255, 255, 255, .64)",
    "glassLine": "rgba(255, 255, 255, .85)",
    "glassStrong": "rgba(255, 255, 255, .86)",
    "gbtn": "rgba(255, 255, 255, .84)",
    "gbtnFg": "#141418",
    "mapLand": "#EEF0F2",
    "mapWater": "#CCE3EE",
    "mapPark": "#DBEBD3",
    "mapRoad": "#FFFFFF",
    "mapRoad2": "#DFE2E7",
    "mapLabel": "#6F7580",
    "accent": "#FFC21A",
    "onAccent": "#1A1400",
    "accentText": "#8A5A00",
    "accentSoft": "#FFF3CC",
    "onPhoto": "#FFFFFF",
    "photoGlass": "rgba(16, 16, 20, .36)",
    "photoGlassLine": "rgba(255, 255, 255, .24)"
  },
  "dark": {
    "bg": "#0B0B0E",
    "surface": "#18181E",
    "fill": "#202027",
    "fill2": "#2C2C35",
    "line": "#2A2A33",
    "lineStrong": "#45454F",
    "text": "#F5F5F7",
    "muted": "#A3A3AE",
    "like": "#FF375F",
    "ok": "#3DDC84",
    "warn": "#FFB547",
    "done": "#7FA2FF",
    "danger": "#FF6B5E",
    "onDanger": "#2A0A06",
    "glass": "rgba(30, 30, 38, .56)",
    "glassLine": "rgba(255, 255, 255, .10)",
    "glassStrong": "rgba(26, 26, 32, .86)",
    "gbtn": "rgba(24, 24, 30, .56)",
    "gbtnFg": "#FFFFFF",
    "mapLand": "#1A1D22",
    "mapWater": "#0E2231",
    "mapPark": "#16291C",
    "mapRoad": "#2D323B",
    "mapRoad2": "#23272E",
    "mapLabel": "#8E95A2",
    "accent": "#FFC21A",
    "onAccent": "#1A1400",
    "accentText": "#FFD46A",
    "accentSoft": "#33290A",
    "onPhoto": "#FFFFFF",
    "photoGlass": "rgba(16, 16, 20, .36)",
    "photoGlassLine": "rgba(255, 255, 255, .24)"
  }
} as const;

/** Shadows as CSS box-shadow values: "md" lifts cards and bars, "sm" outlines quiet surfaces. */
export const shadows = {
  "light": {
    "md": "0 12px 32px rgba(20, 20, 32, .13), 0 2px 6px rgba(20, 20, 32, .06)",
    "sm": "0 4px 16px rgba(20, 20, 32, .08), 0 0 0 1px rgba(20, 20, 32, .04)"
  },
  "dark": {
    "md": "0 12px 32px rgba(0, 0, 0, .55), 0 2px 6px rgba(0, 0, 0, .4)",
    "sm": "0 0 0 1px rgba(255, 255, 255, .06)"
  }
} as const;

export const radius = {
  "chip": 8,
  "thumb": 14,
  "card": 20,
  "panel": 24,
  "sheet": 30,
  "pill": 999
} as const;

/** The spacing scale, in points. */
export const space = [4,8,12,16,20,24,32,40,48] as const;

export const type = {
  "display": {
    "fontSize": 34,
    "lineHeight": 36,
    "weight": 800,
    "letterSpacing": -1.36
  },
  "title": {
    "fontSize": 23,
    "lineHeight": 27,
    "weight": 800,
    "letterSpacing": -0.69
  },
  "headline": {
    "fontSize": 16,
    "lineHeight": 21,
    "weight": 700,
    "letterSpacing": -0.24
  },
  "body": {
    "fontSize": 15,
    "lineHeight": 22,
    "weight": 500,
    "letterSpacing": 0
  },
  "caption": {
    "fontSize": 13,
    "lineHeight": 18,
    "weight": 600,
    "letterSpacing": 0
  },
  "label": {
    "fontSize": 11.5,
    "lineHeight": 14,
    "weight": 800,
    "letterSpacing": 0.81,
    "uppercase": true
  }
} as const;
