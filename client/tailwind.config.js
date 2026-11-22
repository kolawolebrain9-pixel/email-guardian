/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '420px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
    },
    extend: {
      colors: {
        paper: '#F4F6F4',
        'paper-raised': '#FFFFFF',
        ink: '#182524',
        'ink-soft': '#63726F',
        'ink-faint': '#95A19D',
        line: '#E1E7E3',
        'line-soft': '#EBEFEC',

        teal: {
          DEFAULT: '#2E5C55',
          deep: '#1B3833',
          tint: '#E7EFEC'
        },

        gold: {
          DEFAULT: '#C89550',
          bg: '#FBF2E5',
          text: '#9C6C2C'
        },

        coral: {
          DEFAULT: '#B85347',
          bg: '#FBEBE8',
          text: '#953C31'
        },

        violet: {
          DEFAULT: '#7A6BDE',
          bg: '#EFEDFB',
          deep: '#5A4CC0'
        },

        safe: {
          DEFAULT: '#7FA085',
          bg: '#EAF2EC'
        }
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: {
        'lg-custom': '18px',
        'md-custom': '13px',
        'sm-custom': '9px'
      },
      boxShadow: {
        'rest': '0 1px 2px rgba(24,37,36,0.04)',
        'hover': '0 2px 4px rgba(24,37,36,0.05), 0 14px 32px rgba(24,37,36,0.08)',
        'mark': '0 3px 8px rgba(27,56,51,0.28)',
        'avatar': '0 2px 6px rgba(27,56,51,0.25)'
      },
      keyframes: {
        ring: {
          '0%': { opacity: '0.55', transform: 'scale(0.6)' },
          '75%': { opacity: '0', transform: 'scale(2.1)' },
          '100%': { opacity: '0' }
        },
        pulsering: {
          '0%': { opacity: '0.5', transform: 'scale(0.5)' },
          '75%': { opacity: '0', transform: 'scale(2.3)' },
          '100%': { opacity: '0' }
        }
      },
      animation: {
        ring: 'ring 2.6s ease-out infinite',
        pulsering: 'pulsering 2.8s ease-out infinite'
      }
    },
  },
  plugins: [],
}

