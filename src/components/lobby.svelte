<script lang="ts">
    import { Peer } from "$lib/peerjs/peer";
    import { type DataConnection } from "$lib/peerjs/dataconnection/DataConnection";
    import { util } from "$lib/peerjs/util";
    import { randomName } from "$lib/utils";
    import { getUUID } from '$lib/game/hashable';
    import { onMount } from 'svelte';
    import { peerServerConf } from '$lib/peer-config';
    import { peerConfig } from '$lib/persisted-store';
    import { Spinner, Modal, Button, ButtonGroup } from 'flowbite-svelte';
    import PeerList from '../components/peer-list.svelte';
    import { PeerCommands, GameHost, GameClient, PeerData, PeerRole, type PeerStatus } from "$lib/game/comms";

    let p: Peer | null = $state(null);
    let supported: boolean | null = $state(null);
    let them: string | null = $state(null);
    let dataConnection: DataConnection | null = $state(null);
    let role: PeerStatus | null = $state(null);
    let metadata: any = $state(null);

    onMount(() => {
        if (!util.supports.data) {
            supported = false;
            return;
        } 
        supported = true;
        if (!$peerConfig.pId) {
            // peerConfig.set({ pId: getUUID(window) });
            peerConfig.set({ pId: randomName() });
        }
        p = new Peer($peerConfig.pId!, peerServerConf);

        

        p.on('open', (id) => {
            peerConfig.set({ pId: id });
        });

        p.on('connection', function(conn) {
            console.log('connection');
            dataConnection = conn;
            them = conn.peer;
            metadata = conn.metadata;

            dataConnection?.on('data', function(data){
                if (!role && them) {
                    role = new GameClient($peerConfig.pId!, them);
                }
                const msg = PeerData.dataToPeerMessage(data as string);
                console.log(msg);
                role!.handleMessage(msg);

                if (role?.role === PeerRole.Client) {
                    if (msg.command === PeerCommands.Helo) {
                        role.messageFromCommand(PeerCommands.Elho).then((msg) => dataConnection!.send(msg));
                    } else if (msg.command === PeerCommands.PlayWithMe) {
                        modalVisible = true;
                    }
                }
                
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
            dataConnection = p.connect(pId, { metadata: { gameName: randomName() }});
            dataConnection!.on('open', () => {
                role = new GameHost($peerConfig.pId!, pId);
                console.log('dataConnection open');
                role.messageFromCommand(PeerCommands.Helo).then((msg) => dataConnection!.send(msg));
            });
            dataConnection!.on('data', function(data){
                const msg = PeerData.dataToPeerMessage(data as string);
                console.log(msg);
                role!.handleMessage(msg);
                if (role?.role === PeerRole.Host) {
                    if (msg.command === PeerCommands.Elho) {
                        role.messageFromCommand(PeerCommands.PlayWithMe).then((msg) => dataConnection!.send(msg));
                    } else if (msg.command === PeerCommands.IWillPlayWithYou) {
                        console.log('accepted by', dataConnection!.metadata.clientName);
                    } else if (msg.command === PeerCommands.IWontPlayWithYou) {
                        console.log('rejected');
                    }
                }
                console.log('receiving data');
                console.log(data);
            });
            them = pId;
            console.log('dataConnection', dataConnection);
            
        }
    };
</script>
{#if p && $peerConfig.pId}
    <h1>Peer ID: {$peerConfig.pId}</h1>
    <h2>Peers</h2>
    <PeerList pId={$peerConfig.pId} {onConnectRequest} />
    {#if modalVisible}
        <Modal title="Connecting" open={modalVisible} on:close={() => modalVisible = false} dismissable={false}>
            <p>Game request from {them}, {metadata?.hostName} would you like to play?</p>
            <ButtonGroup>
                <Button color="green" onclick={() => {
                    console.log('accepting');
                    dataConnection!.send(PeerCommands.IWillPlayWithYou);
                    modalVisible = false;
                }}>Accept</Button>
                <Button color="red" onclick={() => {
                    console.log('rejecting');
                    dataConnection!.send(PeerCommands.IWontPlayWithYou);
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
