<script lang="ts">
	import type { Cell, NinePeersMorris } from "$lib/game/game";
    import BoardCell from "./boardcell.svelte";
    let { n, e, s, w, cell, game, onclick }: {
        n?: boolean,
        e?: boolean,
        s?: boolean,
        w?: boolean,
        cell?: Cell,
        game?: NinePeersMorris,
        onclick?: (cell: Cell) => void
    } = $props();
    
</script>
<div class="segment aspect-square relative">
    {#if n}
        <div class="line top-0 left-1/2 h-1/2 w-[1vw] bg-pink-800 absolute pointer-events-none z-0"></div>
    {/if}
    {#if e}
        <div class="line top-1/2 right-0 h-[1vw] w-1/2 bg-pink-800 absolute pointer-events-none z-0"></div>
    {/if}
    {#if s}
        <div class="line bottom-0 left-1/2 h-1/2 w-[1vw] bg-pink-800 absolute pointer-events-none z-0"></div>
    {/if}
    {#if w}
        <div class="line top-1/2 left-0 h-[1vw] w-1/2 bg-pink-800 absolute pointer-events-none z-0"></div>
    {/if}
    <BoardCell {cell} {game} {onclick} />
</div>
