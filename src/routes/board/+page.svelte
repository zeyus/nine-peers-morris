<script lang="ts">
    import NineGameBoard from "../../components/game/ninegameboard.svelte";
    import { NineBoard, Player, NinePeersMorris, GamePhase, type Cell, type Game } from "$lib/game/game";
    import { onMount } from "svelte";
    import { gameSession } from "$lib/game-state-store";
    import { goto } from '$app/navigation';
    
    let game = $state<Game>();
    let gameState = $state({ 
        phase: GamePhase.Placement, 
        currentPlayer: null as Player | null,
        turn: 0,
        winner: null as Player | null
    });
    let session = $state(gameSession);
    // Make the session reactive so the board updates when peers connect
    $effect(() => {
        
        console.log('Game session updated:', session);
        
        if ($session.game && $session.isConnected) {
            // Use the peer-connected game
            game = $session.game;
            console.log('Using peer game session with opponent:', $session.opponentId);
            
            // Subscribe to game state changes if not already subscribed
            if (game.getTurn) {
                game.getTurn.subscribe((newTurn) => {
                    if (game) {
                        // Force reactivity by reassigning the game state
                        gameState = { 
                            turn: newTurn,
                            currentPlayer: game.getCurrentPlayer,
                            phase: game.phase,
                            winner: game.getWinner
                        };
                        // Force board reactivity by reassigning the game reference
                        game = game;
                    }
                });
            }
            
            // Initialize game state
            gameState.currentPlayer = game.getCurrentPlayer;
            gameState.phase = game.phase;
        }
    });

    onMount(() => {
        // Only create demo game if no peer session exists
        const session = $gameSession;
        if (!session.game || !session.isConnected) {
            console.log('No peer session found, using demo mode');
            const p1 = new Player("Player 1", "X", true);
            const p2 = new Player("Player 2", "O", false);
            game = new NinePeersMorris(window, p1, p2);
            
            // Subscribe to game state changes
            game.getTurn.subscribe((newTurn) => {
                if (game) {
                    gameState.turn = newTurn;
                    gameState.currentPlayer = game.getCurrentPlayer;
                    gameState.phase = game.phase;
                    gameState.winner = game.getWinner;
                }
            });
            
            // Initialize game state
            gameState.currentPlayer = game.getCurrentPlayer;
            gameState.phase = game.phase;
        }
    });

    function handleCellClick(cell: Cell) {
        if (!game) return;
        
        // Check if it's multiplayer and if it's our turn
        const session = $gameSession;
        if (session.isConnected && session.peerState) {
            const isMyTurn = (session.peerState.role === 0 && gameState.currentPlayer?.name === "X") ||
                           (session.peerState.role === 1 && gameState.currentPlayer?.name === "O");
            
            console.log('Turn check:', {
                myRole: session.peerState.role,
                currentPlayerName: gameState.currentPlayer?.name,
                isMyTurn,
                validMovesCount: game?.validMoves?.length || 0,
                canPlacePiece: game?.canPlacePiece?.() || false
            });
            
            if (!isMyTurn) {
                console.log("Not your turn!");
                return;
            }
        }
        
        // In multiplayer, we handle turn validation ourselves, so bypass the game's isMyTurn check
        console.log('Cell clicked:', {
            cellId: cell.id,
            hasPiece: !!cell.piece,
            currentPlayer: gameState.currentPlayer?.name,
            phase: gameState.phase,
            canPlacePiece: game?.canPlacePiece?.()
        });
        
        const move = session.isConnected ? 
            game.handleCellClickForced(cell) : // Use a forced version that bypasses turn check
            game.handleCellClick(cell);
        if (move) {
            console.log('Move made:', move);
            
            // Force gameState update to trigger reactivity
            gameState = { 
                turn: game.getTurn.valueOf(),
                currentPlayer: game.getCurrentPlayer,
                phase: game.phase,
                winner: game.getWinner
            };
            
            // Send move to opponent if in multiplayer
            if (session.isConnected && session.peerState && session.dataConnection) {
                session.peerState.sendMove(move).then(async msg => {
                    console.log('Sending move to opponent:', move);
                    session.dataConnection!.send(msg);
                    
                    // Update our own state hash after sending the move
                    if (session.peerState!.getGame()) {
                        await session.peerState!.updateStateHash();
                        console.log('Updated our hash after move:', session.peerState!.lastHash);
                    }
                }).catch(error => {
                    console.error('Error sending move:', error);
                });
            }
        }
    }

    const remainingPieces = $derived(gameState.currentPlayer?.unplacedPieces.length || 0);
    const phaseText = $derived(gameState.phase === GamePhase.Placement ? 'Placement Phase' : 
                   gameState.phase === GamePhase.Movement ? 'Movement Phase' : 
                   gameState.phase === GamePhase.Capture ? 'Remove Opponent Piece' : 'Game Over');
    
    // Show if we're in multiplayer mode
    const isMultiplayer = $derived($gameSession.isConnected);
    const opponentName = $derived($gameSession.opponentId || 'Opponent');
    const myRole = $derived($gameSession.peerState?.role);
    const amIHost = $derived(myRole === 0); // PeerRole.Host = 0
