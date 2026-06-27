/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 방문 상태 색상 (스크래치맵 컨셉)
        visited: '#34d399',
        planned: '#fbbf24',
        wish: '#f472b6',
        unvisited: '#cbd5e1',
        brand: {
          DEFAULT: '#ff8a65', // 스크래치맵 코랄톤
          50: '#fff3ef',
          100: '#ffe0d6',
          500: '#ff8a65',
          600: '#f4663a',
          700: '#d9532c',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.12)',
        'glass-lg': '0 12px 48px rgba(0, 0, 0, 0.18)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        pop: 'pop 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
