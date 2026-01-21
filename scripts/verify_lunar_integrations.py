import requests
import json
import os

# Configuration from previous context
API_KEY = '7eakjiw9xbq81tkaxyafx1zenrmjgkotky6ttwuf'
BASE_URL = 'https://lunarcrush.com/api4'

def test_endpoint(name, url):
    print(f"\n--- Testing: {name} ---")
    print(f"URL: {url}")
    headers = {'Authorization': f'Bearer {API_KEY}'}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        status = response.status_code
        
        if status == 200:
            data = response.json()
            item_count = len(data.get('data', []))
            print(f"✅ SUCCESS (200 OK)")
            print(f"Items Found: {item_count}")
            if item_count > 0:
                first_item = data['data'][0]
                # Print a small sample to prove data quality
                sample = {k: v for k, v in first_item.items() if k in ['id', 'name', 'symbol', 'post_title', 'interactions_total', 'interactions_24h']}
                print(f"Sample Data: {json.dumps(sample, indent=2)}")
            return True
        else:
            print(f"❌ FAILED ({status})")
            print(f"Message: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    print(f"Running Diagnostic on LunarCrush Integrations...")
    print(f"API Key: {API_KEY[:5]}...{API_KEY[-5:]}")
    
    # 1. Test "Coins List" (Used by Pulse)
    test_endpoint("Global Market Trends (Pulse)", f"{BASE_URL}/public/coins/list/v1")
    
    # 2. Test "Creator Posts" (Used to explain trends)
    # Testing with 'ETH' as a safe default symbol
    test_endpoint("Context Posts (ETH)", f"{BASE_URL}/public/creator/twitter/ETH/posts/v1")
    
    # 3. Test "Category News" (The new script)
    test_endpoint("Category News (Cryptocurrencies)", f"{BASE_URL}/public/category/cryptocurrencies/news/v1")
