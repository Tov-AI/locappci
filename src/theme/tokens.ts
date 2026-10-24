/**
 * LOCAPPCI design tokens.
 * Source of truth: "LOCAPPCI Mobile App — Design Handoff v1" › Design tokens.
 * Never hard-code a colour, font size or spacing in a screen: import it from here.
 */

export const colors = {
  brand: {
    navy: '#002366',
    navyDark: '#001A4D',
    navyTint: '#E9EDF7',
    navySelected: '#EDF1F9',
    onNavyMuted: '#CBD5EE',
    orange: '#F86200',
    orangeTint: '#FEEDE1',
    orangeText: '#A33F00',
    orangeTextDark: '#7A2F00',
    orangeBorder: '#E8A27A',
    green: '#00A032',
    greenText: '#00782A',
    greenTint: '#E6F4EA',
    greenDark: '#00561E',
  },
  text: {
    primary: '#16191D',
    body: '#39404A',
    muted: '#5B6470',
    placeholder: '#7A828C',
    inverse: '#FFFFFF',
  },
  surface: {
    card: '#FFFFFF',
    ground: '#F6F7F5',
    field: '#F1F3F1',
    neutral: '#EEF0F3',
    /** Loading placeholder: dark enough to see on the grey ground and on white cards. */
    skeleton: '#DFE3E8',
  },
  border: {
    default: '#E4E6EA',
    input: '#D5D9DE',
    /** Unselected radio ring: darker than input so the empty circle stays visible (3:1). */
    radio: '#8A939E',
  },
  status: {
    danger: '#B42318',
  },
  overlay: 'rgba(22, 25, 29, 0.45)',
} as const;

/** DM Sans families, one per weight (loaded in src/app/_layout.tsx). */
export const fontFamily = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
} as const;

type TypeStyle = { fontSize: number; lineHeight: number; fontFamily: string };

const t = (fontSize: number, family: string, lineHeight = 1.35): TypeStyle => ({
  fontSize,
  lineHeight: Math.round(fontSize * lineHeight),
  fontFamily: family,
});

/** Type scale from the handoff. */
export const type = {
  screenTitle: t(24, fontFamily.bold, 1.25),
  display: t(22, fontFamily.bold, 1.25),
  productTitle: t(21, fontFamily.bold, 1.25),
  headerTitle: t(18, fontFamily.bold, 1.3),
  cardTitle: t(17, fontFamily.bold, 1.3),
  button: t(16, fontFamily.bold, 1.25),
  body: t(15, fontFamily.regular, 1.5),
  bodyStrong: t(15, fontFamily.semibold, 1.4),
  secondary: t(14, fontFamily.medium, 1.4),
  secondaryStrong: t(14, fontFamily.semibold, 1.4),
  meta: t(13, fontFamily.regular, 1.4),
  metaStrong: t(13, fontFamily.semibold, 1.4),
  caption: t(12, fontFamily.medium, 1.35),
  tab: t(11, fontFamily.semibold, 1.3),
} as const;

export type TypeVariant = keyof typeof type;

/** Spacing scale: every gap and padding comes from here. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  gutter: 16,
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  sheet: 20,
  pill: 999,
} as const;

export const size = {
  touch: 44,
  button: 52,
  field: 44,
  iconTab: 22,
} as const;
