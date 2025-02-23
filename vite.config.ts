import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [
		/** @ts-ignore */
		tailwindcss(),
		sveltekit()
	],
	resolve: process.env.VITEST
	? {
			conditions: ['browser']
		}
	: undefined,
	ssr: {
		optimizeDeps: {
			include: ['peerjs']
		},
		noExternal: ['peerjs']
	}
});
