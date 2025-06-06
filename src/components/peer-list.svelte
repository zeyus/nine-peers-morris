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
            console.log('Loaded peers:', peerList);
            peers = peerList;
        }).catch(error => {
            console.error('Error loading peers:', error);
        });
    });
</script>
<div class="space-y-3">
    {#if peers.length === 0}
        <div class="text-center py-8">
            <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
            </svg>
            <p class="text-gray-500 font-medium">No other players online</p>
            <p class="text-sm text-gray-400 mt-1">Share your Peer ID with friends to play together!</p>
        </div>
    {:else}
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {#each peers as peer}
                <Peer {peer} {onConnectRequest} />
            {/each}
        </div>
    {/if}
</div>
