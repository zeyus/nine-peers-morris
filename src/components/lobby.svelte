<script lang="ts">
	import type { Peer } from '../thirdparty/peerjs/peer';
	import { type DataConnection } from '../thirdparty/peerjs/dataconnection/DataConnection';
	import { util } from '../thirdparty/peerjs/util';
	import { randomName } from '$lib/utils';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { peerConfig } from '$lib/persisted-store';
	import { Spinner, Modal, Button, ButtonGroup, Alert } from 'flowbite-svelte';
	import PeerList from '../components/peer-list.svelte';
	import {
		PeerCommands,
		GameHost,
		GameClient,
		type PeerMessage,
		type PeerState
	} from '$lib/game/comms';
	import { attachConnection, getOrCreatePeer, setNewConnectionHandler } from '$lib/game/connection';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { gameSession, gameSessionActions, persistedSessionData } from '$lib/game-state-store';

	const SESSION_EXPIRY = 5 * 60 * 1000; // 5 minutes

	let p: Peer | null = $state(null);
	let supported: boolean | null = $state(null);
	let them: string | null = $state(null);
	let dataConnection: DataConnection | null = $state(null);
	let role: PeerState | null = null;
	let modalVisible = $state(false);
	let notice: string | null = $state(null);
	let invited = false;
	// connection handlers outlive this component; once we've left the lobby they must not touch the session
	let mounted = true;

	function send(conn: DataConnection, command: PeerCommands) {
		role
			?.messageFromCommand(command)
			.then((msg) => conn.open && conn.send(msg))
			.catch((error) => console.error('Error sending message:', error));
	}

	/** Drops any pending invitation/connection and returns to the idle lobby */
	function resetConnection(message: string | null = null) {
		const conn = dataConnection;
		role = null;
		them = null;
		dataConnection = null;
		invited = false;
		modalVisible = false;
		notice = message;
		gameSessionActions.clearGameSession();
		if (conn?.open) {
			setTimeout(() => conn.close(), 500); // give queued messages a moment to flush
		}
	}

	function onPeerOpen(id: string) {
		peerConfig.set({ pId: id });
	}

	function onPeerError(err: Error & { type?: string }) {
		console.error(err);
		if (mounted && role) {
			resetConnection(
				err.type === 'peer-unavailable'
					? 'That player is no longer available.'
					: 'Connection failed.'
			);
		}
	}

	// Someone is inviting us to play
	function onIncomingConnection(conn: DataConnection) {
		if (role) {
			conn.on('open', () => conn.close());
			return;
		}
		notice = null;
		dataConnection = conn;
		them = conn.peer;
		const client = new GameClient($peerConfig.pId!, conn.peer);
		client.startGame(window);
		role = client;
		attachConnection(conn, client, {
			onMessage: (msg: PeerMessage, c: DataConnection) => {
				if (!mounted || role !== client) return;
				if (msg.command === PeerCommands.Helo) {
					send(c, PeerCommands.Elho);
				} else if (msg.command === PeerCommands.PlayWithMe) {
					modalVisible = true;
				}
			}
		});
		conn.on('close', () => {
			if (mounted && role === client) resetConnection(`${conn.peer} left.`);
		});
	}

	onMount(() => {
		// Check for persisted session and navigate to board if exists
		const persisted = get(persistedSessionData);
		if (persisted && persisted.gameState && persisted.timestamp) {
			const age = Date.now() - persisted.timestamp;
			if (age < SESSION_EXPIRY) {
				// Navigate to board, which will handle restoration
				goto(resolve('/board'));
				return;
			} else {
				// Session expired, clear it
				gameSessionActions.clearPersistedState();
			}
		}

		if (!util.supports.data) {
			supported = false;
			return;
		}
		supported = true;

		// coming back to the lobby ends any previous game
		const previous = get(gameSession).dataConnection;
		gameSessionActions.clearGameSession();
		previous?.close();

		if (!$peerConfig.pId) {
			peerConfig.set({ pId: randomName() });
		}
		p = getOrCreatePeer($peerConfig.pId!);
		p.on('open', onPeerOpen);
		p.on('error', onPeerError);
		setNewConnectionHandler(onIncomingConnection);
	});

	onDestroy(() => {
		mounted = false;
		setNewConnectionHandler(null);
		p?.off('open', onPeerOpen);
		p?.off('error', onPeerError);
	});

	// We are inviting someone to play
	const onConnectRequest = (pId: string) => {
		if (!p || role) return;
		notice = null;
		const conn = p.connect(pId, { metadata: { gameName: randomName() } });
		if (!conn) {
			notice = 'Could not connect to that player.';
			return;
		}
		dataConnection = conn;
		them = pId;
		const host = new GameHost($peerConfig.pId!, pId);
		host.startGame(window);
		role = host;
		invited = false;
		attachConnection(conn, host, {
			onOpen: (c) => send(c, PeerCommands.Helo),
			onMessage: (msg: PeerMessage, c: DataConnection) => {
				if (!mounted || role !== host) return;
				if (msg.command === PeerCommands.Elho) {
					invited = true;
					send(c, PeerCommands.PlayWithMe);
				} else if (msg.command === PeerCommands.LetsPlay && invited) {
					goto(resolve('/board'));
				} else if (msg.command === PeerCommands.NoThanks) {
					resetConnection(`${pId} declined your invitation.`);
				}
			}
		});
		conn.on('close', () => {
			if (mounted && role === host) resetConnection(`${pId} left.`);
		});
	};

	function acceptInvite() {
		if (dataConnection) send(dataConnection, PeerCommands.LetsPlay);
		modalVisible = false;
		goto(resolve('/board'));
	}

	function declineInvite() {
		if (dataConnection) send(dataConnection, PeerCommands.NoThanks);
		resetConnection();
	}
