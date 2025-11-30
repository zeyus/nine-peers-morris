<script lang="ts">
    import NineGameBoard from "../../components/game/ninegameboard.svelte";
    import { Player, NinePeersMorris, GamePhase, type Cell, type Game } from "$lib/game/game";
    import { onMount, onDestroy } from "svelte";
    import { gameSession, gameSessionActions, persistedSessionData } from "$lib/game-state-store";
    import { peerConfig } from '$lib/persisted-store';
    import { goto } from '$app/navigation';
    import { Modal, Button, Alert } from 'flowbite-svelte';
    import { GameHost, GameClient, PeerState } from "$lib/game/comms";
      import { resolve } from '$app/paths';
    
    let game = $state<Game>();
    let gameState = $state({
        phase: GamePhase.Placement,
        currentPlayer: null as Player | null,
        turn: 0,
        winner: null as Player | null
    });
    let session = $state(gameSession);
    let selectionKey = $state(0); // Track selection changes for reactivity
    let refreshKey = $state(0); // Force board refresh
    let turnUnsubscribe: (() => void) | null = null; // Track subscription cleanup

    // Make the session reactive so the board updates when peers connect
    $effect(() => {
        console.log('[EFFECT] Game session updated:', $session);

        if ($session.game && $session.isConnected) {
            // Only set up subscription if we haven't already or if the game changed
            if (game !== $session.game) {
                // Clean up old subscription
                if (turnUnsubscribe) {
                    console.log('[EFFECT] Cleaning up old turn subscription');
                    turnUnsubscribe();
                    turnUnsubscribe = null;
                }

                // Use the peer-connected game
                game = $session.game;
                console.log('[EFFECT] Using peer game session with opponent:', $session.opponentId);
                console.log('[EFFECT] Game has pieces on board:', game.getBoard.state.size);

                // Log board state
                for (let i = 0; i < 24; i++) {
                    const cell = game.getBoard.getCell(i);
                    if (cell.piece) {
                        console.log('[EFFECT] Cell', i, 'has piece from player', cell.piece.player.id);
                    }
                }

                // Subscribe to game state changes
                if (game.getTurn) {
                    console.log('[EFFECT] Setting up turn subscription for game');
                    turnUnsubscribe = () => game ? game.getTurn.subscribe((newTurn) => {
                        console.log('[TURN SUBSCRIPTION] Callback fired! Turn:', newTurn, 'Game exists:', !!game);
                        if (game) {
                            // Force reactivity by reassigning the game state
                            gameState = {
                                turn: newTurn,
                                currentPlayer: game.getCurrentPlayer,
                                phase: game.phase,
                                winner: game.getWinner
                            };

                            // Increment refresh key to force board re-render
                            refreshKey++;
                            console.log('[TURN SUBSCRIPTION] Updated turn to', newTurn, ', refreshKey:', refreshKey);

                            // Persist game state after every turn
                            const currentSession = $gameSession;
                            if (currentSession.peerState && currentSession.isConnected) {
                                gameSessionActions.persistGameState(game, currentSession.peerState, $peerConfig.pId);
                                console.log('[PERSIST] Game state saved after turn', newTurn);
                            }
                        }
                    }) : () => {};
                } else {
                    console.log('[EFFECT] Game.getTurn is not available');
                }

                // Initialize game state
                gameState.currentPlayer = game.getCurrentPlayer;
                gameState.phase = game.phase;
                gameState.winner = game.getWinner;
            }
        }
    });

    onMount(async () => {
        // Check for persisted session first (after page refresh)
        const persisted = $persistedSessionData;
        const SESSION_EXPIRY = 5 * 60 * 1000; // 5 minutes

        if (persisted && persisted.gameState && persisted.timestamp) {
            const age = Date.now() - persisted.timestamp;
            if (age < SESSION_EXPIRY && persisted.opponentId && persisted.myPeerId) {
                console.log('Restoring game from persisted state...');
                try {
                    // Import Peer and recreate connection
                    const { Peer } = await import("../../thirdparty/peerjs/peer");
                    const { peerServerConf } = await import('$lib/peer-config');

                    // Create new peer with existing ID
                    const p = new Peer(persisted.myPeerId, peerServerConf);

                    p.on('open', () => {
                        console.log('Peer reconnected, attempting to reconnect to opponent...');
                        // Try to reconnect to opponent
                        const conn = p.connect(persisted.opponentId!);

                        conn.on('open', async () => {
                            console.log('Reconnected to opponent!');

                            // Recreate PeerState
                            let role: PeerState;

                            // Rehydrate game from persisted state
                            let restoredGame: Game | null = null;
                            if (persisted.gameState) {
                                try {
                                    console.log('Rehydrating game from persisted state...');
                                    restoredGame = await NinePeersMorris.rehydrate(window, persisted.gameState);
                                    console.log('Game successfully rehydrated!');
                                    role = PeerState.rehydrate(persisted.peerState!, restoredGame);
                                } catch (error) {
                                    console.error('Failed to rehydrate game:', error);
                                    // Fall back to creating a fresh game
                                            role = persisted.role === 0 ?
                                        new GameHost(persisted.myPeerId!, persisted.opponentId!) :
                                        new GameClient(persisted.myPeerId!, persisted.opponentId!);

                                        role.startGame(window, restoredGame);
                                    restoredGame = role.getGame();
                                }
                            } else {
                                role = persisted.role === 0 ?
                                    new GameHost(persisted.myPeerId!, persisted.opponentId!) :
                                    new GameClient(persisted.myPeerId!, persisted.opponentId!);
                                role.startGame(window);
                                restoredGame = role.getGame();
                            }

                            gameSessionActions.setGameSession({
                                peerState: role,
                                dataConnection: conn,
                                opponentId: persisted.opponentId,
                                game: restoredGame,
                                isConnected: true
                            });

                            if (restoredGame) {
                                game = restoredGame;
                                console.log('Game restored successfully!');
                                console.log('Restored game turn:', restoredGame.getTurn.valueOf());
                                console.log('Restored game current player:', restoredGame.getCurrentPlayer.id);
                                console.log('Restored game phase:', restoredGame.phase);

                                // Initialize gameState from restored game
                                gameState = {
                                    turn: restoredGame.getTurn.valueOf(),
                                    currentPlayer: restoredGame.getCurrentPlayer,
                                    phase: restoredGame.phase,
                                    winner: restoredGame.getWinner
                                };
                            }
                        });

                        // Set up data handler to receive moves from opponent
                        conn.on('data', async (data) => {
                            console.log('[RECONNECT] Received data from opponent:', data);
                            const session = $gameSession;
                            if (session.peerState) {
                                const { PeerData } = await import('$lib/game/comms');
                                const msg = PeerData.dataToPeerMessage(data as string);
                                console.log('[RECONNECT] Processing message:', msg);
                                await session.peerState.handleMessage(msg);

                                // Force game update to trigger reactivity
                                if (session.game) {
                                    game = session.game;
                                    gameState = {
                                        turn: session.game.getTurn.valueOf(),
                                        currentPlayer: session.game.getCurrentPlayer,
                                        phase: session.game.phase,
                                        winner: session.game.getWinner
                                    };
                                }
                            }
                        });

                        conn.on('close', () => {
                            gameSessionActions.markOpponentDisconnected();
                        });

                        conn.on('error', (err) => {
                            console.error('Reconnection failed:', err);
                            gameSessionActions.markOpponentDisconnected();
                        });
                    });

                    return; // Exit early after attempting restoration
                } catch (error) {
                    console.error('Failed to restore game:', error);
                    gameSessionActions.clearPersistedState();
                }
            } else {
                // Session expired
                gameSessionActions.clearPersistedState();
            }
        }

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

                    // Persist game state (demo mode shouldn't need it, but keep for consistency)
                    const currentSession = $gameSession;
                    if (currentSession.peerState && currentSession.isConnected) {
                        gameSessionActions.persistGameState(game, currentSession.peerState, $peerConfig.pId);
                        console.log('[PERSIST] Game state saved after turn', newTurn);
                    }
                }
            });

            // Initialize game state
            gameState.currentPlayer = game.getCurrentPlayer;
            gameState.phase = game.phase;
            gameState.winner = game.getWinner;
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

        // Update selection key to trigger reactivity
        selectionKey = game.selectionVersion;
        console.log('[SELECTION] Updated selectionKey to:', selectionKey, 'selectedPiece:', game.selectedPiece?.id);

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
    
    // Leave game modal state
    let showLeaveGameModal = $state(false);

    // Disconnection monitoring
    let reconnectionTimer: number | null = null;
    let remainingReconnectTime = $state(60);

    function handleLeaveGame() {
        if (isMultiplayer && !gameState.winner) {
            // Show confirmation modal for active game
            showLeaveGameModal = true;
        } else {
            // Game is over or demo mode, go back to lobby
            gameSessionActions.clearPersistedState();
            goto(resolve('/'));
        }
    }

    function confirmLeaveGame() {
        // TODO: Send forfeit message to opponent
        gameSessionActions.clearPersistedState();
        showLeaveGameModal = false;
        goto(resolve('/'));
    }

    // Monitor opponent disconnection
    $effect(() => {
        if ($session.opponentDisconnected && $session.disconnectedAt) {
            const elapsed = Date.now() - $session.disconnectedAt;
            const remaining = Math.max(0, Math.ceil(($session.reconnectionTimeout - elapsed) / 1000));
            remainingReconnectTime = remaining;

            if (reconnectionTimer) {
                clearInterval(reconnectionTimer);
            }

            reconnectionTimer = window.setInterval(() => {
                const elapsed = Date.now() - $session.disconnectedAt!;
                const remaining = Math.max(0, Math.ceil(($session.reconnectionTimeout - elapsed) / 1000));
                remainingReconnectTime = remaining;

                if (remaining === 0) {
                    clearInterval(reconnectionTimer!);
                    reconnectionTimer = null;
                    // Timeout reached - return to lobby
                    gameSessionActions.clearPersistedState();
                    gameSessionActions.clearGameSession();
                    goto(resolve('/'));
                }
            }, 1000);
        } else if (reconnectionTimer) {
            clearInterval(reconnectionTimer);
            reconnectionTimer = null;
        }
    });

    // Persist game state after every move
    $effect(() => {
        if (game && $session.peerState && $session.isConnected) {
            gameSessionActions.persistGameState(game, $session.peerState, $peerConfig.pId);
        }
    });

    // Watch for turn changes to keep gameState in sync
    $effect(() => {
        if ($session.game && $session.isConnected) {
            const currentTurn = $session.game.getTurn.valueOf();
            const currentPhase = $session.game.phase;
            const currentPlayer = $session.game.getCurrentPlayer;

            console.log('[EFFECT] Session game state:', {
                turn: currentTurn,
                phase: currentPhase,
                currentPlayerName: currentPlayer?.name,
                localTurn: gameState.turn,
                localPhase: gameState.phase,
                turnMismatch: gameState.turn !== currentTurn,
                phaseMismatch: gameState.phase !== currentPhase,
                needsSync: gameState.turn !== currentTurn || gameState.phase !== currentPhase
            });

            // Only update if the turn or phase actually changed
            if (gameState.turn !== currentTurn || gameState.phase !== currentPhase) {
                console.log('[EFFECT] Turn/phase changed, updating gameState and refreshKey');
                gameState = {
                    turn: currentTurn,
                    currentPlayer: currentPlayer,
                    phase: currentPhase,
                    winner: $session.game.getWinner
                };

                // Force board refresh
                refreshKey++;
                console.log('[EFFECT] Incremented refreshKey to:', refreshKey);
            }
        }
    });

    onDestroy(() => {
        if (reconnectionTimer) {
            clearInterval(reconnectionTimer);
        }
    });
