import requests
import json
import os

API_KEY = '7eakjiw9xbq81tkaxyafx1zenrmjgkotky6ttwuf'
BASE_URL = 'https://lunarcrush.com/api4/public'

def get_json(url):
    print(f"\n> Fetching: {url}")
    try:
        res = requests.get(url, headers={'Authorization': f'Bearer {API_KEY}'}, timeout=15)
        if res.status_code == 200:
            data = res.json()
            return data.get('data', [])
        else:
            print(f"❌ Error {res.status_code}: {res.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Exception: {e}")
        return None

print("--- SMART TREND DISCOVERY (News & Narratives) ---\n")

# 1. Get Trending TOPICS (Not Coins)
# This is key to finding "What is happening" vs "What is pumping"
print("1️⃣  Identifying Meta Narratives (Topics)...")
topics = get_json(f"{BASE_URL}/topics/list/v1")

if topics:
    # Filter out topics that arguably are just coins (if possible) or just show top 10
    print(f"   Found {len(topics)} topics.")
    sorted_topics = sorted(topics, key=lambda x: x.get('interactions_24h', 0), reverse=True)
    
    top_topics = sorted_topics[:5]
    for t in top_topics:
        topic_id = t.get('topic')
        print(f"   - [{topic_id}] (Vol: {t.get('social_volume_24h')}, Interactions: {t.get('interactions_24h')})")

    # 2. Deep Dive into the #1 Topic
    if top_topics:
        star_topic = top_topics[0].get('topic')
        print(f"\n2️⃣  Deep Dive into Top Topic: '{star_topic}'")
        
        # A. Try the "WhatsUp" Endpoint (AI Summary provided by LunarCrush?)
        # /public/topic/:topic/whatsup/v1
        print(f"   > Asking LunarCrush: 'WhatsUp with {star_topic}?'...")
        whatsup = get_json(f"{BASE_URL}/topic/{star_topic}/whatsup/v1")
        if whatsup:
            print(f"   🧠 AI SUMMARY: {whatsup}") # It might be a string or object
        
        # B. Get Actual News
        print(f"   > Fetching Top News for {star_topic}...")
        news = get_json(f"{BASE_URL}/topic/{star_topic}/news/v1")
        if news:
            for i, n in enumerate(news[:3]):
                print(f"     {i+1}. {n.get('post_title')} ({n.get('creator_display_name')})")

# 3. Get Trending CATEGORIES
print("\n3️⃣  Identifying Market Sectors (Categories)...")
categories = get_json(f"{BASE_URL}/categories/list/v1")

if categories:
    # Sort by interactions
    sorted_cats = sorted(categories, key=lambda x: x.get('interactions_24h', 0), reverse=True)
    print("   Top 5 Categories:")
    for c in sorted_cats[:5]:
        cat_id = c.get('category')
        print(f"   - {c.get('name')} (Interactions: {c.get('interactions_24h')})")
        
    # Deep dive into top category news
    if sorted_cats:
        top_cat = sorted_cats[0].get('category') # e.g. "cryptocurrencies" might be boring, let's look for finding a niche
        # Let's try to find a non-generic one if possible, or just the top one
        print(f"\n   > News for Top Category: {top_cat}")
        cat_news = get_json(f"{BASE_URL}/category/{top_cat}/news/v1")
        if cat_news:
             for i, n in enumerate(cat_news[:3]):
                print(f"     {i+1}. {n.get('post_title')}")
