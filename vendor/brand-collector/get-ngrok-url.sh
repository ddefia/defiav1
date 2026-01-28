#!/bin/bash

# Get ngrok URL from the web interface

echo "🔍 Getting ngrok URL..."
echo ""

# Check if ngrok is running
if ! curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo "❌ ngrok is not running!"
    echo ""
    echo "Start ngrok first:"
    echo "  ./ngrok http 3000"
    echo ""
    echo "Or use the script:"
    echo "  ./start-ngrok.sh"
    exit 1
fi

# Get the URL
URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$URL" ]; then
    echo "⚠️  Could not get URL. Make sure ngrok is running."
    echo ""
    echo "Start ngrok: ./ngrok http 3000"
    echo "Then visit: http://localhost:4040 to see the URL"
    exit 1
fi

echo "✅ ngrok is running!"
echo ""
echo "📋 Your HTTPS URL:"
echo "   $URL"
echo ""
echo "🔗 Use this in X Developer Portal:"
echo "   ${URL}/api/oauth/x/callback"
echo ""
echo "📝 Add to .env:"
echo "   X_REDIRECT_URI=${URL}/api/oauth/x/callback"
echo ""
