import express from 'express';
import cors from 'cors';
import { search, getMagnet, getLatest, getList } from './scraper.js';
import { startStream, getStreamInfo, addTorrent, getDownloads, removeTorrent } from './stream.js';

const app = express();
const PORT = 3001;

// Logging middleware
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
});

app.use(cors());
app.use(express.json());

app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });
    const results = await search(q);
    res.json(results);
});

app.get('/api/latest', async (req, res) => {
    const results = await getLatest();
    res.json(results);
});

app.get('/api/list', async (req, res) => {
    const { category, page } = req.query;
    console.log(`[API] /api/list called - category: ${category}, page: ${page}`);
    try {
        const results = await getList(category || 'peliculas', parseInt(page) || 1);
        console.log(`[API] /api/list returning ${results.length} results`);
        res.json(results);
    } catch (error) {
        console.error(`[API] /api/list error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/download', async (req, res) => {
    const { magnet, movie } = req.body;
    if (!magnet) return res.status(400).json({ error: 'Missing magnet' });
    addTorrent(magnet, movie);
    res.json({ success: true });
});

app.get('/api/downloads', (req, res) => {
    res.json(getDownloads());
});

app.post('/api/download/remove', (req, res) => {
    const { magnet } = req.body;
    if (!magnet) return res.status(400).json({ error: 'Missing magnet' });
    const success = removeTorrent(magnet);
    res.json({ success });
});

app.get('/api/magnet', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing URL' });
    const magnet = await getMagnet(url);
    res.json({ magnet });
});

// Returns info about the torrent file (name, extension) once metadata is available
app.get('/api/stream-info', (req, res) => {
    const { magnet } = req.query;
    if (!magnet) return res.status(400).json({ error: 'Missing magnet' });
    const info = getStreamInfo(magnet);
    if (!info) return res.json({ ready: false });
    res.json({ ready: true, ...info });
});

app.get('/api/stream-status', async (req, res) => {
    const { magnet } = req.query;
    if (!magnet) return res.status(400).json({ error: 'Missing magnet' });

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
    });

    const { getTorrentInstance } = await import('./stream.js');

    // Poll the instance
    const interval = setInterval(() => {
        const torrent = getTorrentInstance(magnet);
        if (torrent) {
            res.write(`data: ${JSON.stringify({
                progress: torrent.progress,
                downloadSpeed: torrent.downloadSpeed,
                numPeers: torrent.numPeers,
                downloaded: torrent.downloaded,
                length: torrent.length
            })}\n\n`);
        } else {
            res.write(`data: ${JSON.stringify({ status: 'starting' })}\n\n`);
        }
    }, 1000);

    req.on("close", () => clearInterval(interval));
});

app.get('/api/stream', (req, res) => {
    const { magnet } = req.query;
    if (!magnet) return res.status(400).json({ error: 'Missing magnet' });

    startStream(magnet, (err, file) => {
        if (err) return res.status(500).json({ error: err.message });

        const range = req.headers.range;
        if (!range) {
            // Some players check without Range first
            return res.status(416).set('Accept-Ranges', 'bytes').send('Requires Range header');
        }

        const positions = range.replace(/bytes=/, "").split("-");
        const start = parseInt(positions[0], 10);
        const total = file.length;
        const end = positions[1] ? parseInt(positions[1], 10) : Math.min(start + 10 * 1024 * 1024, total - 1);
        const chunksize = (end - start) + 1;

        const extension = file.name.split('.').pop().toLowerCase();
        let contentType = 'video/mp4';
        if (extension === 'mkv') contentType = 'video/x-matroska';
        else if (extension === 'webm') contentType = 'video/webm';
        else if (extension === 'avi') contentType = 'video/x-msvideo';

        // Fix for browser audio: transcode unsupported audio codecs in MKV/AVI files on the fly
        if (extension === 'mkv' || extension === 'avi') {
            console.log(`Transcoding ${file.name} audio to AAC on the fly...`);
            res.writeHead(200, {
                "Content-Type": "video/x-matroska",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache"
            });

            const stream = file.createReadStream();
            import('child_process').then(({ spawn }) => {
                const ffmpeg = spawn('ffmpeg', [
                    '-i', 'pipe:0',
                    '-c:v', 'copy',      // Copy original video (usually H.264)
                    '-c:a', 'aac',       // Transcode audio to AAC for browser compatibility
                    '-b:a', '192k',      // Set reasonable audio bitrate
                    '-f', 'matroska',    // Output container
                    'pipe:1'
                ]);

                stream.pipe(ffmpeg.stdin);
                ffmpeg.stdout.pipe(res);

                ffmpeg.stderr.on('data', (data) => {
                    // console.log(data.toString()); // Uncomment to debug ffmpeg
                });

                res.on('close', () => {
                    ffmpeg.kill('SIGKILL');
                    stream.destroy();
                });
            });
            return;
        }

        // Standard range-based streaming for natively supported files (like MP4)
        console.log(`Streaming ${file.name} [${extension}] bytes ${start}-${end}/${total}`);
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize,
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
        });

        const stream = file.createReadStream({ start, end });

        stream.on('error', (err) => {
            console.error('Stream error:', err.message);
            if (!res.headersSent) res.status(500).end();
        });

        res.on('close', () => {
            stream.destroy();
        });

        stream.pipe(res);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
