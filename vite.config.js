import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), 'VITE_');
const apiBaseUrl = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default defineConfig({
	server: {
		proxy: {
			'/api': {
				target: apiBaseUrl,
				changeOrigin: true,
				secure: false,
				cookieDomainRewrite: { '*': '' },
				cookiePathRewrite: { '*': '/' },
			}
		}
	},
	plugins: [tailwindcss(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.js']
				}
			},
			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
