<script lang="ts">
    import { Peer } from "$lib/peerjs/peer";
    import { type DataConnection } from "$lib/peerjs/dataconnection/DataConnection";
    import { util } from "$lib/peerjs/util";
    import { getUUID } from '$lib/game/hashable';
    import { onMount } from 'svelte';
    import { peerServerConf } from '$lib/peer-config';
    import { peerConfig } from '$lib/persisted-store';
    import { Spinner, Modal, Button, ButtonGroup } from 'flowbite-svelte';
    import PeerList from '../components/peer-list.svelte';

    let p: Peer | null = $state(null);
    let supported: boolean | null = $state(null);
    let them: string | null = $state(null);
    let dataConnection: DataConnection | null = $state(null);

    onMount(() => {
        if (!util.supports.data) {
            supported = false;
            return;
        } 
        supported = true;
        if (!$peerConfig.pId) {
            peerConfig.set({ pId: getUUID(window) });
        }
        p = new Peer($peerConfig.pId!, peerServerConf);

        

        p.on('open', (id) => {
            peerConfig.set({ pId: id });
        });

        p.on('connection', function(conn) {
            console.log('connection');
            dataConnection = conn;
            them = conn.peer;
            dataConnection?.on('data', function(data){
                // Will print 'hi!'
                console.log('receiving data');
                console.log(data);
            });
        });
        

        p.on('error', (err) => {
            console.error(err);
            them = null;
            dataConnection = null;
        });
        
    });
    let modalVisible = $state(false);
    const onConnectRequest = (pId: string) => {
        console.log('connecting to', pId);
        if (p) {
            dataConnection = p.connect(pId);
            dataConnection!.on('open', () => {
                console.log('dataConnection open');
                dataConnection!.send('');
            });
            them = pId;
            console.log('dataConnection', dataConnection);
            modalVisible = true;
        }
    };
</script>
{#if p && $peerConfig.pId}
    <h1>Peer ID: {$peerConfig.pId}</h1>
    <h2>Peers</h2>
    <PeerList pId={$peerConfig.pId} {onConnectRequest} />
    {#if modalVisible}
        <Modal title="Connecting" open={modalVisible} on:close={() => modalVisible = false} dismissable={false}>
            <p>Game request from {them}, would you like to play?</p>
            <ButtonGroup>
                <Button color="green" onclick={() => {
                    console.log('accepting');
                    dataConnection!.send('accept');
                    modalVisible = false;
                }}>Accept</Button>
                <Button color="red" onclick={() => {
                    console.log('rejecting');
                    dataConnection!.send('reject');
                    modalVisible = false;
                }}>Reject</Button>
            </ButtonGroup>
        </Modal>
    {/if}
    {#if them}
        <p>Connected to {them}</p>
    {/if}
    {#if dataConnection}
        <button onclick={() => {
            console.log('sending data');
            dataConnection!.send('hi!');
        }}>Send</button>
    {/if}
{:else}
    {#if supported === false}
        <p>Sorry, your browser does not support WebRTC</p>
    {:else}
        <Spinner />
    {/if}
{/if}
