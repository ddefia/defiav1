import requests
import json
import os

API_KEY = '7eakjiw9xbq81tkaxyafx1zenrmjgkotky6ttwuf'  # Provided in chat
BASE_URL = 'https://lunarcrush.com/api4/public'

def get_json(url):
    try:
        res = requests.get(url, headers={'Authorization': f'Bearer {API_KEY}'}, timeout=10)
        if res.status_code == 200:
            return res.json().get('data', [])
        print(f"Failed {url}: {res.status_code}")
        return []
    except Exception as e:
        print(f"Error {url}: {e}")
        return []

print("--- DIAGNOSTIC: FINDING ACTIONABLE TRENDS ---")

# 1. Check Topics (General Social Topics)
print("\n1. CHECKING SOCIAL TOPICS (/topics/list/v1)...")
topics = get_json(f"{BASE_URL}/topics/list/v1")
print(f"Found {len(topics)} topics.")
for t in topics[:10]:
    print(f"   - {t.get('topic', 'N/A')} (Volume: {t.get('social_volume_24h', 0)})")

# 2. Check Categories (e.g. DeFi, Gaming)
print("\n2. CHECKING CATEGORIES (/categories/list/v1)...")
cats = get_json(f"{BASE_URL}/categories/list/v1")
print(f"Found {len(cats)} categories.")
for c in cats[:5]:
    print(f"   - {c.get('category', 'N/A')} (Interactions: {c.get('interactions_24h', 0)})")

# 3. Check Smart Coin Sort (High AltRank = Trending vs Just Volume)
print("\n3. CHECKING HIGH ALTRANK COINS (Removing BTC/ETH)...")
# Note: The /coins/list/v2 endpoint has AltRank
coins = get_json(f"{BASE_URL}/coins/list/v2")

# Filter out top 5 market cap manually (approximate check) or just by symbol
ignored = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL'] 
# Sort by AltRank (Lower is better usually, or maybe specific LunarCrush score?)
# Let's inspect the first few to see what metrics we have
if coins:
    # Sort by 24h % Change or some other "Hot" metric
    # Let's try 24h interaction growth?
    print("Sample Coin Metrics keys:", list(coins[0].keys()))
    
    # Filter
    others = [c for c in coins if c.get('symbol') not in ignored]
    
    # Sort by social_dominance (relative strength) or similar?
    # Let's try sorting by `alt_rank` if available, or just social_score
    others.sort(key=lambda x: x.get('alt_rank', 9999)) # Lower AltRank is better
    
    print("Top 5 by AltRank (Excluding Majors):")
    for c in others[:5]:
        print(f"   - {c.get('name')} ({c.get('symbol')}) | AltRank: {c.get('alt_rank')} | Vol24h: {c.get('social_volume_24h')}")
