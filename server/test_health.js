import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://3cc5-don.mirror.pm';
const HTTP_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

function calculateHealthScore(format, size) {
    let score = 3; // base score

    if (format === '4K') score += 1;
    if (format === 'MicroHD' || format === 'BDremux-1080p') score += 1;

    if (size) {
        const sizeMatch = size.match(/([\d\.]+)\s*(GB|MB)/i);
        if (sizeMatch) {
            const val = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2].toUpperCase();

            if (unit === 'GB') {
                if (val > 25) score -= 1; // huge files have fewer seeders
                else if (val < 3) score += 1; // standard sizes have many
            } else if (unit === 'MB') {
                score += 1; // very small files are easy
            }
        }
    }

    return Math.min(Math.max(score, 1), 5); // 1 to 5 stars
}

async function test() {
    console.log(calculateHealthScore('4K', '15.5 GB')); // Expected 4
    console.log(calculateHealthScore('HDRip', '1.5 GB')); // Expected 4
    console.log(calculateHealthScore('4K', '50 GB')); // Expected 3
    console.log(calculateHealthScore('MicroHD', '4.5 GB')); // Expected 4
}
test();
