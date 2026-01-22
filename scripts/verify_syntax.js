
try {
    // Just try to parse the files as text to look for obvious syntax errors
    // We can't require() TSX files directly in Node without registration, 
    // but we can check if fs can read them and simple regex checks.
    const fs = require('fs');
    const path = require('path');

    const filesToCheck = [
        'components/Sidebar.tsx',
        'components/Copilot/CopilotPage.tsx',
        'components/Copilot/ActionCards/CampaignCard.tsx',
        'services/gemini.ts',
        'App.tsx'
    ];

    console.log("Checking file existence and basic syntax markers...");

    filesToCheck.forEach(file => {
        const filePath = path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
            console.error(`MISSING FILE: ${file}`);
            process.exit(1);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('<<<<<<<')) {
            console.error(`MERGE CONFLICT DETECTED IN: ${file}`);
            process.exit(1);
        }
        console.log(`OK: ${file}`);
    });

    console.log("All critical files exist and have no merge markers.");

} catch (e) {
    console.error("Verification failed:", e);
    process.exit(1);
}
