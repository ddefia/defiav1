#!/bin/bash

# Start ngrok tunnel for X OAuth
# This creates an HTTPS URL for localhost:3000

cd "$(dirname "$0")"

echo "🚀 Starting ngrok tunnel..."
echo ""
echo "Your app should be running on http://localhost:3000"
echo ""

# Check if ngrok exists
if [ ! -f "./ngrok" ]; then
    echo "❌ ngrok not found. Please download from https://ngrok.com/download"
    exit 1
fi

# Start ngrok
./ngrok http 3000

echo ""
echo "✅ Copy the HTTPS URL above (e.g., https://abc123.ngrok-free.app)"
echo "Use it in X Developer Portal as: https://YOUR-URL.ngrok-free.app/api/oauth/x/callback"
