<script lang="ts">
    import Peer from 'peerjs'
    import { onMount } from 'svelte';
    import { peerServer, peerServerPath, peerServerPort, peerListPath } from '$lib/peer-config';
    import { peerConfig } from '$lib/persisted-store';

    let p: Peer | null = $state(null);
    let peerId: string = $peerConfig.pId;
    let peers: string[] = $state([]);

    const getPeerList = async (me: string | undefined) => {
        const response = await fetch(peerListPath);
        const data = await response.json();
        // filter out own id
        return me ? data.filter((id: string) => id !== me) : data;
    }

    onMount(() => {
        p = new Peer(peerId, {
            host: peerServer,
            port: peerServerPort,
            path: peerServerPath,
            secure: true,
            config: {
                iceServers: [
                    { urls: 'stun:relay.adminforge.de:443' },
                    { urls: 'stun:relay2.adminforge.de:443' },
                ],
            }
        });

        p.on('open', (id) => {
            peerConfig.set({ pId: id });
            console.log('My peer ID is: ' + id);
            console.log('Other peers:');
            getPeerList(id).then((peerList) => {
                peers = peerList;
                if (id !== 'afc783d4-1c11-4705-9b21-b0caf9c29153') {
                    let conn = p?.connect('afc783d4-1c11-4705-9b21-b0caf9c29153');
                    conn?.on('open', function() {
                        // here you have conn.id
                        console.log('sending hi');
                        conn.send('hi!');
                    });
                }
            });
            p?.on('connection', function(conn) {
                conn.on('data', function(data){
                    // Will print 'hi!'
                    console.log('receiving data');
                    console.log(data);
                });
            });
        });
        
    });
</script>
{#if $peerConfig.pId}
    <h1>Peer ID: {$peerConfig.pId}</h1>
{/if}
<h2>Peers</h2>
<ul>
    {#each peers as peer}
        <li>{peer}</li>
    {/each}
</ul>
