/**
 * Central Theme for Stationery Indent Mobile App
 * Dark Navy Design System
 */

export const colors = {
  // Canvas & Surfaces
  background: '#090d16',         // Deepest navy canvas
  backgroundElevated: '#0f172a',   // Card secondary / input fills / header bar
  card: '#1e293b',                // Main surface card (slate navy)
  cardHover: '#243248',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',

  // Borders & Dividers
  border: '#334155',              // Standard border
  borderSubtle: '#1e293b',        // Subtle divider inside cards
  borderFocus: '#38bdf8',         // Active/focused borders

  // Text Hierarchy
  text: '#ffffff',                // High-contrast headings
  textPrimary: '#f8fafc',         // Primary labels and text
  textSecondary: '#cbd5e1',       // Secondary readable text
  textMuted: '#94a3b8',           // Captions, subtitles, timestamps
  textDim: '#64748b',             // Placeholders and disabled labels

  // Primary Accent & Interactive
  primary: '#2563eb',             // Vibrant royal blue CTA
  primaryHover: '#1d4ed8',
  primaryLight: '#38bdf8',        // Sky blue highlight
  primarySubtle: '#0c4a6e',       // Blue tint fill

  // Semantic Status Colors
  success: '#16a34a',             // Green (Issued / Done)
  successLight: '#4ade80',
  successSubtle: '#052e16',
  successBorder: '#166534',

  warning: '#d97706',             // Amber / Gold (Requested / In Review)
  warningLight: '#fbbf24',
  warningSubtle: '#451a03',
  warningBorder: '#b45309',

  danger: '#dc2626',              // Red / Crimson (Urgent / Rejected)
  dangerLight: '#f87171',
  dangerSubtle: '#450a0a',
  dangerBorder: '#991c1c',

  info: '#0284c7',                // Cyan / Blue (Approved)
  infoLight: '#38bdf8',
  infoSubtle: '#0c4a6e',
  infoBorder: '#0284c7',

  neutral: '#475569',             // Grey (Cancelled)
  neutralLight: '#94a3b8',
  neutralSubtle: '#1e293b',
  neutralBorder: '#334155'
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999
};
export const radius = radii;

export const typography = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28
};
export const fontSizes = typography;
export const fontSize = typography;

export const layout = {
  minTouchTarget: 44
};

export default {
  colors,
  spacing,
  radii,
  radius: radii,
  typography,
  fontSizes: typography,
  fontSize: typography,
  layout
};
