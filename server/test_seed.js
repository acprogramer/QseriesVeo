import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import WebTorrent from 'webtorrent';

const BASE_URL = 'https://3cc5-don.mirror.pm';
const HTTP_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

async function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

async function computeProofOfWork(challenge, difficulty = 3) {
    let nonce = 0;
    const target = '0'.repeat(difficulty);
    while (true) {
        const text = challenge + nonce;
        const hashHex = await sha256(text);
        if (hashHex.startsWith(target)) return nonce;
        nonce++;
    }
}

async function test() {
    console.log("Fetching matrix torrent link...");
    const { data } = await axios.get(`${BASE_URL}/pelicula/25020/Matrix-Resurrections-4K`, { headers: HTTP_HEADERS });
    const $ = cheerio.load(data);

    const downloadBtn = $('.protected-download').first();
    const contentId = downloadBtn.data('contentId');
    const tabla = downloadBtn.data('tabla');

    if (contentId && tabla) {
        console.log(`Bypassing protection for contentId=${contentId}, tabla=${tabla}`);
        const validateUrl = `${BASE_URL}/api_validate_pow.php`;
        const genResponse = await axios.post(validateUrl, {
            action: 'generate',
            content_id: parseInt(contentId),
            tabla: tabla
        }, { headers: { ...HTTP_HEADERS, 'Content-Type': 'application/json' } });

        const challenge = genResponse.data.challenge;
        const nonce = await computeProofOfWork(challenge, 3);
        const valResponse = await axios.post(validateUrl, {
            action: 'validate',
            challenge: challenge,
            nonce: nonce
        }, { headers: { ...HTTP_HEADERS, 'Content-Type': 'application/json' } });

        let downloadUrl = valResponse.data.download_url;
        if (downloadUrl && downloadUrl.startsWith('//')) {
            downloadUrl = 'https:' + downloadUrl;
        }
        console.log("Download URL:", downloadUrl);

        const client = new WebTorrent();
        console.log("Adding to webtorrent...");

        client.add(downloadUrl, (torrent) => {
            console.log(`Torrent added! Name: ${torrent.name}`);
            let maxPeers = 0;
            const checkInterval = setInterval(() => {
                const peers = torrent.numPeers;
                if (peers > maxPeers) maxPeers = peers;
                console.log(`Current peers: ${peers}. Downloading: ${torrent.downloadSpeed / 1024} KB/s`);
            }, 1000);

            setTimeout(() => {
                clearInterval(checkInterval);
                console.log(`Max peers found in 5s: ${maxPeers}`);
                client.destroy();
                process.exit(0);
            }, 5000);
        });

        client.on('error', (err) => {
            console.error('WebTorrent Error:', err.message);
            client.destroy();
            process.exit(1);
        });
    }
}
test();
