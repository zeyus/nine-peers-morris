import { writable } from 'svelte/store';
import type { Game } from './game/game';
import type { PeerState } from './game/comms';
import type { DataConnection } from './peerjs/dataconnection/DataConnection';

export interface GameSession {
    game: Game | null;
    peerState: PeerState | null;
    dataConnection: DataConnection | null;
    isConnected: boolean;
    opponentId: string | null;
}

const initialGameSession: GameSession = {
    game: null,
    peerState: null,
    dataConnection: null,
    isConnected: false,
    opponentId: null
};

export const gameSession = writable<GameSession>(initialGameSession);

export const gameSessionActions = {
    setGameSession: (session: Partial<GameSession>) => {
        gameSession.update(current => ({ ...current, ...session }));
    },
    
    clearGameSession: () => {
        gameSession.set(initialGameSession);
    },
    
    updateGame: (game: Game) => {
        gameSession.update(current => ({ ...current, game }));
    },
    
    updatePeerState: (peerState: PeerState) => {
        gameSession.update(current => ({ ...current, peerState }));
    },
    
    setConnection: (dataConnection: DataConnection, opponentId: string) => {
        gameSession.update(current => ({ 
            ...current, 
            dataConnection, 
            opponentId,
            isConnected: true 
        }));
    },
    
    disconnect: () => {
        gameSession.update(current => ({ 
            ...current, 
            dataConnection: null,
            opponentId: null,
            isConnected: false 
        }));
    }
};