<script lang="ts">
    let { peer, onConnectRequest }: { peer: string, onConnectRequest: (pId: string) => void } = $props();
    import { Button, Modal, Spinner } from 'flowbite-svelte';
    import { UserOutline } from 'flowbite-svelte-icons';
    let defaultModal = $state(false);
</script>
<Modal bind:open={defaultModal}>
    <div class="text-center p-6">
        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserOutline class="w-8 h-8 text-blue-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Connect to Player</h3>
        <p class="text-gray-600 mb-6">Send a game request to <span class="font-mono font-medium">{peer}</span>?</p>
        <div class="flex justify-center space-x-3">
            <button 
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
                onclick={() => {
                    console.log('Send Request clicked for peer:', peer);
                    onConnectRequest(peer); 
                    defaultModal = false;
                }}>
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                </svg>
                Send Request
            </button>
            <button 
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
                onclick={() => (defaultModal=false)}>
                Cancel
            </button>
        </div>
    </div>
</Modal>

<div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
    <div class="flex items-center space-x-3">
        <div class="flex-shrink-0">
            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <UserOutline class="w-5 h-5 text-white" />
            </div>
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">Player</p>
            <p class="text-xs text-gray-500 font-mono truncate">{peer}</p>
        </div>
        <div class="flex-shrink-0">
            <button 
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                onclick={() => {
                    console.log('Challenge button clicked for peer:', peer);
                    defaultModal = true;
                }}>
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Challenge
            </button>
        </div>
    </div>
</div>
