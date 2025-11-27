<script lang="ts">
	import { themePreference, type Theme } from '$lib/theme-store';
	import { SunSolid, MoonSolid } from 'flowbite-svelte-icons';

	function cycleTheme() {
		themePreference.update((current) => {
			const cycle: Record<Theme, Theme> = {
				system: 'light',
				light: 'dark',
				dark: 'system'
			};
			return cycle[current];
		});
	}

	function getThemeIcon(theme: Theme): 'sun' | 'moon' | 'system' {
		if (theme === 'light') return 'sun';
		if (theme === 'dark') return 'moon';
		return 'system';
	}

	function getThemeLabel(theme: Theme): string {
		return theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';
	}
</script>

<button
	onclick={cycleTheme}
	class="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
	title="Toggle theme: {getThemeLabel($themePreference)}"
	aria-label="Toggle theme"
>
	{#if getThemeIcon($themePreference) === 'sun'}
		<SunSolid class="w-5 h-5 text-yellow-500" />
	{:else if getThemeIcon($themePreference) === 'moon'}
		<MoonSolid class="w-5 h-5 text-blue-400" />
	{:else}
		<svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
			<path
				d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
			/>
		</svg>
	{/if}
</button>
