import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

async function check() {
    console.log('Fetching El ultimo tiroteo 4k...');
    const res = await fetch('https://donproxy.yep.pm/pelicula/30277/El-ltimo-tiroteo-4K');
    const html = await res.text();
    const $ = cheerio.load(html);

    console.log('--- ALL <p> tags ---');
    $('p').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > 50) {
            console.log(`[${i}] ${$(el).attr('class')}: ${t.substring(0, 80)}...`);
            console.log(`FULL LENGTH: ${t.length}`);
        }
    });

    console.log('\n--- text-justify ---');
    console.log($('.text-justify').text().trim().length);
}

check().catch(console.error);
