import WebTorrent from 'webtorrent';
const client = new WebTorrent();

const activeTorrents = {};
const activeClients = {}; // Track the full torrent instance

function startStream(magnet, callback) {
    if (activeTorrents[magnet]) {
        return callback(null, activeTorrents[magnet]);
    }

    const trackers = [
        'udp://tracker.leechers-paradise.org:6969',
        'udp://zer0day.ch:1337',
        'udp://open.demonii.com:1337',
        'udp://tracker.coppersurfer.tk:6969',
        'udp://exodus.desync.com:6969',
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.btorrent.xyz',
        'wss://tracker.fastcast.nz',
        'wss://tracker.quax.io'
    ];

    console.log('Añadiendo torrent:', magnet);
    client.add(magnet, {
        path: '/tmp/webtorrent',
        announce: trackers
    }, (torrent) => {
        console.log('Torrent metadata ready:', torrent.infoHash);

        torrent.on('wire', (wire, addr) => {
            console.log(`Connected to new peer: ${addr}. Total peers: ${torrent.numPeers}`);
        });

        // Select the largest file (usually the movie/episode)
        const file = torrent.files.reduce((a, b) => a.length > b.length ? a : b);
        console.log(`Largest file selected: ${file.name} (${file.length} bytes)`);

        // Enable sequential download for streaming
        file.deselect();
        torrent.select(0, torrent.pieces.length - 1, false);
        // WebTorrent's file.createReadStream() handles sequential reading

        activeTorrents[magnet] = file;
        activeClients[magnet] = torrent;
        callback(null, file);
    });

    client.on('error', (err) => {
        console.error('WebTorrent Error:', err);
        callback(err);
    });
}

function getStreamInfo(magnet) {
    const file = activeTorrents[magnet];
    if (!file) return null;
    return {
        name: file.name,
        size: file.length,
        extension: file.name.split('.').pop().toLowerCase()
    };
}

function getTorrentInstance(magnet) {
    return activeClients[magnet];
}

function addTorrent(magnet, movieMeta) {
    if (activeClients[magnet]) return activeClients[magnet];

    const trackers = [
        'udp://tracker.leechers-paradise.org:6969',
        'udp://zer0day.ch:1337',
        'udp://open.demonii.com:1337',
        'udp://tracker.coppersurfer.tk:6969',
        'udp://exodus.desync.com:6969',
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.btorrent.xyz',
        'wss://tracker.fastcast.nz',
        'wss://tracker.quax.io'
    ];

    client.add(magnet, { path: '/tmp/webtorrent', announce: trackers }, (torrent) => {
        // Save metadata on the torrent object for the library UI
        torrent.movieMeta = movieMeta;

        const file = torrent.files.reduce((a, b) => a.length > b.length ? a : b);
        activeTorrents[magnet] = file;
        activeClients[magnet] = torrent;
    });

    return true; // Sent to client successfully
}

function getDownloads() {
    return Object.keys(activeClients).map(magnet => {
        const t = activeClients[magnet];
        return {
            magnet,
            progress: t.progress,
            downloadSpeed: t.downloadSpeed,
            numPeers: t.numPeers,
            ready: t.progress === 1,
            movieMeta: t.movieMeta || null
        };
    });
}

function removeTorrent(magnet) {
    const torrent = activeClients[magnet];
    if (torrent) {
        torrent.destroy();
        delete activeClients[magnet];
        delete activeTorrents[magnet];
        return true;
    }
    return false;
}

export { startStream, getStreamInfo, getTorrentInstance, addTorrent, getDownloads, removeTorrent };
