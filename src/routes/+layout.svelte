<script lang="ts">
	import '../app.css';
	import { effectiveTheme } from '$lib/theme-store';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import ThemeToggle from '../components/theme-toggle.svelte';

	let { children } = $props();

	// Apply theme immediately on mount to avoid flash
	onMount(() => {
		const theme = $effectiveTheme;
		const html = document.documentElement;
		const metaTag = document.querySelector('meta[name="color-scheme"]');

		console.log('BEFORE applying theme - classList:', html.classList.toString());

		if (theme === 'dark') {
			html.classList.add('dark');
			html.setAttribute('data-theme', 'dark');
			if (metaTag) metaTag.setAttribute('content', 'dark');
		} else {
			html.classList.remove('dark');
			html.setAttribute('data-theme', 'light');
			if (metaTag) metaTag.setAttribute('content', 'light');
		}

		console.log('AFTER applying theme - classList:', html.classList.toString(), 'hasDarkClass:', html.classList.contains('dark'));
	});

	// Apply theme to document element whenever effectiveTheme changes
	$effect(() => {
		if (browser) {
			const theme = $effectiveTheme;
			const html = document.documentElement;
			const metaTag = document.querySelector('meta[name="color-scheme"]');

			if (theme === 'dark') {
				html.classList.add('dark');
				html.setAttribute('data-theme', 'dark');
				if (metaTag) metaTag.setAttribute('content', 'dark');
			} else {
				html.classList.remove('dark');
				html.setAttribute('data-theme', 'light');
				if (metaTag) metaTag.setAttribute('content', 'light');
			}

			console.log('Theme applied via effect:', theme, 'classList:', html.classList.toString());
		}
	});
</script>

<div class="relative min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
	<div class="fixed top-4 right-4 z-50">
		<ThemeToggle />
	</div>
	{@render children()}
</div>
