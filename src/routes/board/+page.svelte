<script lang="ts">
	import NineGameBoard from '../../components/game/ninegameboard.svelte';
	import { Player, NinePeersMorris, GamePhase, type Cell } from '$lib/game/game';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import {
		gameSession,
		gameSessionActions,
		persistedSessionData,
		type PersistedSessionData
	} from '$lib/game-state-store';
	import { goto } from '$app/navigation';
	import { Modal, Button, Alert } from 'flowbite-svelte';
	import { PeerState } from '$lib/game/comms';
	import {
		attachConnection,
		destroyPeer,
		forfeitAndDisconnect,
		getOrCreatePeer,
		sendMove
	} from '$lib/game/connection';
	import { resolve } from '$app/paths';

	const SESSION_EXPIRY = 5 * 60 * 1000; // 5 minutes
	const RECONNECTED_NOTICE_MS = 4000;

	// The game object is mutated in place; `version` is bumped on every change so
	// the template (and board) re-render without remounting.
	let game = $state.raw<NinePeersMorris | null>(null);
	let version = $state(0);
	let restoreError = $state<string | null>(null);
	let now = $state(Date.now());
	let showLeaveGameModal = $state(false);
	let unsubscribeGame: (() => void) | null = null;
	let clock: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let leaving = false;

	function persist() {
		const session = get(gameSession);
		if (game && session.peerState && session.game === game) {
			gameSessionActions.persistGameState(game, session.peerState, session.peerState.me);
		}
	}

	function useGame(g: NinePeersMorris) {
		if (game === g) return;
		unsubscribeGame?.();
		game = g;
		unsubscribeGame = g.onChange(() => {
			version++;
			persist();
		});
		version++;
	}

	// Follow the session's game (it is replaced when a new game starts)
	$effect(() => {
		const sessionGame = $gameSession.game;
		if (sessionGame instanceof NinePeersMorris && sessionGame !== game) {
			useGame(sessionGame);
			persist();
		}
	});

	/** Rebuilds a multiplayer game after a page reload and reconnects to the opponent */
	async function restoreSession(persisted: PersistedSessionData) {
		const restored = await NinePeersMorris.rehydrate(
			window,
			persisted.gameState!,
			persisted.myPeerId
		);
		const role = PeerState.rehydrate(persisted.peerState!, restored);
		gameSessionActions.setGameSession({
			peerState: role,
			game: restored,
			opponentId: role.them,
			dataConnection: null,
			isConnected: false,
			opponentDisconnected: true,
			disconnectedAt: Date.now()
		});
		useGame(restored);

		let peerRetries = 0;
		const start = () => {
			const peer = getOrCreatePeer(role.me);
			const connect = () => {
				if (leaving || !get(gameSession).opponentDisconnected) return;
				attachConnection(peer.connect(role.them), role, { requestSyncOnOpen: true });
			};
			peer.on('error', (err: Error & { type?: string }) => {
				if (leaving) return;
				if (err.type === 'unavailable-id' && peerRetries++ < 5) {
					// the signalling server hasn't released our id from before the reload yet
					destroyPeer();
					reconnectTimer = setTimeout(start, 3000);
				} else if (err.type === 'peer-unavailable') {
					// opponent isn't back yet; keep trying until the reconnection timeout
					reconnectTimer = setTimeout(connect, 5000);
				} else {
					console.error('Peer error while reconnecting:', err);
				}
			});
			if (peer.open) {
				connect();
			} else {
				peer.once('open', connect);
			}
		};
		start();
	}

	onMount(() => {
		clock = setInterval(() => (now = Date.now()), 1000);

		const session = get(gameSession);
		if (session.game instanceof NinePeersMorris && session.peerState) {
			useGame(session.game);
			persist();
			return;
		}

		const persisted = get(persistedSessionData);
		if (persisted?.gameState && persisted.peerState && persisted.opponentId && persisted.myPeerId) {
			if (Date.now() - persisted.timestamp < SESSION_EXPIRY) {
				restoreSession(persisted).catch((error) => {
					console.error('Failed to restore game:', error);
					gameSessionActions.clearPersistedState();
					gameSessionActions.clearGameSession();
					restoreError = 'Your previous game could not be restored.';
				});
				return;
			}
			gameSessionActions.clearPersistedState();
		}

		// No peer session: local two-player (hot-seat) demo
		useGame(
			new NinePeersMorris(
				window,
				new Player('player-1', 'X', true),
				new Player('player-2', 'O', false)
			)
		);
	});

	onDestroy(() => {
		unsubscribeGame?.();
		if (clock) clearInterval(clock);
		if (reconnectTimer) clearTimeout(reconnectTimer);
	});

	function handleCellClick(cell: Cell) {
		if (!game || !game.isMyTurn()) return;
		const session = get(gameSession);
		// don't let moves pile up while the opponent can't receive them
		if (session.peerState && !session.isConnected) return;

		const move = game.handleCellClick(cell);
		if (move && session.peerState) {
			sendMove(move);
		}
	}

	function leaveToLobby() {
		leaving = true;
		gameSessionActions.clearPersistedState();
		goto(resolve('/'));
	}

	function handleLeaveGame() {
		if (isMultiplayer && !view?.winner) {
			// Show confirmation modal for active game
			showLeaveGameModal = true;
		} else {
			if (isMultiplayer) forfeitAndDisconnect();
			leaveToLobby();
		}
	}

	async function confirmLeaveGame() {
		showLeaveGameModal = false;
		await forfeitAndDisconnect();
		leaveToLobby();
	}

	const view = $derived.by(() => {
		void version;
		if (!game) return null;
		const phase = game.phase;
		return {
			phase,
			currentPlayer: game.getCurrentPlayer,
			winner: game.getWinner,
			myTurn: game.isMyTurn(),
			millToRemove: game.millToRemove,
			localPlayer: game.localPlayer,
			// pieces still to place for whoever this screen belongs to
			remainingPieces: (game.localPlayer ?? game.getCurrentPlayer).unplacedPieces.length,
			phaseText:
				phase === GamePhase.Placement
					? 'Placement Phase'
					: phase === GamePhase.Movement
						? 'Movement Phase'
						: phase === GamePhase.Capture
							? 'Remove Opponent Piece'
							: 'Game Over'
		};
	});

	const isMultiplayer = $derived(!!$gameSession.peerState);
	const opponentName = $derived($gameSession.opponentId || 'Opponent');
	const remainingReconnectTime = $derived(
		$gameSession.opponentDisconnected && $gameSession.disconnectedAt
			? Math.max(
					0,
					Math.ceil(($gameSession.reconnectionTimeout - (now - $gameSession.disconnectedAt)) / 1000)
				)
			: 0
	);
	const showReconnected = $derived(
		isMultiplayer &&
			!$gameSession.opponentDisconnected &&
			!!$gameSession.reconnectedAt &&
			now - $gameSession.reconnectedAt < RECONNECTED_NOTICE_MS
	);

	// Give up waiting for the opponent after the reconnection timeout
	$effect(() => {
		if (
			isMultiplayer &&
			$gameSession.opponentDisconnected &&
			remainingReconnectTime === 0 &&
			!view?.winner
		) {
			gameSessionActions.clearGameSession();
			leaveToLobby();
		}
	});