</script>

<div class="container mx-auto p-4">
    <div class="mb-4 text-center">
        <div class="flex items-center justify-center space-x-4 mb-2">
            <h1 class="text-3xl font-bold">Nine Men's Morris</h1>
            {#if isMultiplayer}
                <div class="flex items-center space-x-2 bg-green-100 px-3 py-1 rounded-full">
                    <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span class="text-sm font-medium text-green-800">vs {opponentName}</span>
                </div>
            {:else}
                <div class="flex items-center space-x-2 bg-blue-100 px-3 py-1 rounded-full">
                    <span class="text-sm font-medium text-blue-800">Demo Mode</span>
                </div>
            {/if}
        </div>
        
        {#if gameState.winner}
            <div class="text-2xl font-bold text-green-600">
                🎉 {gameState.winner.name} Wins! 🎉
            </div>
        {:else}
            <div class="text-lg">
                <span class="font-semibold">{phaseText}</span> - 
                <span class="font-bold" 
                      class:text-purple-600={gameState.currentPlayer?.name === "X"}
                      class:text-amber-600={gameState.currentPlayer?.name === "O"}>
                    {#if isMultiplayer && gameState.currentPlayer}
                        {#if $gameSession.peerState?.role === 0}
                            {gameState.currentPlayer.name === "X" ? "Your" : opponentName + "'s"} Turn
                        {:else}
                            {gameState.currentPlayer.name === "O" ? "Your" : opponentName + "'s"} Turn
                        {/if}
                    {:else}
                        {gameState.currentPlayer?.name}'s Turn
                    {/if}
                </span>
            </div>
            
            {#if gameState.phase === GamePhase.Placement}
                <div class="text-sm text-gray-600">
                    Remaining pieces: {remainingPieces}
                </div>
            {/if}
            
            {#if game?.millToRemove}
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div class="text-lg font-bold text-red-800 mb-1">🎯 Mill Formed!</div>
                    <div class="text-sm text-red-700">
                        {#if isMultiplayer}
                            {#if ($session.peerState?.role === 0 && gameState.currentPlayer?.name === "X") || ($session.peerState?.role === 1 && gameState.currentPlayer?.name === "O")}
                                <strong>Your turn:</strong> Click on an opponent's piece to remove it
                            {:else}
                                <strong>Opponent's turn:</strong> They are removing one of your pieces
                            {/if}
                        {:else}
                            <strong>{gameState.currentPlayer?.name}'s turn:</strong> Click on an opponent's piece to remove it
                        {/if}
                    </div>
                </div>
            {/if}
        {/if}
    </div>
    
    {#if game}
        {#key `${gameState.turn}-${gameState.phase}`}
            <NineGameBoard board={game.getBoard} game={(game as NinePeersMorris)} onCellClick={handleCellClick} />
        {/key}
    {/if}
</div>
