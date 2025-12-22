
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
// Mask key for safety in logs
console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 15)}...` : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        console.log('\n--- 1. Testing Read Access ---');
        // Try to fetch a known key or just any row 
        const { data, error } = await supabase
            .from('app_storage')
            .select('key, updated_at')
            .limit(1);

        if (error) {
            console.error('READ FAILED:', error.message, error.details || '');
            if (error.code === '42P01') console.error('HINT: Table "app_storage" might not exist.');
        } else {
            console.log('READ SUCCESS. Rows found:', data?.length);
        }

        console.log('\n--- 2. Testing Write Access ---');
        const testKey = 'test_connection_probe_' + Date.now();
        const { error: writeError } = await supabase
            .from('app_storage')
            .upsert({
                key: testKey,
                value: { test: true, timestamp: Date.now() },
                updated_at: new Date().toISOString()
            });

        if (writeError) {
            console.error('WRITE FAILED:', writeError.message, writeError.details || '');
            if (writeError.message.includes('permission')) console.error('HINT: Check RLS policies.');
        } else {
            console.log('WRITE SUCCESS. Created key:', testKey);

            // Clean up
            const { error: deleteError } = await supabase
                .from('app_storage')
                .delete()
                .eq('key', testKey);

            if (deleteError) console.warn('CLEANUP WARNING: Could not delete test key:', deleteError.message);
            else console.log('CLEANUP SUCCESS.');
        }

    } catch (err) {
        console.error('UNEXPECTED ERROR:', err);
    }
}

testConnection();
