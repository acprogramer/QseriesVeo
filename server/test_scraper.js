import { search } from './scraper.js';

async function test() {
    console.log("Searching details...");
    const details = await search("la larga marcha");
    if (details.length > 0) {
        console.log("TITLE:", details[0].title);
        console.log("SYNOPSIS:", details[0].description);
    } else {
        console.log("No results");
    }
}

test();
