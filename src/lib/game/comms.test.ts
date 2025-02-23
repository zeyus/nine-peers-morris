import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PeerBroker, type PeerMessage } from './comms';
import { peerConfig, type PersistedPeerConfig } from '$lib/persisted-store';
import { util } from "$lib/peerjs/util";
import { Peer } from "$lib/peerjs/peer";
import { DataConnection } from "$lib/peerjs/dataconnection/DataConnection";
import { getUUID } from '$lib/game/hashable';
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

if (!globalThis.window.crypto) {
    /** @ts-expect-error mock */
    globalThis.window.crypto = crypto;
}


vi.mock('$lib/peerjs/peer');
vi.mock('$lib/peerjs/dataconnection/DataConnection');
vi.mock('$lib/persisted-store');

describe('PeerBroker', () => {
    let win: Window;
    let conf: PersistedPeerConfig;

    vi.mock('$lib/peerjs/peer');
    vi.mock('$lib/peerjs/dataconnection/DataConnection');
    vi.mock('$lib/persisted-store');
    vi.mock('$lib/game/hashable');

    beforeEach(() => {
        win = window;
        conf = { pId: 'test-id' };
        peerConfig.set = vi.fn();
        peerConfig.get = vi.fn().mockReturnValue({ pId: 'test-id' });
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
        const broker = new PeerBroker(win, conf);
        const data = {
            command: 'PLAY',
            stateHash: 'somehash',
            data: 'somedata'
        } as PeerMessage;
        const preparedData = await broker['_packagePeerMessage'](data);
        const message = await broker['_dataToPeerMessage'](preparedData, 'peer-id');
        expect(message).not.toBeNull();
        expect(message?.command).toBe('PLAY');
    });

    it('should handle invalid data type', async () => {
        const broker = new PeerBroker(win, conf);
        await expect(broker['_dataToPeerMessage'](123 as any, 'peer-id')).rejects.toThrow('Invalid data type');
    });

    it('should return null for invalid message length', async () => {
        const broker = new PeerBroker(win, conf);
        const message = await broker['_dataToPeerMessage']('short', 'peer-id');
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
        vi.mocked(getHash).mockResolvedValue('validhash');
        const broker = new PeerBroker(win, conf);
        const data = 'validhash' + 'invalidjson';
        const message = await broker['_dataToPeerMessage'](data, 'peer-id');
        expect(message).toBeNull();
    });

    it('should return null for missing fields in message', async () => {
        vi.mocked(getHash).mockResolvedValue('validhash');
        const broker = new PeerBroker(win, conf);
        const data = 'validhash' + JSON.stringify({
            command: 'PLAY',
            data: 'somedata'
        });
        const message = await broker['_dataToPeerMessage'](data, 'peer-id');
        expect(message).toBeNull();
    });
});
