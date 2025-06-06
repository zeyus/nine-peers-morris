<script lang="ts">
    import { type Cell, type NinePeersMorris } from "$lib/game/game";
    import { type Graph } from "$lib/game/graph";
    import Piece from "./piece.svelte";
    let { cell, game, onclick }: {
        cell?: Cell, // the cell object, which references a piece if placed
        game?: NinePeersMorris,
        onclick?: (cell: Cell) => void
    } = $props();

    function handleClick() {
        if (cell && onclick) {
            onclick(cell);
        }
    }

    const isValidMove = $derived(Boolean(game && cell && game.validMoves.includes(cell)));
    const isRemovable = $derived(Boolean(game && cell?.piece && game.removablePieces.includes(cell.piece)));
    const isSelected = $derived(Boolean(game && cell?.piece && game.selectedPiece === cell.piece));
    
</script>
{#if cell}
    <div 
        class="size-full z-10 grid place-items-center cursor-pointer relative" 
        class:placed={cell.piece}
        onclick={handleClick}
        onkeydown={(e) => e.key === 'Enter' && handleClick()}
        role="button"
        tabindex="0"
    >
        {#if cell.piece}
            <Piece 
                piece={cell.piece} 
                {isSelected}
                {isRemovable}
            />
{/if}
        
        <!-- Cell indicator dot -->
        <div 
            class="absolute top-50% mt-[1vw] ml-[1vw] rounded-full size-[2vw] z-5 border-[0.5vw] transition-all duration-200"
            class:bg-purple-900={!isValidMove && !isRemovable}
            class:border-pink-400={!isValidMove && !isRemovable}
            class:bg-green-500={isValidMove}
            class:border-green-300={isValidMove}
            class:motion-safe:animate-pulse={isValidMove}
            class:bg-red-500={isRemovable}
            class:border-red-300={isRemovable}
            class:motion-safe:animate-ping={isRemovable}
        ></div>
        
        {#if isRemovable}
            <!-- Extra visual indicator for removable pieces -->
            <div class="absolute inset-0 bg-red-500 opacity-20 animate-pulse rounded-full"></div>
            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold text-lg pointer-events-none">
                ✕
            </div>
        {/if}
    </div>
{/if}
