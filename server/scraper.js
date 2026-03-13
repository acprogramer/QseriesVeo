import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const BASE_URL = 'https://3cc5-don.mirror.pm';

// Use proxy to bypass Cloudflare blocking datacenter IPs
// Free proxy: allorigins.win (no rate limit, no auth required)
const PROXY_BASE = 'https://api.allorigins.win/raw?url=';

const HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
};

/**
 * Get URL via proxy to bypass Cloudflare
 */
async function getViaProxy(url) {
    const proxyUrl = PROXY_BASE + encodeURIComponent(url);
    const { data } = await axios.get(proxyUrl, { 
        headers: HTTP_HEADERS,
        timeout: 15000,
        // Don't follow redirects automatically (proxy handles it)
        maxRedirects: 0
    });
    return data;
}

/**
 * Node.js implementation of SHA-256
 */
async function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * Computes Proof of Work nonce
 */
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

/**
 * Fetches movie details (image, year, genre, description) from a movie page.
 * Returns a partial movie object with enriched data.
 */
async function fetchMovieDetails(pageUrl) {
    try {
        const data = await getViaProxy(pageUrl);
        const $ = cheerio.load(data);

        // Get large image from og:image
        let image = $('meta[property="og:image"]').attr('content') || '';
        // Upgrade image size: from w=120&h=165 to w=300&h=450
        if (image) {
            image = image.replace(/w=\d+/, 'w=300').replace(/h=\d+/, 'h=450');
        }

        // Fallback to card img
        if (!image) {
            const cardImg = $('.img-thumbnail').first().attr('src');
            if (cardImg) {
                image = cardImg.startsWith('//') ? 'https:' + cardImg : cardImg;
                image = image.replace(/w=\d+/, 'w=300').replace(/h=\d+/, 'h=450');
            }
        }

        const year = $('a[onclick*="anyo"]').first().text().trim();
        const genre = $('a[onclick*="genero"]').first().text().trim();
        const paragraphs = [];
        $('.text-justify, .m-0').each((i, el) => {
            const text = $(el).text().trim().replace(/^Descripción:\s*/i, '').replace(/^Sinopsis:\s*/i, '');
            if (text && text.length > 5 && !text.includes('Formato:') && !text.includes('Tamaño:')) {
                paragraphs.push(text);
            }
        });
        const descText = paragraphs.join('\n\n');
        const format = $('p:contains("Formato:")').first().text().replace('Formato:', '').trim();

        let size = '';
        $('p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Tamaño:')) {
                size = text.replace('Tamaño:', '').trim();
            }
        });

        if (!size) {
            const sizeMatch = data.match(/Tamaño:\s*(\d+(?:\.\d+)?\s*(?:GB|MB|MG))/i);
            if (sizeMatch) size = sizeMatch[1];
        }

        let healthScore = 3;
        if (format === '4K') healthScore += 1;
        if (format === 'MicroHD' || format === 'BDremux-1080p') healthScore += 1;

        if (size) {
            const sizeMatch = size.match(/([\d\.]+)\s*(GB|MB)/i);
            if (sizeMatch) {
                const val = parseFloat(sizeMatch[1]);
                const unit = sizeMatch[2].toUpperCase();
                if (unit === 'GB') {
                    if (val > 25) healthScore -= 1;
                    else if (val < 3) healthScore += 1;
                } else if (unit === 'MB') {
                    healthScore += 1;
                }
            }
        }
        healthScore = Math.min(Math.max(healthScore, 1), 5); // 1 to 5 stars

        return { image, year, genre, description: descText, format, size, healthScore };
    } catch (e) {
        return null;
    }
}

