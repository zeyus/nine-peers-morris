export const peerServerConf = {
    host: 'nozzle.localhose.com',
    port: 443,
    path: '/nmm',
    config: {
        iceServers: [
            { urls: 'stun:relay.adminforge.de:443' },
            { urls: 'stun:relay2.adminforge.de:443' },
        ],
    },
    secure: true,
};

export const peerListPath = `https://${peerServerConf.host}:${peerServerConf.port}${peerServerConf.path}/peerjs/peers`;
