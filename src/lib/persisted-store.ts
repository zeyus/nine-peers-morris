import { persisted, type Persisted } from 'svelte-persisted-store';

export type PeerConfig = {
    pId: string | null;
};

export type PersistedPeerConfig = Persisted<PeerConfig>;

export const peerConfig: PersistedPeerConfig = persisted('peerConfig', {
    pId: null,
});
