/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'gray': '#4b5563',
        'blue': '#60a5fa',
        'purple': '#9e74ff',
      },
    },
  },
  plugins: [],
}