</script>

<div class="container mx-auto p-4">
    <!-- Opponent Disconnected Alert -->
    {#if $session.opponentDisconnected && remainingReconnectTime > 0}
        <Alert color="yellow" class="mb-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <svg class="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="font-semibold">{opponentName} has disconnected</span>
                </div>
                <span class="text-sm">Waiting for reconnection: {remainingReconnectTime}s</span>
            </div>
        </Alert>
    {:else if isMultiplayer && !$session.opponentDisconnected && $session.isConnected}
        <!-- Show reconnected message briefly after reconnection -->
        <Alert color="green" class="mb-4" dismissable>
            <div class="flex items-center space-x-2">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <span class="font-semibold text-black">Connection restored with {opponentName}</span>
            </div>
        </Alert>
    {/if}

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
            <button 
                class="inline-flex items-center px-3 py-1 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                onclick={handleLeaveGame}>
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                {gameState.winner ? 'Return to Lobby' : 'Leave Game'}
            </button>
        </div>
        
        {#if gameState.winner}
            <div class="text-2xl font-bold text-green-600">
                🎉 {#if isMultiplayer}
                    {#if $gameSession.peerState?.role === 0}
                        {gameState.winner.name === "X" ? "You Win" : `${opponentName} Wins`}!
                    {:else}
                        {gameState.winner.name === "O" ? "You Win" : `${opponentName} Wins`}!
                    {/if}
                {:else}
                    {gameState.winner.name} Wins!
                {/if} 🎉
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
        {#key `${gameState.turn}-${gameState.phase}-${selectionKey}-${refreshKey}`}
            <NineGameBoard board={game.getBoard} game={(game as NinePeersMorris)} onCellClick={handleCellClick} />
        {/key}
    {/if}
    
    <!-- Leave Game Confirmation Modal -->
    <Modal bind:open={showLeaveGameModal} title="Leave Game" onclose={() => showLeaveGameModal = false}>
        <div class="text-center p-6">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
            </div>
            <h3 class="text-lg font-semibold dark:text-gray-100 text-gray-900 mb-2">Are you sure you want to leave?</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
                Leaving the game will count as a forfeit. <span class="font-medium">{opponentName}</span> will be declared the winner.
            </p>
            <div class="flex justify-center space-x-3">
                <Button color="red" onclick={confirmLeaveGame}>
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    Yes, Leave Game
                </Button>
                <Button color="gray" onclick={() => showLeaveGameModal = false}>
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Cancel
                </Button>
            </div>
        </div>
    </Modal>
</div>
