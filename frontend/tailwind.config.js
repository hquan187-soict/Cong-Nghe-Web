// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#6366F1",
        primaryHover: "#4F46E5",
        secondary: "#E5E7EB",
        danger: "#EF4444",
      },
      boxShadow: {
        soft: "0 4px 14px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        xl: "12px",
      },
    },
  },
};