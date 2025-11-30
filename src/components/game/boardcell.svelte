<script lang="ts">
    import { type Cell, type NinePeersMorris } from "$lib/game/game";
    import Piece from "./piece.svelte";
    import { gameSession } from "$lib/game-state-store";
    
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

    // Check if it's actually the local player's turn in multiplayer
    const isMyTurnInMultiplayer = $derived.by(() => {
        if (!game) return false;

        const session = $gameSession;
        if (!session.isConnected || !session.peerState) {
            return true; // In demo mode, always allow interaction
        }

        // Use the same approach as the page - check role against current player name
        // This seems to be more reliable than checking player IDs
        const currentPlayer = game.getCurrentPlayer;
        if (!currentPlayer) return false;

        const isMyTurn = (session.peerState.role === 0 && currentPlayer.name === "X") ||
                        (session.peerState.role === 1 && currentPlayer.name === "O");

        return isMyTurn;
    });

    const canPlayerMove = $derived(Boolean(game && game.phase === 'movement' && game.canMovePiece()));

    // Force reactivity by accessing selectionVersion
    const selectionVersion = $derived(game?.selectionVersion ?? 0);

    const isValidMove = $derived(Boolean(game && cell && game.validMoves.includes(cell) && isMyTurnInMultiplayer && selectionVersion >= 0));
    const isRemovable = $derived(Boolean(game && cell?.piece && game.removablePieces.includes(cell.piece) && isMyTurnInMultiplayer && selectionVersion >= 0));
    const isSelected = $derived(Boolean(game && cell?.piece && game.selectedPiece === cell.piece && selectionVersion >= 0));
    const isValidPlacement = $derived(Boolean(game && cell && !cell.piece && game.phase === 'placement' && game.canPlacePiece() && isMyTurnInMultiplayer && selectionVersion >= 0));
    const isMovablePiece = $derived(Boolean(game && cell?.piece && game.phase === 'movement' && cell.piece.player.id === game.getCurrentPlayer?.id && canPlayerMove && isMyTurnInMultiplayer && selectionVersion >= 0));
    
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
            class:bg-purple-900={!isValidMove && !isRemovable && !isValidPlacement && !isMovablePiece}
            class:border-pink-400={!isValidMove && !isRemovable && !isValidPlacement && !isMovablePiece}
            class:bg-green-400={isValidMove || isValidPlacement}
            class:border-green-200={isValidMove || isValidPlacement}
            class:motion-safe:animate-pulse={isValidMove || isValidPlacement}
            class:shadow-lg={isValidMove || isValidPlacement}
            class:shadow-green-400={isValidMove || isValidPlacement}
            class:scale-125={isValidMove || isValidPlacement}
            class:bg-yellow-400={isMovablePiece && canPlayerMove && !isSelected}
            class:border-yellow-200={isMovablePiece && canPlayerMove && !isSelected}
            class:motion-safe:animate-bounce={isMovablePiece && canPlayerMove && !isSelected}
            class:shadow-md={isMovablePiece && canPlayerMove}
            class:shadow-yellow-300={isMovablePiece && canPlayerMove}
            class:bg-red-500={isRemovable}
            class:border-red-300={isRemovable}
            class:motion-safe:animate-ping={isRemovable}
            class:ring-4={isSelected}
            class:ring-yellow-400={isSelected}
            class:ring-opacity-70={isSelected}
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
