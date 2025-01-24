<script lang="ts">
    import { onMount } from 'svelte';
    import { peerListPath } from '$lib/peer-config';
    import Peer from './peer.svelte';

    let peers: string[] = $state([]);
    let { pId, onConnectRequest }: { pId: string, onConnectRequest: (pId: string) => void } = $props();

    const getPeerList = async (me: string) => {
        const response = await fetch(peerListPath);
        const data = await response.json();
        // filter out own id
        return data.filter((id: string) => id !== me);
    }

    onMount(() => {
        getPeerList(pId).then((peerList) => {
            peers = peerList;
        });
    });
</script>
{#each peers as peer}
    <Peer {peer} {onConnectRequest} />
{/each}
