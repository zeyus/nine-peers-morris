<script lang="ts">
	import { onMount } from 'svelte';
	import { peerListPath } from '#lib/peer-config.js';
	import Peer from './peer.svelte';

	const REFRESH_INTERVAL = 10000;
	const MAX_ID_LENGTH = 64;

	let peers: string[] = $state([]);
	let { pId, onConnectRequest }: { pId: string; onConnectRequest: (pId: string) => void } =
		$props();

	const getPeerList = async (me: string): Promise<string[]> => {
		const response = await fetch(peerListPath);
		if (!response.ok) {
			throw new Error(`Peer list request failed: ${response.status}`);
		}
		const data: unknown = await response.json();
		if (!Array.isArray(data)) {
			return [];
		}
		// the list comes from a shared server: only keep sane ids and drop our own
		return [...new Set(data)].filter(
			(id): id is string =>
				typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH && id !== me
		);
	};

	const refresh = () =>
		getPeerList(pId)
			.then((peerList) => (peers = peerList))
			.catch((error) => console.error('Error loading peers:', error));

	onMount(() => {
		refresh();
		const timer = setInterval(refresh, REFRESH_INTERVAL);
		return () => clearInterval(timer);
	});
</script>

<div class="space-y-3">
	{#if peers.length === 0}
		<div class="py-8 text-center">
			<svg
				class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
				></path>
			</svg>
			<p class="font-medium text-gray-500 dark:text-gray-400">No other players online</p>
			<p class="mt-1 text-sm text-gray-400 dark:text-gray-500">
				Share your Peer ID with friends to play together!
			</p>
		</div>
	{:else}
		<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
			{#each peers as peer (peer)}
				<Peer {peer} {onConnectRequest} />
			{/each}
		</div>
	{/if}
</div>
