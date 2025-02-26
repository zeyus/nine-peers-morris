<script lang="ts">
    import { type Cell } from "$lib/game/game";
    import { type Graph } from "$lib/game/graph";
    import Piece from "./piece.svelte";
    let { cell  }: {
        cell?: Cell, // the cell object, which references a piece if placed
    } = $props();
</script>
{#if cell}
    <div class="size-full z-10 grid place-content-center" class:placed={cell.piece}>
        {#if cell.piece}
            <Piece piece={cell.piece} />
        
        {:else}
            <div class="rounded-full bg-purple-900 w-4 h-4 mt-2 ml-2 z-10 border-2 border-pink-400"></div>
        {/if}
    </div>
{/if}
