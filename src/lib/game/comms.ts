import { Peer } from '../../thirdparty/peerjs/peer';
import { type DataConnection } from '../../thirdparty/peerjs/dataconnection/DataConnection';
import { util } from '../../thirdparty/peerjs/util';
import { peerServerConf } from '#lib/peer-config.js';
import { get } from 'svelte/store';
import { peerConfig, type PersistedPeerConfig } from '#lib/persisted-store.js';
import { Player, NinePeersMorris, Game } from './game';
import { getHash, getUUID } from './hashable';
import type { Hydratable } from './hydratable';

export const enum PeerCommands {
	Helo = 'HELO',
	Elho = 'EHLO',
	PlayWithMe = 'PLAY_WITH_ME',
	LetsPlay = 'LETS_PLAY',
	Roll = 'ROLL',
	RollResult = 'ROLL_RESULT',
	NoThanks = 'NO_THANKS',
	PeerBlocked = 'PEER_BLOCKED',
	Play = 'PLAY',
	YourTurn = 'YOUR_TURN',
	OK = 'OK',
	Error = 'ERROR',
	HashMismatch = 'HASH_MISMATCH',
	GameOver = 'GAME_OVER',
	Move = 'MOVE',
	MoveAck = 'MOVE_ACK',
	SyncRequest = 'SYNC_REQUEST',
	SyncResponse = 'SYNC_RESPONSE',
	Forfeit = 'FORFEIT'
}

const KNOWN_COMMANDS: ReadonlySet<string> = new Set([
	'HELO',
	'EHLO',
	'PLAY_WITH_ME',
	'LETS_PLAY',
	'ROLL',
	'ROLL_RESULT',
	'NO_THANKS',
	'PEER_BLOCKED',
	'PLAY',
	'YOUR_TURN',
	'OK',
	'ERROR',
	'HASH_MISMATCH',
	'GAME_OVER',
	'MOVE',
	'MOVE_ACK',
	'SYNC_REQUEST',
	'SYNC_RESPONSE',
	'FORFEIT'
]);

/** Upper bound on an incoming message, a full game state is well under this */
const MAX_MESSAGE_LENGTH = 64 * 1024;

export const enum PeerRole {
	Host,
	Client
}

export type PeerMessage = {
	command: PeerCommands;
	stateHash: string | null; // this should only be null for the first message
	newStateHash: string;
	data: string;
};

export type PeerMessageHandler = (msg: PeerMessage) => void;

export const enum PeerStatus {
	Connecting,
	Accepted,
	Rejected,
	Playing,
	Blocked
}

/** Thrown when the peers' game states have diverged */
export class HashMismatchError extends Error {
	constructor(message = 'Hash mismatch') {
		super(message);
		this.name = 'HashMismatchError';
	}
}

export class PeerData {
	/**
	 * Parses a raw message from the peer. Returns null for anything that is not a
	 * well-formed message with a known command.
	 */
	static dataToPeerMessage(rawData: unknown): PeerMessage | null {
		if (typeof rawData !== 'string' || rawData.length > MAX_MESSAGE_LENGTH) {
			return null;
		}
		const parts = rawData.split(':');
		if (parts.length < 4 || !KNOWN_COMMANDS.has(parts[0])) {
			return null;
		}
		const command = parts[0];
		const stateHash = parts[1] === '' ? null : parts[1];
		const newStateHash = parts[2];
		const data = parts.slice(3).join(':');
		return {
			command: command as PeerCommands,
			stateHash,
			newStateHash,
			data
		};
	}

	static peerMessageToData(msg: PeerMessage): string {
		return `${msg.command}:${msg.stateHash || ''}:${msg.newStateHash}:${msg.data}`;
	}
}

type SyncReason = 'reconnect' | 'mismatch';

export abstract class PeerState implements Hydratable {
	me: string;
	them: string;
	state: PeerStatus;
	role: PeerRole = PeerRole.Host;
	protected lastStateHash: string | null = null;
	protected game: Game | null = null;
	/** Set while we are waiting for the peer to answer our sync request */
	protected pendingSync: SyncReason | null = null;
	// incoming and outgoing messages are processed strictly in order so that
	// each message's stateHash is checked against the result of the previous one
	private queue: Promise<unknown> = Promise.resolve();

	constructor(me: string, them: string) {
		this.me = me;
		this.them = them;
		this.state = PeerStatus.Connecting;
	}

	getHost(): string {
		return this.role === PeerRole.Host ? this.me : this.them;
	}

	getGame(): Game | null {
		return this.game;
	}

	get lastHash(): string | null {
		return this.lastStateHash;
	}

	private enqueue<T>(fn: () => Promise<T>): Promise<T> {
		const task = this.queue.then(fn);
		this.queue = task.catch(() => undefined);
		return task;
	}

	async updateStateHash(): Promise<boolean> {
		if (!this.game) return false;
		const snapshot = this.game.dehydrate();
		return this.enqueue(async () => {
			this.lastStateHash = await getHash(window, snapshot);
			return true;
		});
	}

