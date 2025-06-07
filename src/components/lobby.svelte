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
    import { PeerCommands, GameHost, GameClient, PeerData, PeerRole, type PeerState } from "$lib/game/comms";
    import { goto } from '$app/navigation';
    import { gameSession, gameSessionActions } from '$lib/game-state-store';

    let p: Peer | null = $state(null);
    let supported: boolean | null = $state(null);
    let them: string | null = $state(null);
    let dataConnection: DataConnection | null = $state(null);
    let role: PeerState | null = $state(null);
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

            dataConnection?.on('data', async function(data){
                if (!role && them) {
                    role = new GameClient($peerConfig.pId!, them);
                    role.startGame(window);
                    gameSessionActions.setGameSession({
                        peerState: role,
                        dataConnection: dataConnection,
                        opponentId: them,
                        game: role.getGame(),
                        isConnected: true
                    });
                }
                const msg = PeerData.dataToPeerMessage(data as string);
                console.log(msg);
                await role!.handleMessage(msg);

                if (role?.role === PeerRole.Client) {
                    console.log('CLIENT role confirmed in first handler, received:', msg.command);
                    if (msg.command === PeerCommands.Helo) {
                        role.messageFromCommand(PeerCommands.Elho).then((msg) => dataConnection!.send(msg));
                    } else if (msg.command === PeerCommands.PlayWithMe) {
                        console.log('CLIENT: Setting modalVisible to true in first handler');
                        modalVisible = true;
                        console.log('CLIENT: modalVisible is now:', modalVisible);
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
    
    $effect(() => {
        console.log('modalVisible changed to:', modalVisible);
    });
    const onConnectRequest = (pId: string) => {
        console.log('onConnectRequest called with pId:', pId);
        if (p) {
            dataConnection = p.connect(pId, { metadata: { gameName: randomName() }});
            dataConnection!.on('open', () => {
                role = new GameHost($peerConfig.pId!, pId);
                role.startGame(window);
                gameSessionActions.setGameSession({
                    peerState: role,
                    dataConnection: dataConnection,
                    opponentId: pId,
                    game: role.getGame(),
                    isConnected: true
                });
                console.log('dataConnection open');
                role.messageFromCommand(PeerCommands.Helo).then((msg) => dataConnection!.send(msg));
            });
            dataConnection!.on('data', async function(data){
                const msg = PeerData.dataToPeerMessage(data as string);
                console.log(msg);
                console.log('Current role:', role?.role === PeerRole.Host ? 'HOST' : 'CLIENT');
                await role!.handleMessage(msg);
                if (role?.role === PeerRole.Host) {
                    if (msg.command === PeerCommands.Elho) {
                        role.messageFromCommand(PeerCommands.PlayWithMe).then((msg) => dataConnection!.send(msg));
                    } else if (msg.command === PeerCommands.LetsPlay) {
                        console.log('accepted by', dataConnection!.metadata.clientName);
                        goto('/board');
                    } else if (msg.command === PeerCommands.NoThanks) {
                        console.log('rejected');
                    }
                } else if (role?.role === PeerRole.Client) {
                    console.log('CLIENT received message:', msg.command);
                    if (msg.command === PeerCommands.PlayWithMe) {
                        console.log('Setting modalVisible to true');
                        modalVisible = true;
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
<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
    <div class="max-w-4xl mx-auto">
        {#if p && $peerConfig.pId}
            <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div class="text-center mb-6">
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">Nine Men's Morris</h1>
                    <p class="text-gray-600">Multiplayer Lobby</p>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <div class="flex items-center justify-center space-x-2">
                        <span class="text-sm font-medium text-gray-500">Your Peer ID:</span>
                        <span class="font-mono text-lg font-semibold text-indigo-600 bg-white px-3 py-1 rounded border">
                            {$peerConfig.pId}
                        </span>
                    </div>
                </div>

                {#if them}
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <div class="flex items-center justify-center space-x-2">
                            <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span class="text-green-800 font-medium">Connected to {them}</span>
                        </div>
                    </div>
                {/if}
                
                <div class="space-y-4">
                    <h2 class="text-xl font-semibold text-gray-800 flex items-center space-x-2">
                        <span>Available Players</span>
                        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </h2>
                    <PeerList pId={$peerConfig.pId} {onConnectRequest} />
                </div>
            </div>

                <Modal title="Game Invitation" open={modalVisible} onclose={() => modalVisible = false} dismissable={false}>
                    <div class="text-center p-6">
                        <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-2-4H9m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V9z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">Game Request!</h3>
                        <p class="text-gray-600 mb-6">
                            <span class="font-medium">{them}</span> would like to play Nine Men's Morris with you.
                        </p>
                        <ButtonGroup class="justify-center">
                            <Button size="lg" onclick={() => {
                                console.log('accepting');
                                role!.messageFromCommand(PeerCommands.LetsPlay).then((msg) => dataConnection!.send(msg));
                                modalVisible = false;
                                goto('/board');
                            }}>
                                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                Accept Game
                            </Button>
                            <Button size="lg" onclick={() => {
                                console.log('rejecting');
                                role!.messageFromCommand(PeerCommands.NoThanks).then((msg) => dataConnection!.send(msg));
                                modalVisible = false;
                            }}>
                                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                                Decline
                            </Button>
                        </ButtonGroup>
                    </div>
                </Modal>
        {:else}
            <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    {#if supported === false}
                        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                            <svg class="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                            <h3 class="text-lg font-semibold text-red-800 mb-2">Browser Not Supported</h3>
                            <p class="text-red-600">Sorry, your browser does not support WebRTC which is required for peer-to-peer gaming.</p>
                        </div>
                    {:else}
                        <div class="bg-white rounded-xl shadow-lg p-8">
                            <Spinner size="8" color="blue" />
                            <p class="text-gray-600 mt-4">Connecting to lobby...</p>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>
