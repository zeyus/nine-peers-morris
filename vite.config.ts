import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Consult https://svelte.dev/docs/kit/integrations
			// for more information about preprocessors
			preprocess: vitePreprocess(),
			adapter: adapter({ fallback: '404.html' }),
			paths: {
				base: process.argv.includes('dev')
					? ''
					: (process.env.BASE_PATH as `/${string}` | undefined)
			}
		})
	],
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	ssr: {
		optimizeDeps: {
			include: ['peerjs']
		},
		noExternal: ['peerjs']
	}
});
