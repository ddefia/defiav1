import requests
import json
from datetime import datetime
import collections
import os

# Configuration
LUNAR_API_KEY = '7eakjiw9xbq81tkaxyafx1zenrmjgkotky6ttwuf'
GEMINI_API_KEY = 'AIzaSyB6TVGOTXVA20LFotCDIKclhzrZ6Mm_6K0'
LUNAR_URL = 'https://lunarcrush.com/api4/public/category/cryptocurrencies/news/v1'

def fetch_lunarcrush_data():
    """Fetches news data from LunarCrush API."""
    headers = {
        'Authorization': f'Bearer {LUNAR_API_KEY}'
    }
    try:
        print(f"Fetching data from {LUNAR_URL}...")
        response = requests.get(LUNAR_URL, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching LunarCrush data: {e}")
        return None

def get_ai_analysis(news_items):
    """Sends news data to Gemini for CMO-level analysis."""
    print("Generating AI Analysis...")
    
    # Prepare the prompt context
    # Limit to top 15 items to fit context window/be concise
    top_news = news_items[:15]
    news_text = "\n".join([
        f"- {item.get('post_title')} (Source: {item.get('creator_display_name')}, Sentiment: {item.get('post_sentiment')}, Interactions: {item.get('interactions_total')})"
        for item in top_news
    ])

    prompt = f"""
    You are a Chief Marketing Officer (CMO) for a top crypto protocol. 
    Analyze the following recent news headlines and social metrics.
    
    DATA:
    {news_text}
    
    YOUR TASK:
    1. Identify the single most important narrative driving the market right now.
    2. Connect the dots between 2-3 seemingly separate stories.
    3. Provide a brief "CMO Take strategy" on how we should position our brand today given this news.
    
    Keep it concise, punchy, and actionable. No fluff.
    """

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text']
    except Exception as e:
        print(f"Error generating AI analysis: {e}")
        return "Could not generate AI analysis."

def analyze_data(json_data):
    """Analyzes and prints insights from the fetched data."""
    if not json_data or 'data' not in json_data:
        print("No valid data found to analyze.")
        return

    data = json_data['data']
    # Sort by interactions (proxy for importance)
    sorted_data = sorted(data, key=lambda x: x.get('interactions_total', 0), reverse=True)
    
    if not data:
        print("No posts found.")
        return

    print(f"\n{'='*40}")
    print(f"LUNARCRUSH INTELLIGENCE BRIEF ({datetime.now().strftime('%Y-%m-%d')})")
    print(f"{'='*40}")
    
    # AI Insight Section
    ai_insight = get_ai_analysis(sorted_data)
    print("\n🧠 AI STRATEGIC ANALYSIS (CMO VIEW):")
    print("-" * 30)
    print(ai_insight)
    print("-" * 30)

    # Top Stories Section
    print(f"\n📰 TOP STORIES (By Market Impact):")
    for i, post in enumerate(sorted_data[:5], 1):
        title = post.get('post_title', 'No Title')
        interactions = post.get('interactions_total', 0)
        source = post.get('creator_display_name', 'Unknown')
        print(f"{i}. {title}")
        print(f"   └─ {source} | 🔥 {interactions:,} interactions")

    print(f"\n{'='*40}")

if __name__ == "__main__":
    result = fetch_lunarcrush_data()
    if result:
        analyze_data(result)
