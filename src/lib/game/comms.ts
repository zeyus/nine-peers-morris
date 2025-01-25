import { Player, NinePeersMorris, Game } from "./game";

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

export type PeerMessage = {
    command: PeerCommands;
    stateHash: string;
    newStateHash?: string;
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

abstract class PeerStatus {
    me: string;
    them: string;
    state: PeerState;
    protected game: Game | null = null;

    constructor(me: string, them: string) {
        this.me = me;
        this.them = them;
        this.state = PeerState.Connecting;
    }

    abstract startGame(win: Window): void;

    handleMessage(msg: PeerMessage): void {
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
    
    send(msg: PeerMessage): void {
        //
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
    }

    startGame(win: Window): void {
        const me = new Player(this.me, 'O', false);
        const them = new Player(this.them, 'X', true);
        this.game = new NinePeersMorris(win, me, them);
    }
}