	dehydrate(): string {
		const obj = {
			me: this.me,
			them: this.them,
			state: this.state,
			role: this.role,
			lastStateHash: this.lastStateHash,
			gameState: null
		};
		return JSON.stringify(obj);
	}

	static rehydrate(data: string, game: Game): PeerState {
		const obj = JSON.parse(data);
		// See which role to instantiate
		let peerState: PeerState;
		if (obj.role === PeerRole.Host) {
			peerState = new GameHost(obj.me, obj.them);
		} else {
			peerState = new GameClient(obj.me, obj.them);
		}
		peerState.state = obj.state;
		peerState.role = obj.role;
		peerState.lastStateHash = obj.lastStateHash;
		peerState.game = game;
		return peerState;
	}

	abstract startGame(win: Window, game?: Game | null): void;

	/**
	 * Validates and applies a message from the peer. Messages are processed one at a
	 * time in arrival order. Throws HashMismatchError when the games have diverged
	 * (the caller should request a sync) and Error for invalid messages.
	 */
	handleMessage(msg: PeerMessage): Promise<void> {
		return this.enqueue(() => this.processMessage(msg));
	}

	private async processMessage(msg: PeerMessage): Promise<void> {
		// Validate that the sender's previous state hash matches our current state.
		// The handshake starts without a state, and sync/forfeit messages are how
		// out-of-sync peers recover, so they are exempt.
		const exempt =
			(msg.command === PeerCommands.Helo && msg.stateHash === null) ||
			(msg.command === PeerCommands.Elho && this.lastStateHash === null) ||
			msg.command === PeerCommands.SyncRequest ||
			msg.command === PeerCommands.SyncResponse ||
			msg.command === PeerCommands.HashMismatch ||
			msg.command === PeerCommands.Forfeit;
		if (!exempt && msg.stateHash !== this.lastStateHash) {
			throw new HashMismatchError('State hash mismatch - games are out of sync');
		}

		switch (msg.command) {
			case PeerCommands.SyncRequest:
			case PeerCommands.HashMismatch:
				// answered by the connection layer (SyncResponse / SyncRequest)
				return;
			case PeerCommands.SyncResponse:
				return this.applySyncResponse(msg);
			case PeerCommands.Forfeit:
				this.game?.forfeit(this.them);
				return;
			case PeerCommands.Move:
				return this.applyMoveMessage(msg);
			default: {
				const hash = await this._getHash(false, msg.data);
				if (msg.newStateHash !== hash) {
					throw new HashMismatchError();
				}
				this.lastStateHash = msg.newStateHash;
			}
		}
	}

	private async applyMoveMessage(msg: PeerMessage): Promise<void> {
		if (!this.game) {
			throw new Error('No game in progress');
		}
		let moveData: unknown;
		try {
			moveData = JSON.parse(msg.data);
		} catch {
			throw new Error('Malformed move received');
		}
		if (!this.game.applyMove(moveData)) {
			throw new Error('Invalid move received');
		}
		// snapshot synchronously so later local changes can't leak into the hash
		const hash = await getHash(window, this.game.dehydrate());
		if (hash !== msg.newStateHash) {
			throw new HashMismatchError('Game state differs from peer after move');
		}
		this.lastStateHash = hash;
	}

	private async applySyncResponse(msg: PeerMessage): Promise<void> {
		const reason = this.pendingSync;
		if (!reason || !this.game) {
			throw new Error('Unexpected sync response');
		}
		const game = this.game;
		const before = game.dehydrate();
		const beforeTurn = game.getTurn.valueOf();
		const beforeWinner = game.getWinner;
		const localBefore = game.localPlayer?.pieceCount ?? 0;

		game.restore(msg.data);

		// A resync after a mismatch must not let the peer rewrite history in its favour
		if (
			reason === 'mismatch' &&
			(game.getTurn.valueOf() !== beforeTurn ||
				(game.getWinner !== null && game.getWinner !== beforeWinner) ||
				(game.localPlayer?.pieceCount ?? 0) < localBefore)
		) {
			game.restore(before);
			throw new Error('Rejected sync state from peer');
		}
		const hash = await getHash(window, game.dehydrate());
		if (hash !== msg.newStateHash) {
			game.restore(before);
			throw new HashMismatchError('Sync state hash mismatch');
		}
		this.pendingSync = null;
		this.lastStateHash = hash;
	}

	/**
	 * Builds the next outgoing message. The game state is captured synchronously
	 * (before any await) and messages are hashed in call order.
	 */
	prepareMessage(command: PeerCommands, data: string): Promise<PeerMessage> {
		const snapshot = this.game ? this.game.dehydrate() : null;
		return this.enqueue(async () => {
			const newStateHash =
				snapshot !== null ? await getHash(window, snapshot) : await this._getHash(true, data);
			const msg: PeerMessage = {
				command,
				stateHash: this.lastStateHash,
				newStateHash,
				data
			};
			this.lastStateHash = newStateHash;
			return msg;
		});
	}

