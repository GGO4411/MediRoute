import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'], theme: { extend: { colors: { ink: '#172b4d', teal: '#087e8b', mist: '#f4f8fa' }, boxShadow: { soft: '0 12px 40px rgba(18,52,77,.08)' } } }, plugins: [] };
export default config;
