/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: "tw-",
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      screens: {
        'mobile-s': '320px',
        'mobile': '375px',
        'small': '480px',
        'tablet': '768px',
        'desktop': '1440px'
      }
    },
  },
  plugins: [],
};
