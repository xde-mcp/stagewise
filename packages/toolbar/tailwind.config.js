import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

const extraColors = {
  stagewise: {
    50: "hsl(221, 100%, 96%)",
    100: "hsl(224, 100%, 92%)",
    200: "hsl(226, 100%, 86%)",
    300: "hsl(228, 100%, 78%)",
    400: "hsl(234, 100%, 69%)",
    500: "hsl(239, 100%, 62%)",
    600: "hsl(244, 100%, 55%)",
    700: "hsl(245, 90%, 50%)",
    800: "hsl(244, 85%, 41%)",
    900: "hsl(243, 74%, 34%)",
    950: "hsl(244, 73%, 20%)",
  },
  stagewise_muted: {
    50: "hsl(225, 50%, 97%)",
    100: "hsl(221, 51%, 93%)",
    200: "hsl(218, 51%, 87%)",
    300: "hsl(218, 51%, 78%)",
    400: "hsl(219, 50%, 68%)",
    500: "hsl(222, 48%, 60%)",
    600: "hsl(227, 44%, 53%)",
    700: "hsl(230, 40%, 50%)",
    800: "hsl(231, 38%, 40%)",
    900: "hsl(230, 33%, 33%)",
    950: "hsl(231, 31%, 21%)",
  },
};

/** @type {import('tailwindcss').Config} */
export default {
  important: false,
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
      },
      backgroundImage: {},
      fontSize: {
        xs: "0.7rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      colors: {
        stagewise: extraColors.stagewise,
        stagewise_muted: extraColors.stagewise_muted,
        border: {
          DEFAULT: colors.zinc[500],
        },
        input: {
          DEFAULT: colors.zinc[500],
        },
        ring: {
          DEFAULT: extraColors.stagewise[700],
        },
        background: {
          DEFAULT: colors.white,
        },
        foreground: {
          DEFAULT: colors.zinc[950],
        },
        primary: {
          DEFAULT: extraColors.stagewise[700],
          foreground: colors.white,
        },
        secondary: {
          DEFAULT: extraColors.stagewise[50],
          foreground: extraColors.stagewise[700],
        },
        destructive: {
          DEFAULT: colors.rose[700],
          foreground: colors.rose[50],
        },
        muted: {
          DEFAULT: colors.zinc[50],
          foreground: colors.zinc[500],
        },
        offmuted: {
          DEFAULT: colors.zinc[100],
          foreground: colors.zinc[600],
        },
        accent: {
          DEFAULT: extraColors.stagewise[50],
          foreground: extraColors.stagewise[700],
        },
        popover: {
          DEFAULT: colors.white,
          foreground: colors.zinc[950],
        },
        card: {
          DEFAULT: colors.white,
          foreground: colors.zinc[950],
        },
        annotation: {
          general: colors.blue[700],
          content: colors.green[700],
          visual: colors.orange[700],
          bug: colors.rose[700],
        },
      },
    },
  },
  plugins: [],
};
