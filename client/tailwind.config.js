const palette = {
  background: "#282c34",
  foreground: "#ededed",
  surface: "#1f2937",
  primary: "#60a5fa",
  accent: "#9e74ff",
  muted: "#4b5563",
  border: "#94a3b8",
  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: palette.background,
        foreground: palette.foreground,
        surface: palette.surface,
        primary: palette.primary,
        accent: palette.accent,
        muted: palette.muted,
        border: palette.border,
        success: palette.success,
        danger: palette.danger,
        warning: palette.warning,
      },
    },
  },
  plugins: [],
}

