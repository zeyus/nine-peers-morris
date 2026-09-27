import { get } from 'svelte/store';
import { Peer } from '../../thirdparty/peerjs/peer';
import type { DataConnection } from '../../thirdparty/peerjs/dataconnection/DataConnection';
import { peerServerConf } from '$lib/peer-config';
import { gameSession, gameSessionActions } from '$lib/game-state-store';
import {
	HashMismatchError,
	PeerCommands,
	PeerData,
	PeerRole,
	type PeerMessage,
	type PeerState
} from './comms';

/**
 * Owns the single PeerJS peer for this tab and the wiring between a data
 * connection, the PeerState protocol and the gameSession store, so the lobby
 * and the board page share the same behaviour.
 */

let peer: Peer | null = null;
let newConnectionHandler: ((conn: DataConnection) => void) | null = null;

/** Returns the peer for this id, creating (or replacing) it if needed */
export function getOrCreatePeer(id: string): Peer {
	if (peer && !peer.destroyed && peer.id === id) {
		return peer;
	}
	peer?.destroy();
	const p = new Peer(id, peerServerConf);
	p.on('connection', routeIncomingConnection);
	peer = p;
	return p;
}

export function destroyPeer() {
	peer?.destroy();
	peer = null;
}

/** Sets who handles connections from peers that are not our current opponent */
export function setNewConnectionHandler(fn: ((conn: DataConnection) => void) | null) {
	newConnectionHandler = fn;
}

function routeIncomingConnection(conn: DataConnection) {
	const session = get(gameSession);
	if (session.peerState && session.opponentId === conn.peer) {
		// our opponent reconnected (e.g. after reloading the page)
		attachConnection(conn, session.peerState);
		return;
	}
	if (session.peerState || !newConnectionHandler) {
		// already busy with another peer: refuse politely
		conn.on('open', () => conn.close());
		return;
	}
	newConnectionHandler(conn);
}

export type ConnectionOptions = {
	/** Called after a message has been validated and applied */
	onMessage?: (msg: PeerMessage, conn: DataConnection) => void;
	/** Called once the connection is open */
	onOpen?: (conn: DataConnection) => void;
	/** Ask the peer for its game state once open (used after a page reload) */
	requestSyncOnOpen?: boolean;
};

function sendWhenReady(conn: DataConnection, message: Promise<string>) {
	message
		.then((data) => {
			if (get(gameSession).dataConnection === conn && conn.open) {
				conn.send(data);
			}
		})
		.catch((error) => console.error('Error sending message:', error));
}

/**
 * Makes `conn` the active connection for `peerState` and wires up message
 * handling, sync and disconnect detection. Messages from any older connection
 * are ignored from then on.
 */
export function attachConnection(
	conn: DataConnection,
	peerState: PeerState,
	options: ConnectionOptions = {}
) {
	gameSessionActions.setGameSession({
		peerState,
		game: peerState.getGame(),
		dataConnection: conn,
		opponentId: peerState.them,
		isConnected: conn.open
	});

	const isCurrent = () => get(gameSession).dataConnection === conn;

	const onOpen = () => {
		if (!isCurrent()) return;
		gameSessionActions.markOpponentReconnected(conn, options.requestSyncOnOpen);
		if (options.requestSyncOnOpen) {
			sendWhenReady(conn, peerState.requestSync('reconnect'));
		}
		options.onOpen?.(conn);
	};
	if (conn.open) {
		onOpen();
	} else {
		conn.on('open', onOpen);
	}

	conn.on('data', async (raw) => {
		if (!isCurrent()) return;
		const msg = PeerData.dataToPeerMessage(raw);
		if (!msg) {
			console.warn('Ignoring malformed message from peer');
			return;
		}
		try {
			await peerState.handleMessage(msg);
		} catch (error) {
			if (error instanceof HashMismatchError) {
				console.warn('Game out of sync with peer, resynchronising:', error.message);
				// the host's game is authoritative: the client asks for it, the host
				// tells the client to ask
				sendWhenReady(
					conn,
					peerState.role === PeerRole.Client
						? peerState.requestSync('mismatch')
						: peerState.messageFromCommand(PeerCommands.HashMismatch)
				);
			} else {
				console.error('Rejected message from peer:', error);
				gameSessionActions.setError(
					error instanceof Error ? error.message : 'Received an invalid message'
				);
			}
			return;
		}

		if (msg.command === PeerCommands.SyncRequest) {
			sendWhenReady(conn, peerState.syncResponse());
		} else if (msg.command === PeerCommands.HashMismatch && peerState.role === PeerRole.Client) {
			sendWhenReady(conn, peerState.requestSync('mismatch'));
		} else if (msg.command === PeerCommands.SyncResponse) {
			gameSessionActions.setError(null);
		}
		options.onMessage?.(msg, conn);
	});

	const onLost = () => {
		if (isCurrent()) {
			gameSessionActions.markOpponentDisconnected();
		}
	};
	conn.on('close', onLost);
	conn.on('error', (err) => {
		console.error('Connection error:', err);
		onLost();
	});
	conn.on('iceStateChanged', (state) => {
		if (state === 'disconnected' || state === 'failed') {
			onLost();
		} else if (
			(state === 'connected' || state === 'completed') &&
			isCurrent() &&
			get(gameSession).opponentDisconnected
		) {
			gameSessionActions.markOpponentReconnected(conn);
		}
	});
}

/** Sends a move made locally to the opponent */
export function sendMove(move: object) {
	const { peerState, dataConnection } = get(gameSession);
	if (peerState && dataConnection) {
		sendWhenReady(dataConnection, peerState.sendMove(move));
	}
}

/** Tells the opponent we forfeit, then closes the connection */
export async function forfeitAndDisconnect() {
	const { peerState, dataConnection } = get(gameSession);
	if (peerState && dataConnection?.open) {
		try {
			dataConnection.send(await peerState.messageFromCommand(PeerCommands.Forfeit));
		} catch (error) {
			console.error('Error sending forfeit:', error);
		}
	}
	// detach first so the close doesn't show a "disconnected" banner
	gameSessionActions.clearGameSession();
	dataConnection?.close({ flush: true });
}