	private async _getHash(outgoing: boolean, data?: string): Promise<string> {
		const win = window || null;
		if (win === null) {
			throw new Error('No window object');
		}
		const recipient = outgoing ? this.them : this.me;
		return (
			(await this.game?.getStateHash()) ||
			(await getHash(win, `${this.getHost()}:${recipient}:${data}`))
		);
	}

	async messageFromCommand(command: PeerCommands, data: string = ''): Promise<string> {
		const msg = await this.prepareMessage(command, data);
		return PeerData.peerMessageToData(msg);
	}

	async sendMove(moveData: object): Promise<string> {
		const moveJson = JSON.stringify(moveData);
		return await this.messageFromCommand(PeerCommands.Move, moveJson);
	}

	/** Builds a request asking the peer for its full game state */
	requestSync(reason: SyncReason): Promise<string> {
		this.pendingSync = reason;
		return this.messageFromCommand(PeerCommands.SyncRequest);
	}

	/** Builds a response carrying our full game state */
	syncResponse(): Promise<string> {
		return this.messageFromCommand(PeerCommands.SyncResponse, this.game?.dehydrate() ?? '');
	}
}

export class GameHost extends PeerState {
	constructor(me: string, them: string) {
		super(me, them);
	}

	startGame(win: Window, game?: Game | null): void {
		const me = new Player(this.me, 'X', true);
		const them = new Player(this.them, 'O', false);
		this.game = game ? game : new NinePeersMorris(win, me, them, this.me);
	}

	static rehydrate(data: string, game: Game): GameHost {
		const obj = JSON.parse(data);
		const host = new GameHost(obj.me, obj.them);
		host.state = obj.state;
		host.role = obj.role;
		host.lastStateHash = obj.lastStateHash;
		host.game = game;
		return host;
	}
}

export class GameClient extends PeerState {
	constructor(me: string, them: string) {
		super(me, them);
		this.role = PeerRole.Client;
	}

	startGame(win: Window, game?: Game | null): void {
		const me = new Player(this.me, 'O', false);
		const them = new Player(this.them, 'X', true);
		this.game = game ? game : new NinePeersMorris(win, me, them, this.me);
	}

	static rehydrate(data: string, game: Game): GameClient {
		const obj = JSON.parse(data);
		const client = new GameClient(obj.me, obj.them);
		client.state = obj.state;
		client.role = obj.role;
		client.lastStateHash = obj.lastStateHash;
		client.game = game;

		return client;
	}
}

// option 2: handle all the peerjs stuff here
// rather than having this logic in the components (or in the state)...
// this might make more sense?
// i don't like any of this having to have a window object
// but the there's no crypto without it
export class PeerBroker {
	private peer: Peer;
	private win: Window;
	id: string;
	conf: PersistedPeerConfig;
	channel: DataConnection | null = null;
	them: string | null = null;
	state: PeerState | null = null;

	constructor(win: Window, conf: PersistedPeerConfig) {
		if (!util.supports.data) {
			//throw new Error('DataChannel not supported');
		}
		this.win = win;
		this.conf = conf;
		const currentId = get(peerConfig).pId;
		if (currentId) {
			this.id = currentId;
		} else {
			this.id = getUUID(this.win);
			peerConfig.set({ pId: this.id });
		}
		this.peer = new Peer(this.id, peerServerConf);
		this.peer.on('connection', (conn) => {
			this.channel = conn;
			this.them = conn.peer;
			this.channel.on('data', (data) => {
				console.log(data);
			});
		});
		this.peer.on('error', (err) => {
			console.error(err);
			this.channel = null;
			this.them = null;
		});
	}

	connect(peerId: string): void {
		if (!this.channel) {
			this.channel = this.peer.connect(peerId);
			this.them = peerId;
			this.channel?.on('data', (data) => {
				this._dataToPeerMessage(data, peerId);
			});
		}
	}

	private async _dataToPeerMessage(data: unknown, sender: string): Promise<PeerMessage | null> {
		if (typeof data !== 'string') {
			throw new Error('Invalid data type');
		}
		return this._parsePeerMessage(data, sender);
	}

	private async _parsePeerMessage(data: string, sender: string): Promise<PeerMessage | null> {
		try {
			if (data.length < 65) {
				//must be more than a hash, lame check
				return null;
			}
			const messageHash = data.slice(0, 64);

			const contents = data.slice(64);

			const computedHash = await getHash(this.win, contents + sender);
			if (computedHash !== messageHash) {
				//console.error(`Hash mismatch: expected ${messageHash}, got ${computedHash}`);
				return null;
			}

			const msg = JSON.parse(contents) as PeerMessage;
			if (msg.command && msg.stateHash && msg.data) {
				return msg;
			} else {
				return null;
			}
		} catch {
			return null;
		}
	}

	private async _packagePeerMessage(msg: PeerMessage): Promise<string> {
		const contents = JSON.stringify(msg);
		const hash = await getHash(this.win, contents + this.id);
		return hash + contents;
	}
}
