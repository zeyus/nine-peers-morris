<script lang="ts">
	let { peer, onConnectRequest }: { peer: string; onConnectRequest: (pId: string) => void } =
		$props();
	import { Modal } from 'flowbite-svelte';
	import { UserOutline } from 'flowbite-svelte-icons';
	let defaultModal = $state(false);
</script>

<Modal bind:open={defaultModal}>
	<div class="p-6 text-center">
		<div
			class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900"
		>
			<UserOutline class="h-8 w-8 text-blue-600 dark:text-blue-400" />
		</div>
		<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Connect to Player</h3>
		<p class="mb-6 text-gray-600 dark:text-gray-400">
			Send a game request to <span class="font-mono font-medium">{peer}</span>?
		</p>
		<div class="flex justify-center space-x-3">
			<button
				class="inline-flex items-center rounded-lg border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:bg-green-700 dark:hover:bg-green-600 dark:focus:ring-offset-gray-800"
				onclick={() => {
					console.log('Send Request clicked for peer:', peer);
					onConnectRequest(peer);
					defaultModal = false;
				}}
			>
				<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
					></path>
				</svg>
				Send Request
			</button>
			<button
				class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
				onclick={() => (defaultModal = false)}
			>
				Cancel
			</button>
		</div>
	</div>
</Modal>

<div
	class="rounded-lg border border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:shadow-gray-900"
>
	<div class="flex items-center space-x-3">
		<div class="flex-shrink-0">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700"
			>
				<UserOutline class="h-5 w-5 text-white" />
			</div>
		</div>
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">Player</p>
			<p class="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{peer}</p>
		</div>
		<div class="flex-shrink-0">
			<button
				class="inline-flex items-center rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800"
				onclick={() => {
					console.log('Challenge button clicked for peer:', peer);
					defaultModal = true;
				}}
			>
				<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 6v6m0 0v6m0-6h6m-6 0H6"
					></path>
				</svg>
				Challenge
			</button>
		</div>
	</div>
</div>
