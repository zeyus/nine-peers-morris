import { persisted } from 'svelte-persisted-store';

export const peerConfig = persisted('peerConfig', {
    pId: crypto.randomUUID().toString(),
});
