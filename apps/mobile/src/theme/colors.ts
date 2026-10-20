export type ColorScheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  lineStrong: string;
  primary: string;
  primaryInk: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  lime: string;
  gold: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
  white: string;
  shadow: string;
}

export const lightPalette: Palette = {
  bg: '#F7F4ED',
  bgAlt: '#EFEBE1',
  surface: '#FFFEFB',
  surfaceMuted: '#F1EDE4',
  ink: '#14160F',
  inkSoft: '#3D4036',
  muted: '#73776B',
  line: '#E4DFD3',
  lineStrong: '#D3CCBC',
  primary: '#0C3B2A',
  primaryInk: '#F6F3EA',
  primarySoft: '#E4EEE6',
  accent: '#C05A32',
  accentSoft: '#F6E4DA',
  lime: '#D8EE8B',
  gold: '#A97C2F',
  success: '#1F7A5C',
  warning: '#A9650F',
  danger: '#B3261E',
  overlay: 'rgba(16,18,13,0.48)',
  white: '#FFFFFF',
  shadow: 'rgba(22,25,18,0.10)',
};

export const darkPalette: Palette = {
  bg: '#0E100C',
  bgAlt: '#141712',
  surface: '#181B15',
  surfaceMuted: '#1F231C',
  ink: '#F3F2E8',
  inkSoft: '#D8D8CC',
  muted: '#9DA292',
  line: '#2B3027',
  lineStrong: '#3A4035',
  primary: '#8FD6B0',
  primaryInk: '#0A1F16',
  primarySoft: '#1C2C23',
  accent: '#E08A5F',
  accentSoft: '#2E211A',
  lime: '#CDE87F',
  gold: '#D3AA5C',
  success: '#5FC69E',
  warning: '#D9A055',
  danger: '#E77B72',
  overlay: 'rgba(0,0,0,0.62)',
  white: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.35)',
};

export const materialColors: Record<string, string> = {
  PET: '#3E8E7E',
  ALUMINUM: '#8C8F98',
  GLASS: '#4E7FA8',
  HDPE: '#7A8F3C',
  PP: '#B9773F',
  PS_HIPS: '#8A6FA8',
};

export const rewardAccents: Record<string, { bg: string; fg: string }> = {
  coffee: { bg: '#EADFD2', fg: '#5A3B25' },
  market: { bg: '#DCE8D8', fg: '#2F5233' },
  cinema: { bg: '#E3DFEC', fg: '#41375A' },
  transit: { bg: '#DCE6EC', fg: '#264A5C' },
  gym: { bg: '#E8E3D6', fg: '#4B4636' },
  donation: { bg: '#DDEBE4', fg: '#1F4E3C' },
  bottle: { bg: '#D9E8E3', fg: '#1D5044' },
  bag: { bg: '#E9E4D3', fg: '#4C4229' },
  plant: { bg: '#DEE9D3', fg: '#365127' },
  ticket: { bg: '#F0E1D6', fg: '#6B3B23' },
  icecream: { bg: '#F1E3DD', fg: '#6E3A2E' },
  bookstore: { bg: '#E6E1D4', fg: '#4A412E' },
  streaming: { bg: '#E0E3EC', fg: '#33394F' },
  bike: { bg: '#DDE8E5', fg: '#2A4B45' },
};
