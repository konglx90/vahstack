/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1890ff',
        'primary-light': 'rgba(24, 144, 255, 0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
};
