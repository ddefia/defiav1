
const dateStr = "Wed Jan 07 13:00:28 +0000 2026";
const date = new Date(dateStr);
console.log(`Original: ${dateStr}`);
console.log(`Parsed: ${date.toISOString()}`);
console.log(`Valid: ${!isNaN(date.getTime())}`);
