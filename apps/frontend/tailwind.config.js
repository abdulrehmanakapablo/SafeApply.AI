/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#000000',
          surface: '#0D0D0D',
          elevated: '#1A1A1A',
        },
        border: {
          subtle: '#1A1A1A',
          default: '#1A1A1A',
        },
        accent: {
          primary: '#22C55E',
          secondary: '#16A34A',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#737373',
        },
        status: {
          success: '#22C55E',
          error: '#EF4444',
          warning: '#EAB308',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}