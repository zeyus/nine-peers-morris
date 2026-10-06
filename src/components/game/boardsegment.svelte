<script lang="ts">
	import type { Cell, NinePeersMorris } from '#lib/game/game.js';
	import BoardCell from './boardcell.svelte';
	let {
		n,
		e,
		s,
		w,
		cell,
		game,
		onclick,
		version = 0
	}: {
		n?: boolean;
		e?: boolean;
		s?: boolean;
		w?: boolean;
		cell?: Cell;
		game?: NinePeersMorris;
		onclick?: (cell: Cell) => void;
		version?: number;
	} = $props();
</script>

<div class="segment relative aspect-square">
	{#if n}
		<div
			class="line pointer-events-none absolute top-0 left-1/2 z-0 h-1/2 w-[1vw] bg-pink-800"
		></div>
	{/if}
	{#if e}
		<div
			class="line pointer-events-none absolute top-1/2 right-0 z-0 h-[1vw] w-1/2 bg-pink-800"
		></div>
	{/if}
	{#if s}
		<div
			class="line pointer-events-none absolute bottom-0 left-1/2 z-0 h-1/2 w-[1vw] bg-pink-800"
		></div>
	{/if}
	{#if w}
		<div
			class="line pointer-events-none absolute top-1/2 left-0 z-0 h-[1vw] w-1/2 bg-pink-800"
		></div>
	{/if}
	{#if cell}
		<BoardCell {cell} {game} {onclick} {version} />
	{/if}
</div>
