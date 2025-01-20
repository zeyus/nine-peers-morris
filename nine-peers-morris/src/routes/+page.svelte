<script lang="ts">
    import { Peer } from 'peerjs';
    let peerServer = 'localhost';
    let peerServerPort = 9000;
    let peerServerPath = '/myapp';
    const myUUID = crypto.randomUUID(); // or in browser storage
    const p = new Peer(myUUID, {
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
    
</script>
