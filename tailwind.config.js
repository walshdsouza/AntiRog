/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Charcoal / sand / electric blue. Keep in sync with src/theme/neu.ts (PALETTE).
      colors: {
        canvas: { DEFAULT: '#E9E0CE', dark: '#1C1E21' },
        ink: { DEFAULT: '#232528', dark: '#EEE5D3' },
        muted: { DEFAULT: '#55524B', dark: '#B8B1A4' },
        outline: { DEFAULT: '#857D6E', dark: '#6E6A63' },
        primary: { DEFAULT: '#2A2C30', dark: '#E6D9C0' },
        accent: { DEFAULT: '#0047E0', dark: '#4C9DFF' },
        danger: { DEFAULT: '#A61E2D', dark: '#FF8E8E' },
        success: { DEFAULT: '#1B6A44', dark: '#74D29C' },
        warning: { DEFAULT: '#874C00', dark: '#F2BA60' },
      },
    },
  },
  plugins: [],
};