</script>

<div
	class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800"
>
	<div class="mx-auto max-w-4xl">
		{#if p && $peerConfig.pId}
			<div class="mb-6 rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800">
				<div class="mb-6 text-center">
					<h1 class="mb-2 text-3xl font-bold text-gray-800 dark:text-gray-100">
						Nine Men's Morris
					</h1>
					<p class="text-gray-600 dark:text-gray-400">Multiplayer Lobby</p>
				</div>

				<div class="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
					<div class="flex items-center justify-center space-x-2">
						<span class="text-sm font-medium text-gray-500 dark:text-gray-400">Your Peer ID:</span>
						<span
							class="rounded border border-gray-200 bg-white px-3 py-1 font-mono text-lg font-semibold text-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-indigo-400"
						>
							{$peerConfig.pId}
						</span>
					</div>
				</div>

				{#if notice}
					<Alert color="yellow" class="mb-6" dismissable onclose={() => (notice = null)}>
						{notice}
					</Alert>
				{/if}

				{#if them}
					<div
						class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20"
					>
						<div class="flex items-center justify-center space-x-2">
							<div class="h-3 w-3 animate-pulse rounded-full bg-green-500 dark:bg-green-400"></div>
							<span class="font-medium text-green-800 dark:text-green-300">Connected to {them}</span
							>
						</div>
					</div>
				{/if}

				<div class="space-y-4">
					<h2
						class="flex items-center space-x-2 text-xl font-semibold text-gray-800 dark:text-gray-100"
					>
						<span>Available Players</span>
						<div class="h-2 w-2 animate-pulse rounded-full bg-green-500 dark:bg-green-400"></div>
					</h2>
					<PeerList pId={$peerConfig.pId} {onConnectRequest} />
				</div>
			</div>

			<Modal
				headerClass="dark:text-white"
				title="Game Invitation"
				bind:open={modalVisible}
				onclose={() => (modalVisible = false)}
				dismissable={false}
			>
				<div class="p-6 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900"
					>
						<svg
							class="h-8 w-8 text-indigo-600 dark:text-indigo-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-2-4H9m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V9z"
							></path>
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Game Request!</h3>
					<p class="mb-6 text-gray-600 dark:text-gray-400">
						<span class="font-medium">{them}</span> would like to play Nine Men's Morris with you.
					</p>
					<ButtonGroup class="justify-center">
						<Button size="lg" onclick={acceptInvite}>
							<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								></path>
							</svg>
							Accept Game
						</Button>
						<Button size="lg" color="alternative" onclick={declineInvite}>
							<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								></path>
							</svg>
							Decline
						</Button>
					</ButtonGroup>
				</div>
			</Modal>
		{:else}
			<div class="flex min-h-screen items-center justify-center">
				<div class="text-center">
					{#if supported === false}
						<div
							class="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20"
						>
							<svg
								class="mx-auto mb-4 h-12 w-12 text-red-500 dark:text-red-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z"
								></path>
							</svg>
							<h3 class="mb-2 text-lg font-semibold text-red-800 dark:text-red-300">
								Browser Not Supported
							</h3>
							<p class="text-red-600 dark:text-red-400">
								Sorry, your browser does not support WebRTC which is required for peer-to-peer
								gaming.
							</p>
						</div>
					{:else}
						<div class="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
							<Spinner size="8" color="blue" />
							<p class="mt-4 text-gray-600 dark:text-gray-400">Connecting to lobby...</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
