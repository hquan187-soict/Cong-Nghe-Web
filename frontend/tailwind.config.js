export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4f46e5",
        primaryHover: "#4338ca",
        secondary: "#f8fafc",
        danger: "#f43f5e",
      },
      spacing: {
        '18': '4.5rem',
      }
    }
  },
  plugins: [],
}
