import { Player, NinePeersMorris, Game } from "./game";
import { getHash } from "./hashable";

export const enum PeerCommands {
    Helo = 'HELO',
    Elho = 'EHLO',
    PlayWithMe = 'PLAY_WITH_ME',
    IWillPlayWithYou = 'I_WILL_PLAY_WITH_YOU',
    IWontPlayWithYou = 'I_WONT_PLAY_WITH_YOU',
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

export const enum PeerState {
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

export abstract class PeerStatus {
    me: string;
    them: string;
    state: PeerState;
    role: PeerRole = PeerRole.Host;
    lastStateHash: string | null = null;
    protected game: Game | null = null;

    constructor(me: string, them: string) {
        this.me = me;
        this.them = them;
        this.state = PeerState.Connecting;
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
            if (this.state === PeerState.Connecting) {
                //
            }
        } else if (msg.command === PeerCommands.YourTurn) {
            if (this.state === PeerState.Playing) {
                // 
            }
        } else if (msg.command === PeerCommands.GameOver) {
            if (this.state === PeerState.Playing) {
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

export class GameHost extends PeerStatus {
    constructor(me: string, them: string) {
        super(me, them);
    }

    startGame(win: Window): void {
        const me = new Player(this.me, 'X', true);
        const them = new Player(this.them, 'O', false);
        this.game = new NinePeersMorris(win, me, them);
    }
}

export class GameClient extends PeerStatus {
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
