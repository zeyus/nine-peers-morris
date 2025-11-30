import { Peer } from '../../thirdparty/peerjs/peer';
import { type DataConnection } from '../../thirdparty/peerjs/dataconnection/DataConnection';
import { util } from '../../thirdparty/peerjs/util';
import { peerServerConf } from '$lib/peer-config';
import { get } from 'svelte/store';
import { peerConfig, type PersistedPeerConfig } from '$lib/persisted-store';
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
	SyncResponse = 'SYNC_RESPONSE'
}

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

export class PeerData {
	static dataToPeerMessage(rawData: string): PeerMessage {
		const parts = rawData.split(':');
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

export abstract class PeerState implements Hydratable {
	me: string;
	them: string;
	state: PeerStatus;
	role: PeerRole = PeerRole.Host;
	protected lastStateHash: string | null = null;
	protected game: Game | null = null;

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

	async updateStateHash(): Promise<boolean> {
		if (this.game) {
			this.lastStateHash = await this.game.getStateHash();
			return true;
		}
		return false;
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
	// option 1, handle message in the state/Comms
	async handleMessage(msg: PeerMessage): Promise<void> {
		console.log(`Received message: ${msg.command}`);
		console.log(`(msg)stateHash: ${msg.stateHash}`);
		console.log(`lastStateHash: ${this.lastStateHash}`);
		console.log(`data: ${msg.data}`);

		// Always validate that the sender's state hash matches our current state
		// Exception: HELO and EHLO messages can have null stateHash for initial handshake
		if (
			msg.stateHash !== this.lastStateHash &&
			!(msg.command === PeerCommands.Helo && msg.stateHash === null) &&
			!(msg.command === PeerCommands.Elho && this.lastStateHash === null)
		) {
			console.error('State hash mismatch - games are out of sync');
			throw new Error('Hash mismatch');
		}

		if (msg.command === PeerCommands.SyncRequest) {
			// Opponent is requesting current game state (reconnection scenario)
			console.log('Received sync request from opponent');
			// Will be handled by the component to send back game state
		} else if (msg.command === PeerCommands.SyncResponse) {
			// Received game state from opponent after reconnection
			console.log('Received sync response with game state');
			// Will be handled by the component to restore game state
		} else if (msg.command === PeerCommands.Move) {
			// Opponent made a move, apply it to our game
			if (this.game && msg.data) {
				try {
					const moveData = JSON.parse(msg.data);
					console.log('Received move from opponent:', moveData);

					// Apply the move to our game instance
					const success = this.game.applyMove(moveData);
					if (success) {
						// Update our state hash to reflect the new game state
						this.lastStateHash = await this.game.getStateHash();
						console.log('Move applied successfully, new hash:', this.lastStateHash);

						// Force a reactive update by triggering the turn counter
						// This ensures Svelte detects the game state change
						if (this.game.getTurn) {
							this.game.getTurn.value = this.game.getTurn.valueOf();
						}
					} else {
						console.error('Failed to apply opponent move');
						throw new Error('Invalid move received');
					}
				} catch (error) {
					console.error('Error applying opponent move:', error);
					throw error;
				}
			}
		} else {
			// For other messages, validate the computed hash
			const hash = await this._getHash(false, msg.data);
			console.log(`Computed hash: ${hash}`);
			console.log(`(msg)New State Hash: ${msg.newStateHash}`);

			if (msg.newStateHash !== hash) {
				throw new Error('Hash mismatch');
			}
			this.lastStateHash = msg.newStateHash;
		}

		if (msg.command === PeerCommands.Play) {
			if (this.state === PeerStatus.Connecting) {
				//
			}
		} else if (msg.command === PeerCommands.YourTurn) {
			if (this.state === PeerStatus.Playing) {
				//
			}
		} else if (msg.command === PeerCommands.GameOver) {
			if (this.state === PeerStatus.Playing) {
				//
			}
		}
	}

	async prepareMessage(command: PeerCommands, data: string): Promise<PeerMessage> {
		const msg: PeerMessage = {
			command,
			stateHash: this.lastStateHash,
			newStateHash: await this._getHash(true, data),
			data
		};
		// update lastStateHash
		this.lastStateHash = msg.newStateHash!;
		return msg;
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
}

export class GameHost extends PeerState {
	constructor(me: string, them: string) {
		super(me, them);
	}

	startGame(win: Window, game?: Game | null): void {
		const me = new Player(this.me, 'X', true);
		const them = new Player(this.them, 'O', false);
		this.game = game ? game : new NinePeersMorris(win, me, them);
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
		this.game = game ? game : new NinePeersMorris(win, me, them);
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
