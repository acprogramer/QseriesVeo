import WebTorrent from 'webtorrent';
const client = new WebTorrent();

const torrentUrl = 'https://3cc5-don.mirror.pm/torrents/peliculas/El-ltimo-tiroteo-[DVDRip]-[DonTorrent]-[4Phm].torrent';

console.log('Testing WebTorrent with URL:', torrentUrl);

client.add(torrentUrl, { path: '/tmp/webtorrent' }, (torrent) => {
    console.log('Torrent successfully added!');
    console.log('Info Hash:', torrent.infoHash);
    console.log('Files:');
    torrent.files.forEach(file => {
        console.log(`- ${file.name} (${file.length} bytes)`);
    });

    // Stop after 2 seconds
    setTimeout(() => {
        console.log('Closing client...');
        client.destroy();
        process.exit(0);
    }, 2000);
});

client.on('error', (err) => {
    console.error('WebTorrent Error:', err.message);
    process.exit(1);
});
