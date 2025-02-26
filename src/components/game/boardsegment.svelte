<script lang="ts">
	import type { Cell } from "$lib/game/game";
    import BoardCell from "./boardcell.svelte";
    let { n, e, s, w, cell }: {
        n?: boolean,
        e?: boolean,
        s?: boolean,
        w?: boolean,
        cell?: Cell
    } = $props();
</script>
<div class="segment aspect-square relative">
    {#if n}
        <div class="line top-0 left-1/2 h-1/2 w-2 bg-pink-800 absolute"></div>
    {/if}
    {#if e}
        <div class="line top-1/2 right-0 h-2 w-1/2 bg-pink-800 absolute"></div>
    {/if}
    {#if s}
        <div class="line bottom-0 left-1/2 h-1/2 w-2 bg-pink-800 absolute"></div>
    {/if}
    {#if w}
        <div class="line top-1/2 left-0 h-2 w-1/2 bg-pink-800 absolute"></div>
    {/if}
    <BoardCell cell={cell} />
</div>
