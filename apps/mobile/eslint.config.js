// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// The app must look like the designs and use only the tokens (design/tokens.json). These rules keep that true:
// text styles, corners and colours are never written by hand, and emoji are drawn by the Emoji component.
const EMOJI = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}]';

const type = {
  selector: 'Property[key.name=/^(fontSize|lineHeight|letterSpacing|fontWeight|fontFamily)$/]',
  message: 'Text styles come from the type scale. Use a Txt variant (and its weight prop), or textStyle() for a box you type in.',
};
const corners = [
  {
    selector: 'Property[key.name=/Radius$/][value.type="Literal"]',
    message: 'Corners come from the radius tokens: radius.card, radius.sheet, radius.pill for anything fully round.',
  },
  {
    selector: 'Property[key.name=/Radius$/] > :matches(ConditionalExpression, BinaryExpression) > Literal[raw=/^[0-9]/]',
    message: 'Corners come from the radius tokens: radius.card, radius.sheet, radius.pill for anything fully round.',
  },
];
const colours = [
  { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Colours come from the theme: colors.text, colors.stage and so on.' },
  { selector: 'Literal[value=/rgba?\\(/]', message: 'Colours and shadows come from the theme. For a see-through shade of a token use withAlpha().' },
  { selector: 'TemplateElement[value.raw=/rgba?\\(|#[0-9a-fA-F]{6}/]', message: 'Colours and shadows come from the theme. For a see-through shade of a token use withAlpha().' },
];
const emoji = [
  { selector: `JSXText[value=/${EMOJI}/u]`, message: 'Draw emoji with the Emoji component, so they get their 3D icon.' },
  {
    selector: `JSXAttribute[name.name!=/^(emoji|char|pillEmoji)$/] Literal[value=/${EMOJI}/u]`,
    message: 'Draw emoji with the Emoji component, so they get their 3D icon. Pass the emoji in an emoji prop, not inside a label.',
  },
  { selector: `TemplateElement[value.raw=/${EMOJI}/u]`, message: 'Draw emoji with the Emoji component, so they get their 3D icon.' },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'src/api/generated/*', 'expo-env.d.ts', '.expo/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/**/__tests__/**'],
    rules: { 'no-restricted-syntax': ['error', type, ...corners, ...colours, ...emoji] },
  },
  {
    // Sizes worked out from a size prop (an avatar's initials, an emoji without a picture) can't be a variant.
    files: ['src/ui/Avatar.tsx', 'src/ui/Emoji.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...corners, ...colours, ...emoji] },
  },
  {
    // Other companies' logos keep their own colours, and the app's mark its own proportions.
    files: ['src/ui/Brand.tsx'],
    rules: { 'no-restricted-syntax': ['error', type, ...emoji] },
  },
  {
    // The design system knows nothing about journeys, people or the API. Features build on it, not the other way round.
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features/*', '@/api/*', '@/auth/*', '@/app/*'], message: 'src/ui is the design system: no features, no API, no session. Move this component to src/features.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/lib/**/*.ts', 'src/api/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/app/*'], message: 'Screens use features, not the other way round.' }] }],
    },
  },
]);
