<script lang="ts">
    import { type Cell } from "$lib/game/game";
    import { type Graph } from "$lib/game/graph";
    import Piece from "./piece.svelte";
    let { cell  }: {
        cell?: Cell, // the cell object, which references a piece if placed
    } = $props();
</script>
{#if cell}
    <div class="size-full z-10 grid place-items-center" class:placed={cell.piece}>
        {#if cell.piece}
            <Piece piece={cell.piece} />
        
        {:else}
            <div class="rounded-full bg-purple-900 size-[2vw] mt-[1vw] ml-[1vw] z-10 border-[0.5vw] border-pink-400"></div>
        {/if}
    </div>
{/if}
