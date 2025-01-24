import { persisted, type Persisted } from 'svelte-persisted-store';

export const peerConfig: Persisted<{
    pId: string | null;
}> = persisted('peerConfig', {
    pId: null,
});
