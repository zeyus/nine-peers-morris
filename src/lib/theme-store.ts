import { persisted } from 'svelte-persisted-store';
import { derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
	return theme === 'system' ? getSystemTheme() : theme;
}

// Store the user's theme preference (light, dark, or system)
export const themePreference = persisted<Theme>('theme-preference', 'system');

// Derived store that computes the effective theme
export const effectiveTheme: Readable<'light' | 'dark'> = derived(
	themePreference,
	($themePreference) => getEffectiveTheme($themePreference)
);

// Listen to system theme changes when in browser
if (browser) {
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', () => {
		// Trigger update when system theme changes
		themePreference.update((val) => val);
	});
}
