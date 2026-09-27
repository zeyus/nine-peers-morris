import { writable } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Game } from './game/game';
import type { PeerState } from './game/comms';
import type { DataConnection } from '../thirdparty/peerjs/dataconnection/DataConnection';

export interface GameSession {
	game: Game | null;
	peerState: PeerState | null;
	dataConnection: DataConnection | null;
	isConnected: boolean;
	opponentId: string | null;
	opponentDisconnected: boolean;
	disconnectedAt: number | null;
	reconnectionTimeout: number;
	/** When the connection was last restored, for a brief notice */
	reconnectedAt: number | null;
	/** Last protocol error to show the user (e.g. an invalid move from the peer) */
	lastError: string | null;
}

export interface PersistedSessionData {
	gameState: string | null; // dehydrated game state
	peerState: string | null; // dehydrated peer state
	opponentId: string | null;
	myPeerId: string | null;
	role: number | null; // PeerRole enum value
	lastStateHash: string | null;
	timestamp: number;
	isConnected: boolean;
}

const initialGameSession: GameSession = {
	game: null,
	peerState: null,
	dataConnection: null,
	isConnected: false,
	opponentId: null,
	opponentDisconnected: false,
	disconnectedAt: null,
	reconnectionTimeout: 60000, // 60 seconds
	reconnectedAt: null,
	lastError: null
};

const initialPersistedData: PersistedSessionData = {
	gameState: null,
	peerState: null,
	opponentId: null,
	myPeerId: null,
	role: null,
	lastStateHash: null,
	timestamp: 0,
	isConnected: false
};

export const gameSession = writable<GameSession>(initialGameSession);
export const persistedSessionData = persisted<PersistedSessionData>(
	'game-session',
	initialPersistedData
);

export const gameSessionActions = {
	setGameSession: (session: Partial<GameSession>) => {
		gameSession.update((current) => ({ ...current, ...session }));
	},

	clearGameSession: () => {
		gameSession.set(initialGameSession);
	},

	updateGame: (game: Game) => {
		gameSession.update((current) => ({ ...current, game }));
	},

	updatePeerState: (peerState: PeerState) => {
		gameSession.update((current) => ({ ...current, peerState }));
	},

	setConnection: (dataConnection: DataConnection, opponentId: string) => {
		gameSession.update((current) => ({
			...current,
			dataConnection,
			opponentId,
			isConnected: true
		}));
	},

	disconnect: () => {
		gameSession.update((current) => ({
			...current,
			dataConnection: null,
			opponentId: null,
			isConnected: false
		}));
	},

	markOpponentDisconnected: () => {
		gameSession.update((current) => ({
			...current,
			opponentDisconnected: true,
			// keep the original time so repeated events don't restart the countdown
			disconnectedAt: current.opponentDisconnected ? current.disconnectedAt : Date.now(),
			isConnected: false
		}));
	},

	markOpponentReconnected: (dataConnection: DataConnection, announce?: boolean) => {
		gameSession.update((current) => ({
			...current,
			reconnectedAt:
				(announce ?? current.opponentDisconnected) ? Date.now() : current.reconnectedAt,
			opponentDisconnected: false,
			disconnectedAt: null,
			dataConnection,
			isConnected: true
		}));
	},

	setError: (lastError: string | null) => {
		gameSession.update((current) => ({ ...current, lastError }));
	},

	persistGameState: (game: Game | null, peerState: PeerState | null, myPeerId: string | null) => {
		if (!game || !peerState || !myPeerId) {
			persistedSessionData.set(initialPersistedData);
			return;
		}

		const dehydrated = game.dehydrate();

		const data: PersistedSessionData = {
			gameState: dehydrated,
			peerState: peerState.dehydrate(),
			opponentId: peerState.them,
			myPeerId: myPeerId,
			role: peerState.role,
			lastStateHash: peerState.lastHash,
			timestamp: Date.now(),
			isConnected: true
		};

		persistedSessionData.set(data);
	},

	clearPersistedState: () => {
		persistedSessionData.set(initialPersistedData);
	}
};
