
import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'server/cache/history_metis.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log("Total Tweet Items:", data.length);

const withMedia = data.filter(d => d.media && d.media.length > 0);
console.log("Items with 'media' property:", withMedia.length);

if (withMedia.length > 0) {
    console.log("Sample Media Item Structure:");
    console.log(JSON.stringify(withMedia[0].media[0], null, 2));
} else {
    console.log("No items with 'media' property found.");

    // Check extendedEntities
    const withExtended = data.filter(d => d.extendedEntities && d.extendedEntities.media);
    console.log("Items with 'extendedEntities.media':", withExtended.length);
    if (withExtended.length > 0) {
        console.log("Sample Extended Media Item Structure:");
        console.log(JSON.stringify(withExtended[0].extendedEntities.media[0], null, 2));
    }
}
