/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
    ],
    presets: [require('nativewind/preset')],
    theme: {
        extend: {
            colors: {
                // Mirror the web app's indigo/slate palette so cross-platform
                // designs stay coherent. Web uses Tailwind defaults at the
                // same indices.
                brand: {
                    50: '#eef2ff',
                    600: '#4f46e5',
                    700: '#4338ca',
                },
            },
            fontFamily: {
                sans: ['System'],
            },
        },
    },
    plugins: [],
};
