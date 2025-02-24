import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PeerBroker, PeerData, GameHost, PeerRole, type PeerMessage } from './comms';
import { peerConfig, type PersistedPeerConfig } from '$lib/persisted-store';
import { getHash } from "$lib/game/hashable";


const crypto = {
    subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array(256/8))
    },
    randomUUID: vi.fn().mockReturnValue('test-uuid')
};

if (!globalThis.crypto) {
    /** @ts-expect-error mock */
    globalThis.crypto = crypto;
}

if (!globalThis.window) {
    /** @ts-expect-error mock */
    globalThis.window = {};
}

if (!globalThis.window.crypto) {
    /** @ts-expect-error mock */
    globalThis.window.crypto = crypto;
}

describe('Comms', () => {
    const validHash = '7509e5bda0c762d2bac7f90d758b5b2263fa01ccbc542ab5e3df163be08e6ca9';
    let win: Window;
    let conf: PersistedPeerConfig;

    vi.mock('$lib/peerjs/peer');
    vi.mock('$lib/peerjs/dataconnection/DataConnection');
    vi.mock('$lib/persisted-store');
    vi.mock('$lib/game/hashable');

    describe('PeerBroker', () => {
        beforeEach(async () => {
            win = window;
            /** @ts-expect-error this is a mock implementation */
            conf = { pId: 'test-id' };
            peerConfig.set = vi.fn();
            /**  @ts-expect-error this is a mock implementation */
            peerConfig.get = vi.fn().mockReturnValue({ pId: 'test-id' });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            peerConfig.subscribe = vi.fn((cb: (v: any) => void) => { cb(conf); return vi.fn() });
        });

        it('should initialize with correct id', () => {
            const broker = new PeerBroker(win, conf);
            expect(broker.id).toBe('test-id');
        });

        it('should connect to a peer', () => {
            const broker = new PeerBroker(win, conf);
            broker.connect('peer-id');
            expect(broker.channel).not.toBeNull();
            expect(broker.them).toBe('peer-id');
        });

        it('should handle data received from peer', async () => {
            vi.mocked(getHash).mockResolvedValue(validHash);
            const broker = new PeerBroker(win, conf);
            const data = {
                command: 'HELO',
                stateHash: validHash,
                newStateHash: validHash,
                data: 'somedata'
            } as PeerMessage;
            const preparedData = await broker['_packagePeerMessage'](data);
            expect(preparedData).not.toBeNull();
            const message = await broker['_dataToPeerMessage'](preparedData, broker.id);
            expect(message).not.toBeNull();
            expect(message?.command).toBe('HELO');
        });

        it('should handle invalid data type', async () => {
            const broker = new PeerBroker(win, conf);
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await expect(broker['_dataToPeerMessage'](123 as any, 'peer-id')).rejects.toThrow('Invalid data type');
        });

        it('should return null for invalid message length', async () => {
            const broker = new PeerBroker(win, conf);
            const message = await broker['_dataToPeerMessage']('short', broker.id);
            expect(message).toBeNull();
        });

        it('should return null for invalid hash', async () => {
            vi.mocked(getHash).mockResolvedValue('invalidhash');
            const broker = new PeerBroker(win, conf);
            const data = 'validhash' + JSON.stringify({
                command: 'PLAY',
                stateHash: 'somehash',
                data: 'somedata'
            });
            const message = await broker['_dataToPeerMessage'](data, 'peer-id');
            expect(message).toBeNull();
        });

        it('should return null for invalid JSON', async () => {
            vi.mocked(getHash).mockResolvedValue(validHash);
            const broker = new PeerBroker(win, conf);
            const data = validHash + 'invalidjson';
            const message = await broker['_dataToPeerMessage'](data, 'peer-id');
            expect(message).toBeNull();
        });

        it('should return null for missing fields in message', async () => {
            vi.mocked(getHash).mockResolvedValue(validHash);
            const broker = new PeerBroker(win, conf);
            const data = validHash + JSON.stringify({
                command: 'PLAY',
                data: 'somedata'
            });
            const message = await broker['_dataToPeerMessage'](data, 'peer-id');
            expect(message).toBeNull();
        });
    });

    describe('PeerData', () => {
        it('should convert raw data to PeerMessage', () => {
            const rawData = 'HELO:stateHash:newStateHash:data';
            const message = PeerData.dataToPeerMessage(rawData);
            expect(message).toEqual({
                command: 'HELO',
                stateHash: 'stateHash',
                newStateHash: 'newStateHash',
                data: 'data',
            });
        });

        it('should handle null stateHash in raw data', () => {
            const rawData = 'HELO::newStateHash:data';
            const message = PeerData.dataToPeerMessage(rawData);
            expect(message).toEqual({
                command: 'HELO',
                stateHash: null,
                newStateHash: 'newStateHash',
                data: 'data',
            });
        });

        it('should convert PeerMessage to raw data', () => {
            const message: PeerMessage = {
                command: 'HELO',
                stateHash: 'stateHash',
                newStateHash: 'newStateHash',
                data: 'data',
            } as PeerMessage;
            const rawData = PeerData.peerMessageToData(message);
            expect(rawData).toBe('HELO:stateHash:newStateHash:data');
        });

        it('should handle null stateHash in PeerMessage', () => {
            const message: PeerMessage = {
                command: 'HELO',
                stateHash: null,
                newStateHash: 'newStateHash',
                data: 'data',
            } as PeerMessage;
            const rawData = PeerData.peerMessageToData(message);
            expect(rawData).toBe('HELO::newStateHash:data');
        });
    });
    describe('GameHost', () => {
        let gameHost: GameHost;
        let win: Window;

        beforeEach(() => {
            win = window;
            gameHost = new GameHost('player1', 'player2');
        });

        it('should initialize with correct players', () => {
            expect(gameHost.me).toBe('player1');
            expect(gameHost.them).toBe('player2');
            expect(gameHost.role).toBe(PeerRole.Host);
        });

        it('should start game with correct players and roles', () => {
            gameHost.startGame(win);
            expect(gameHost['game']).not.toBeNull();
            expect(gameHost['game']?.['players'][0].id).toBe('player1');
            expect(gameHost['game']?.['players'][0].name).toBe('X');
            expect(gameHost['game']?.['players'][1].id).toBe('player2');
            expect(gameHost['game']?.['players'][1].name).toBe('O');
        });

        it('should handle message in the state/Comms', async () => {
            vi.mocked(getHash).mockResolvedValue(validHash);
            const msg = {
                command: 'PLAY',
                stateHash: null,
                newStateHash: validHash,
                data: 'data',
            } as PeerMessage;
            await gameHost.handleMessage(msg);
            expect(gameHost['lastStateHash']).toBe(validHash);
        });


    });
});
