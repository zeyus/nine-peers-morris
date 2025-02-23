import { Peer } from "$lib/peerjs/peer";
import { type DataConnection } from "$lib/peerjs/dataconnection/DataConnection";
import { util } from "$lib/peerjs/util";
import { peerServerConf } from '$lib/peer-config';
import { get } from 'svelte/store';
import { peerConfig, type PersistedPeerConfig } from '$lib/persisted-store';
import { Player, NinePeersMorris, Game } from "./game";
import { getHash, getUUID } from "./hashable";

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
}


export const enum PeerRole {
    Host,
    Client,
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
    Blocked,
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
            data,
        };
    }

    static peerMessageToData(msg: PeerMessage): string {
        return `${msg.command}:${msg.stateHash || ''}:${msg.newStateHash}:${msg.data}`;
    }
}

export abstract class PeerState {
    me: string;
    them: string;
    state: PeerStatus;
    role: PeerRole = PeerRole.Host;
    lastStateHash: string | null = null;
    protected game: Game | null = null;

    constructor(me: string, them: string) {
        this.me = me;
        this.them = them;
        this.state = PeerStatus.Connecting;
    }

    getHost(): string {
        return this.role === PeerRole.Host ? this.me : this.them;
    }

    abstract startGame(win: Window): void;

    async handleMessage(msg: PeerMessage): Promise<void> {
        // Check if the hash is valid
        const hash = await this._getHash(false, msg.data);
        if (msg.newStateHash !== hash || msg.stateHash !== this.lastStateHash) {
            throw new Error('Hash mismatch'); // @TODO: this is firing, have to figure out why
        }
        this.lastStateHash = msg.stateHash;
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
            data,
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
        return await this.game?.getStateHash() || await getHash(win, `${this.getHost()}:${recipient}:${data}`);

    }

    async messageFromCommand(command: PeerCommands, data: string = ''): Promise<string> {
        const msg = await this.prepareMessage(command, data);
        return PeerData.peerMessageToData(msg);
    }
}

export class GameHost extends PeerState {
    constructor(me: string, them: string) {
        super(me, them);
    }

    startGame(win: Window): void {
        const me = new Player(this.me, 'X', true);
        const them = new Player(this.them, 'O', false);
        this.game = new NinePeersMorris(win, me, them);
    }
}

export class GameClient extends PeerState {
    constructor(me: string, them: string) {
        super(me, them);
        this.role = PeerRole.Client;
    }

    startGame(win: Window): void {
        const me = new Player(this.me, 'O', false);
        const them = new Player(this.them, 'X', true);
        this.game = new NinePeersMorris(win, me, them);
    }
}


// wip: handle all the peerjs stuff here
// rather than having this logic in the components
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
            this.channel.on('data', (data) =>{
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
            if (data.length < 65) { //must be more than a hash, lame check
                return null;
            }
            const messageHash = data.slice(0, 64);
            
            const contents = data.slice(64);

            const computedHash = await getHash(this.win, contents+sender);
            if (computedHash !== messageHash) {
                console.error(`Hash mismatch: expected ${messageHash}, got ${computedHash}`);
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
        const hash = await getHash(this.win, contents+this.id);
        return hash + contents;
    }
}
