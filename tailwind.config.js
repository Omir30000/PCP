export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./types/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nexus: '#facc15',
      }
    }
  },
  plugins: [],
};
