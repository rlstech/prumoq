/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  // Use class-based dark mode to avoid the "Cannot manually set color scheme"
  // error on web (NativeWind defaults to 'media', which throws when code
  // tries to set the scheme programmatically).
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
