
import 'dotenv/config';
console.log("Checking Apify User...");
const token = process.env.APIFY_API_TOKEN;
const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
console.log("Status:", res.status);
const data = await res.json();
console.log("User:", JSON.stringify(data));