</script>

<div class="container mx-auto p-4">
	{#if restoreError}
		<Alert color="red" class="mb-4">
			<span class="font-semibold">{restoreError}</span>
			<a class="ml-2 underline" href={resolve('/')}>Back to the lobby</a>
		</Alert>
	{/if}

	{#if $gameSession.lastError}
		<Alert color="red" class="mb-4" dismissable onclose={() => gameSessionActions.setError(null)}>
			<span class="font-semibold">Problem with the opponent's connection:</span>
			{$gameSession.lastError}
		</Alert>
	{/if}

	<!-- Opponent Disconnected Alert -->
	{#if isMultiplayer && $gameSession.opponentDisconnected && remainingReconnectTime > 0 && !view?.winner}
		<Alert color="yellow" class="mb-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-2">
					<svg class="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						></path>
					</svg>
					<span class="font-semibold">Waiting for {opponentName} to connect</span>
				</div>
				<span class="text-sm">{remainingReconnectTime}s</span>
			</div>
		</Alert>
	{:else if showReconnected}
		<Alert color="green" class="mb-4">
			<div class="flex items-center space-x-2">
				<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					></path>
				</svg>
				<span class="font-semibold">Connection restored with {opponentName}</span>
			</div>
		</Alert>
	{/if}

	<div class="mb-4 text-center">
		<div class="mb-2 flex flex-wrap items-center justify-center gap-4">
			<h1 class="text-3xl font-bold">Nine Men's Morris</h1>
			{#if isMultiplayer}
				<div class="flex items-center space-x-2 rounded-full bg-green-100 px-3 py-1">
					<div
						class="h-2 w-2 rounded-full {$gameSession.isConnected
							? 'animate-pulse bg-green-500'
							: 'bg-yellow-500'}"
					></div>
					<span class="text-sm font-medium text-green-800">vs {opponentName}</span>
				</div>
			{:else}
				<div class="flex items-center space-x-2 rounded-full bg-blue-100 px-3 py-1">
					<span class="text-sm font-medium text-blue-800">Demo Mode</span>
				</div>
			{/if}
			<button
				class="inline-flex items-center rounded-lg border border-red-300 bg-red-100 px-3 py-1 text-sm font-medium text-red-700 transition-colors duration-200 hover:bg-red-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
				onclick={handleLeaveGame}
			>
				<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
					></path>
				</svg>
				{view?.winner || !isMultiplayer ? 'Return to Lobby' : 'Leave Game'}
			</button>
		</div>

		{#if view?.winner}
			<div class="text-2xl font-bold text-green-600">
				🎉
				{#if isMultiplayer}
					{view.winner === view.localPlayer ? 'You Win!' : `${opponentName} Wins!`}
				{:else}
					{view.winner.name} Wins!
				{/if}
				🎉
			</div>
		{:else if view}
			<div class="text-lg">
				<span class="font-semibold">{view.phaseText}</span> -
				<span
					class="font-bold"
					class:text-purple-600={view.currentPlayer.name === 'X'}
					class:text-amber-600={view.currentPlayer.name === 'O'}
				>
					{#if isMultiplayer}
						{view.myTurn ? 'Your' : `${opponentName}'s`} Turn
					{:else}
						{view.currentPlayer.name}'s Turn
					{/if}
				</span>
			</div>

			{#if view.phase === GamePhase.Placement}
				<div class="text-sm text-gray-600 dark:text-gray-400">
					{isMultiplayer
						? 'Your remaining pieces'
						: `${view.currentPlayer.name}'s remaining pieces`}: {view.remainingPieces}
				</div>
			{/if}

			{#if view.millToRemove}
				<div class="my-4 rounded-lg border border-red-200 bg-red-50 p-3">
					<div class="mb-1 text-lg font-bold text-red-800">🎯 Mill Formed!</div>
					<div class="text-sm text-red-700">
						{#if isMultiplayer}
							{#if view.myTurn}
								<strong>Your turn:</strong> Click on an opponent's piece to remove it
							{:else}
								<strong>Opponent's turn:</strong> They are removing one of your pieces
							{/if}
						{:else}
							<strong>{view.currentPlayer.name}'s turn:</strong> Click on an opponent's piece to remove
							it
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if game}
		<NineGameBoard board={game.getBoard} {game} {version} onCellClick={handleCellClick} />
	{/if}

	<!-- Leave Game Confirmation Modal -->
	<Modal
		bind:open={showLeaveGameModal}
		title="Leave Game"
		onclose={() => (showLeaveGameModal = false)}
	>
		<div class="p-6 text-center">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
				<svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z"
					></path>
				</svg>
			</div>
			<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Are you sure you want to leave?
			</h3>
			<p class="mb-6 text-gray-600 dark:text-gray-400">
				Leaving the game will count as a forfeit. <span class="font-medium">{opponentName}</span> will
				be declared the winner.
			</p>
			<div class="flex justify-center space-x-3">
				<Button color="red" onclick={confirmLeaveGame}>
					<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						></path>
					</svg>
					Yes, Leave Game
				</Button>
				<Button color="gray" onclick={() => (showLeaveGameModal = false)}>
					<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
					Cancel
				</Button>
			</div>
		</div>
	</Modal>
</div>
