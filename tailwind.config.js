/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}", // Scan everything in the project (excluding node_modules by default)
        "!./server/**",           // Explicitly ignore server folder
        "!./dist/**",            // Ignore output folder
        "!./node_modules/**"     // Ignore dependencies
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