async function search(query) {
    try {
        const searchUrl = `${BASE_URL}/buscar`;
        const params = new URLSearchParams();
        params.append('valor', query);
        params.append('Buscar', 'Buscar');

        const proxyUrl = PROXY_BASE + encodeURIComponent(searchUrl);
        const { data } = await axios.post(proxyUrl, params, {
            headers: { ...HTTP_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });
        const $ = cheerio.load(data);
        const results = [];

        $('#buscador .card-body p').each((i, el) => {
            const linkTag = $(el).find('a[href^="/pelicula/"]').first();
            if (linkTag.length === 0) return;

            const titleText = linkTag.text().trim();
            const version = $(el).find('span.badge, .text-secondary').first().text().trim();
            const fullTitle = version ? `${titleText} (${version})` : titleText;
            const link = linkTag.attr('href');

            if (titleText && link) {
                results.push({
                    title: fullTitle,
                    link: link.startsWith('http') ? link : `${BASE_URL}${link}`,
                    image: null,
                    year: '',
                    genre: '',
                    description: '',
                    format: ''
                });
            }
        });

        // Deduplicate by link
        const unique = results.filter((v, i, self) => i === self.findIndex(t => t.link === v.link));

        // Fetch details in parallel (max 6 at a time to avoid hammering)
        const MAX_PARALLEL = 6;
        const chunks = [];
        for (let i = 0; i < unique.length; i += MAX_PARALLEL) {
            chunks.push(unique.slice(i, i + MAX_PARALLEL));
        }

        const enriched = [];
        for (const chunk of chunks) {
            const details = await Promise.all(chunk.map(m => fetchMovieDetails(m.link)));
            chunk.forEach((movie, idx) => {
                const d = details[idx];
                enriched.push({
                    ...movie,
                    image: d?.image || null,
                    year: d?.year || '',
                    genre: d?.genre || '',
                    description: d?.description || '',
                    format: d?.format || '',
                    size: d?.size || '',
                    healthScore: d?.healthScore || 3
                });
            });
        }

        return enriched;
    } catch (error) {
        console.error('Scraper search error:', error.message);
        return [];
    }
}

async function getLatest() {
    try {
        const url = `${BASE_URL}/`;
        console.log('Fetching latest from:', url);
        const data = await getViaProxy(url);
        console.log('Latest response length:', data.length);
        const $ = cheerio.load(data);
        const results = [];

        $('.card').each((i, card) => {
            const cardTitle = $(card).find('.card-title.top').text().toLowerCase();
            if (cardTitle.includes('peliculas') || cardTitle.includes('películas') || cardTitle.includes('series')) {
                const type = cardTitle.includes('series') ? 'Serie' : 'Película';
                const quality = cardTitle.includes('4k') ? '4K' : cardTitle.includes('hd') ? 'HD' : '';

                $(card).find('.text-center a[href^="/peli"]').each((j, el) => {
                    const link = $(el).attr('href');
                    let title = link.split('/').pop().replace(/-/g, ' ');

                    const imgNode = $(el).find('img');
                    let imgUrl = imgNode.attr('src');
                    if (imgUrl && imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;

                    if (imgUrl) {
                        imgUrl = imgUrl.replace(/w=\d+/, 'w=300').replace(/h=\d+/, 'h=450');
                    }

                    if (link) {
                        results.push({
                            title: quality ? `${title} [${quality}]` : title,
                            link: link.startsWith('http') ? link : `${BASE_URL}${link}`,
                            image: imgUrl || null,
                            format: quality,
                            type: type
                        });
                    }
                });
            }
        });

        // Deduplicate latest
        const unique = results.filter((v, i, self) => i === self.findIndex(t => t.link === v.link)).slice(0, 20);

        // Fetch details in parallel
        const MAX_PARALLEL = 6;
        const chunks = [];
        for (let i = 0; i < unique.length; i += MAX_PARALLEL) {
            chunks.push(unique.slice(i, i + MAX_PARALLEL));
        }

        const enriched = [];
        for (const chunk of chunks) {
            const details = await Promise.all(chunk.map(m => fetchMovieDetails(m.link)));
            chunk.forEach((movie, idx) => {
                const d = details[idx];
                enriched.push({
                    ...movie,
                    image: d?.image || movie.image,
                    year: d?.year || '',
                    genre: d?.genre || '',
                    description: d?.description || '',
                    format: d?.format || movie.format,
                    size: d?.size || '',
                    healthScore: d?.healthScore || (movie.format === '4K' ? 4 : 3)
                });
            });
        }

        return enriched;
    } catch (error) {
        console.error('Scraper getLatest error:', error.message);
        return [];
    }
}

async function getList(category = 'peliculas', page = 1) {
    try {
        let url = `${BASE_URL}/${category}`;
        if (page > 1) {
            url += `/page/${page}`;
        }

        console.log(`Fetching category list: ${url}`);
        const data = await getViaProxy(url);
        const $ = cheerio.load(data);
        const results = [];

        $('.card-body').each((i, el) => {
            const $el = $(el);
            // Skip the first card-body which contains the search form
            if (i === 0 && $el.find('form').length > 0) return;

            // Get all movie links (first link of each card-body after the form)
            // Note: documentales uses /documental/ (singular) in the URL
            const linkTag = $el.find('a[href^="/pelicula/"], a[href^="/serie/"], a[href^="/documental/"]').first();
            if (linkTag.length === 0) return;

            const link = linkTag.attr('href');
            if (!link) return;

            // Extract title from href (e.g., "/pelicula/30273/El-ltimo-tiroteo" -> "El ltimo tiroteo")
            let titleText = link.split('/').pop().replace(/-/g, ' ');
            // URL decode
            try { titleText = decodeURIComponent(titleText); } catch (e) {}

            const version = $el.find('span.badge, .text-secondary').first().text().trim();
            const fullTitle = version ? `${titleText} (${version})` : titleText;

            let imgUrl = linkTag.find('img').attr('src');
            if (imgUrl && imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            if (imgUrl) imgUrl = imgUrl.replace(/w=\d+/, 'w=300').replace(/h=\d+/, 'h=450');

            if (link) {
                results.push({
                    title: fullTitle,
                    link: link.startsWith('http') ? link : `${BASE_URL}${link}`,
                    image: imgUrl || null,
                    year: '',
                    genre: '',
                    description: '',
                    format: version,
                    type: category === 'series' ? 'Serie' : category === 'documentales' ? 'Documental' : 'Película'
                });
            }
        });

        const unique = results.filter((v, i, self) => i === self.findIndex(t => t.link === v.link)).slice(0, 24);

        const MAX_PARALLEL = 8;
        const chunks = [];
        for (let i = 0; i < unique.length; i += MAX_PARALLEL) {
            chunks.push(unique.slice(i, i + MAX_PARALLEL));
        }

        const enriched = [];
        for (const chunk of chunks) {
            const details = await Promise.all(chunk.map(m => fetchMovieDetails(m.link)));
            chunk.forEach((movie, idx) => {
                const d = details[idx];
                enriched.push({
                    ...movie,
                    image: d?.image || movie.image,
                    year: d?.year || '',
                    genre: d?.genre || '',
                    description: d?.description || '',
                    format: d?.format || movie.format,
                    size: d?.size || '',
                    healthScore: d?.healthScore || 3
                });
            });
        }

        return enriched;
    } catch (error) {
        console.error(`Scraper getList error (${category}, page ${page}):`, error.message);
        return [];
    }
}

async function getMagnet(pageUrl) {
    try {
        console.log(`Getting magnet for: ${pageUrl}`);
        const data = await getViaProxy(pageUrl);
        const $ = cheerio.load(data);

        let magnet = $('a[href^="magnet:?"]').attr('href');
        if (magnet) return magnet;

        const downloadBtn = $('.protected-download').first();
        const contentId = downloadBtn.data('contentId');
        const tabla = downloadBtn.data('tabla');

        if (!contentId || !tabla) {
            const torrentLink = $('a[href*=".torrent"]').attr('href');
            if (torrentLink) return torrentLink.startsWith('http') ? torrentLink : `${BASE_URL}${torrentLink}`;
            return null;
        }

        const validateUrl = `${BASE_URL}/api_validate_pow.php`;
        const proxyValidateUrl = PROXY_BASE + encodeURIComponent(validateUrl);
        const genResponse = await axios.post(proxyValidateUrl, {
            action: 'generate',
            content_id: parseInt(contentId),
            tabla: tabla
        }, { headers: { ...HTTP_HEADERS, 'Content-Type': 'application/json' }, timeout: 15000 });

        if (!genResponse.data || !genResponse.data.success) {
            throw new Error(genResponse.data?.error || 'Failed to generate challenge');
        }

        const challenge = genResponse.data.challenge;
        const nonce = await computeProofOfWork(challenge, 3);

        const valResponse = await axios.post(proxyValidateUrl, {
            action: 'validate',
            challenge: challenge,
            nonce: nonce
        }, { headers: { ...HTTP_HEADERS, 'Content-Type': 'application/json' }, timeout: 15000 });

        if (!valResponse.data || !valResponse.data.success) {
            throw new Error(valResponse.data?.error || 'Validation failed');
        }

        let downloadUrl = valResponse.data.download_url;
        if (downloadUrl && downloadUrl.startsWith('//')) {
            downloadUrl = 'https:' + downloadUrl;
        }

        return downloadUrl;
    } catch (error) {
        console.error('Scraper getMagnet error:', error.message);
        return null;
    }
}

export { search, getMagnet, getLatest, getList };
