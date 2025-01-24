<script lang="ts">
    let { peer, onConnectRequest }: { peer: string, onConnectRequest: (pId: string) => void } = $props();
    import { Button, Modal, Spinner } from 'flowbite-svelte';
    import { UserOutline } from 'flowbite-svelte-icons';
    let defaultModal = $state(false);
</script>
<Modal bind:open={defaultModal}>
    <div class="p-4">
        <h1 class="text-2xl font-bold text-gray-900">Connecting to {peer}</h1>
        <Button class="mt-4" color="primary" onclick={() => {onConnectRequest(peer); defaultModal=false}}>Connect</Button>
        <Button class="mt-4" color="alternative" onclick={() => (defaultModal=false)}>Cancel</Button>
    </div>
</Modal>
<div class="flex flex-col items-center justify-center">
    <UserOutline class="w-12 h-12 text-gray-500" />
    <h1 class="text-2xl font-bold text-gray-900">Peer ID: {peer}</h1>
    <Button class="mt-4" color="primary" onclick={() => (defaultModal=true)}>Connect</Button>
</div>
