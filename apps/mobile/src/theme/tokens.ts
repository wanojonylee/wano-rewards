import { Platform } from 'react-native';

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const type = {
  display: {
    fontFamily: fonts.serif,
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -1.2,
  },
  hero: {
    fontFamily: fonts.serif,
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -0.8,
  },
  h1: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  h2: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  h3: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  small: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 15,
    letterSpacing: 2,
  },
};

export const layout = {
  screenPadding: 20,
  maxContentWidth: 560,
  tabBarHeight: 64,
  hitSlop: 8,
};

export const shadows = {
  card: {
    shadowColor: '#141710',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#0B2F22',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};
