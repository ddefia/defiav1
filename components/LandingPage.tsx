import React, { useEffect, useState } from 'react';

interface LandingPageProps {
  onOpenDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenDashboard }) => {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ backgroundColor: '#0A0A0B', fontFamily: 'Inter, sans-serif' }}>
      {/* Animated Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Moving gradient orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(255,92,0,0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'float1 20s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-30%',
            right: '-20%',
            width: '70%',
            height: '70%',
            background: 'radial-gradient(circle, rgba(255,138,76,0.12) 0%, transparent 70%)',
            filter: 'blur(100px)',
            animation: 'float2 25s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '60%',
            width: '40%',
            height: '40%',
            background: 'radial-gradient(circle, rgba(255,92,0,0.08) 0%, transparent 60%)',
            filter: 'blur(60px)',
            animation: 'float3 18s ease-in-out infinite',
          }}
        />
        {/* Mouse follow glow */}
        <div
          style={{
            position: 'absolute',
            left: mousePos.x - 200,
            top: mousePos.y - 200,
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(255,92,0,0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
            transition: 'left 0.3s ease-out, top 0.3s ease-out',
            pointerEvents: 'none',
          }}
        />
        {/* Grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(rgba(255,92,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,92,0,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            opacity: 0.5,
          }}
        />
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(10%, 5%) scale(1.05); }
          50% { transform: translate(5%, 10%) scale(0.95); }
          75% { transform: translate(-5%, 5%) scale(1.02); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-8%, -5%) scale(1.08); }
          66% { transform: translate(5%, -8%) scale(0.92); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-10%, 10%) rotate(5deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,92,0,0.3), 0 0 40px rgba(255,92,0,0.1); }
          50% { box-shadow: 0 0 30px rgba(255,92,0,0.5), 0 0 60px rgba(255,92,0,0.2); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
        .animate-slide-up-delay-1 { animation: slide-up 0.8s ease-out 0.1s forwards; opacity: 0; }
        .animate-slide-up-delay-2 { animation: slide-up 0.8s ease-out 0.2s forwards; opacity: 0; }
        .animate-slide-up-delay-3 { animation: slide-up 0.8s ease-out 0.3s forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 1s ease-out forwards; }
        .hover-lift { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(255,92,0,0.15); }
        .btn-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .btn-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }
      `}</style>

      {/* Header */}
      <header
        className="flex items-center justify-between sticky top-0 z-50 transition-all duration-300"
        style={{
          padding: '20px 80px',
          backgroundColor: scrollY > 50 ? 'rgba(10,10,11,0.9)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 50 ? '1px solid rgba(255,92,0,0.1)' : 'none',
        }}
      >
        <div className="flex items-center" style={{ gap: '10px' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '20px', fontWeight: 600, letterSpacing: '3px', color: '#FFFFFF' }}>Defia</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FF5C00', animation: 'pulse-glow 2s ease-in-out infinite' }} />
        </div>
        <nav className="flex items-center" style={{ gap: '40px' }}>
          {['Features', 'How It Works', 'Pricing', 'Blog'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="hover-lift"
              style={{ fontSize: '14px', fontWeight: 500, color: '#9CA3AF', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FF5C00'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center" style={{ gap: '16px' }}>
          <button
            onClick={onOpenDashboard}
            style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#FF5C00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#FFFFFF'}
          >
            Log in
          </button>
          <button
            onClick={onOpenDashboard}
            className="flex items-center btn-glow"
            style={{
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #FF5C00 0%, #FF8A4C 100%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Get Started</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center relative z-10" style={{ padding: '100px 80px 80px', gap: '48px' }}>
        {/* Badge */}
        <div className="flex items-center animate-slide-up" style={{ gap: '8px', padding: '8px 16px', borderRadius: '100px', backgroundColor: '#FF5C0015', border: '1px solid #FF5C0044' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF5C00"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#FF5C00' }}>AI-Powered Marketing for Web3</span>
        </div>

        {/* Hero Content */}
        <div className="flex flex-col items-center" style={{ gap: '24px', maxWidth: '900px' }}>
          <h1 className="animate-slide-up-delay-1" style={{ fontFamily: 'Instrument Serif, serif', fontSize: '72px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', letterSpacing: '-2px', lineHeight: 1.1, margin: 0 }}>
            Your Web3 CMO That{' '}
            <span style={{
              background: 'linear-gradient(90deg, #FF5C00, #FF8A4C, #FF5C00)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'shimmer 3s linear infinite',
            }}>
              Never Sleeps
            </span>
          </h1>
          <p className="animate-slide-up-delay-2" style={{ fontSize: '20px', fontWeight: 'normal', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6, maxWidth: '700px', margin: 0 }}>
            Defia analyzes trends, generates content, and executes campaigns automatically. Focus on building your project while AI handles your marketing.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="flex items-center animate-slide-up-delay-3" style={{ gap: '16px' }}>
          <button
            onClick={onOpenDashboard}
            className="flex items-center btn-glow"
            style={{
              gap: '10px',
              padding: '16px 32px',
              borderRadius: '10px',
              background: 'linear-gradient(180deg, #FF5C00 0%, #FF8A4C 100%)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <div className="btn-shimmer" style={{ position: 'absolute', inset: 0 }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', position: 'relative' }}>Start Free Trial</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button
            className="flex items-center hover-lift"
            style={{ gap: '10px', padding: '16px 32px', borderRadius: '10px', background: 'transparent', border: '1px solid #2A2A2E', cursor: 'pointer', transition: 'border-color 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5C00'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2A2A2E'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF' }}>Watch Demo</span>
          </button>
        </div>

        {/* Product Mockup */}
        <div
          className="hover-lift"
          style={{
            width: '1100px',
            borderRadius: '16px',
            border: '1px solid #1F1F23',
            backgroundColor: '#111113',
            overflow: 'hidden',
            boxShadow: '0 20px 100px #FF5C0033',
            transform: `translateY(${scrollY * 0.05}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          {/* Mockup Header */}
          <div className="flex items-center justify-between" style={{ padding: '12px 16px', backgroundColor: '#0A0A0B', borderBottom: '1px solid #1F1F23' }}>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FF5F57' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FEBC2E' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#28C840' }} />
            </div>
            <span style={{ fontFamily: 'DM Mono', fontSize: '12px', color: '#6B6B70' }}>Defia Dashboard</span>
            <div style={{ width: '68px' }} />
          </div>
          {/* Mockup Content */}
          <div className="flex" style={{ height: '550px', backgroundColor: '#0A0A0B' }}>
            {/* Sidebar */}
            <div style={{ width: '220px', padding: '20px 16px', borderRight: '1px solid #1F1F23', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flex items-center" style={{ gap: '8px', paddingBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #FF5C00 0%, #FF8A4C 100%)' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Defia</span>
              </div>
              {[
                { name: 'Dashboard', icon: '⊞', active: true },
                { name: 'Campaigns', icon: '📋', active: false },
                { name: 'Content Studio', icon: '✏️', active: false },
                { name: 'AI CMO', icon: '🤖', active: false },
                { name: 'Analytics', icon: '📊', active: false }
              ].map((item) => (
                <div key={item.name} className="flex items-center" style={{ gap: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: item.active ? '#FF5C0015' : 'transparent' }}>
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: item.active ? '#FF5C00' : '#6B6B70' }}>{item.name}</span>
                </div>
              ))}
            </div>
            {/* Main Area */}
            <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '20px', fontWeight: 600, color: '#FFFFFF' }}>Dashboard Overview</span>
                <div className="flex items-center" style={{ gap: '8px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#1F1F23' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6B70" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span style={{ fontSize: '13px', color: '#9CA3AF' }}>Last 7 days</span>
                </div>
              </div>
              {/* Stats Row */}
              <div className="flex" style={{ gap: '16px' }}>
                {[
                  { label: 'Total Impressions', value: '2.4M', change: '+23.5%', color: '#FF5C00' },
                  { label: 'Engagement Rate', value: '8.7%', change: '+4.2%', color: '#3B82F6' },
                  { label: 'New Followers', value: '12.8K', change: '+18.9%', color: '#22C55E' },
                  { label: 'Posts Generated', value: '147', change: 'This week', color: '#8B5CF6' }
                ].map((stat) => (
                  <div key={stat.label} style={{ flex: 1, padding: '16px', borderRadius: '12px', backgroundColor: '#111113', border: '1px solid #1F1F23' }}>
                    <div style={{ fontSize: '12px', color: '#6B6B70', marginBottom: '8px' }}>{stat.label}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '28px', fontWeight: 500, color: stat.color, letterSpacing: '-1px' }}>{stat.value}</div>
                    <div style={{ fontSize: '12px', color: '#22C55E', marginTop: '4px' }}>{stat.change}</div>
                  </div>
                ))}
              </div>
              {/* Chart Area */}
              <div style={{ flex: 1, padding: '20px', borderRadius: '12px', backgroundColor: '#111113', border: '1px solid #1F1F23' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Performance Overview</span>
                  <div className="flex items-center" style={{ gap: '16px' }}>
                    <div className="flex items-center" style={{ gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#FF5C00' }} />
                      <span style={{ fontSize: '12px', color: '#6B6B70' }}>Impressions</span>
                    </div>
                    <div className="flex items-center" style={{ gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#22C55E' }} />
                      <span style={{ fontSize: '12px', color: '#6B6B70' }}>Engagement</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-end" style={{ gap: '12px', height: '200px' }}>
                  {[35, 45, 40, 55, 50, 65, 60, 75, 70, 85, 80, 95].map((h, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'stretch' }}>
                      <div style={{ height: `${h * 0.4}%`, borderRadius: '4px 4px 0 0', backgroundColor: '#22C55E40' }} />
                      <div style={{ height: `${h}%`, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg, #FF8A4C 0%, #FF5C00 100%)' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Section */}
        <div className="flex flex-col items-center" style={{ gap: '24px', paddingTop: '40px', width: '100%' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#6B6B70' }}>Trusted by leading Web3 projects</span>
          <div className="flex items-center" style={{ gap: '60px' }}>
            {['SOLANA', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE'].map((name, i) => (
              <span
                key={name}
                style={{
                  fontFamily: 'DM Mono',
                  fontSize: '18px',
                  fontWeight: 500,
                  color: '#4A4A4E',
                  letterSpacing: '2px',
                  animation: `fade-in 0.5s ease-out ${i * 0.1}s forwards`,
                  opacity: 0,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ padding: '100px 80px', backgroundColor: '#111113', position: 'relative', zIndex: 10 }}>
        <div className="flex flex-col items-center" style={{ gap: '16px', marginBottom: '64px' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF5C00', letterSpacing: '3px' }}>FEATURES</span>
          <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: '48px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', letterSpacing: '-1px', maxWidth: '800px', margin: 0 }}>
            Everything You Need to Dominate Web3 Marketing
          </h2>
          <p style={{ fontSize: '18px', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6, maxWidth: '600px', margin: 0 }}>
            From trend analysis to content creation to automated posting — all powered by AI that understands crypto.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Row 1 */}
          <div className="flex" style={{ gap: '24px' }}>
            {[
              { icon: '🧠', iconBg: 'linear-gradient(135deg, #FF5C00, #FF8A4C)', title: 'AI CMO Brain', desc: 'Your dedicated AI marketing executive that analyzes market trends, competitor moves, and community sentiment around the clock.', features: ['Real-time market analysis', 'Competitor tracking', 'Sentiment monitoring'] },
              { icon: '✍️', iconBg: '#3B82F620', iconColor: '#3B82F6', title: 'Content Generation', desc: 'Generate tweets, threads, and announcements that match your brand voice and resonate with your crypto audience.', features: ['Brand voice matching', 'Thread generation', 'Multi-format content'] },
              { icon: '📅', iconBg: '#22C55E20', iconColor: '#22C55E', title: 'Campaign Automation', desc: 'Schedule and execute multi-day campaigns across Twitter, Discord, and Telegram with full automation.', features: ['Multi-platform posting', 'Smart scheduling', 'Campaign templates'] }
            ].map((f, i) => (
              <div
                key={i}
                className="hover-lift"
                style={{ flex: 1, padding: '32px', borderRadius: '16px', backgroundColor: '#0A0A0B', border: '1px solid #1F1F23', transition: 'border-color 0.3s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5C0040'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1F1F23'; }}
              >
                <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '12px', background: f.iconBg, marginBottom: '20px' }}>
                  <span style={{ fontSize: '24px' }}>{f.icon}</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', margin: '0 0 12px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: 1.6, margin: '0 0 20px' }}>{f.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {f.features.map((feat) => (
                    <div key={feat} className="flex items-center" style={{ gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5C00" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: '13px', color: '#D1D5DB' }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Row 2 */}
          <div className="flex" style={{ gap: '24px' }}>
            {[
              { icon: '📈', iconBg: '#8B5CF620', title: 'Real-Time Analytics', desc: 'Track engagement, follower growth, and campaign performance with actionable insights and detailed reports.', features: ['Performance dashboards', 'ROI tracking', 'Growth metrics'] },
              { icon: '📰', iconBg: '#F59E0B20', title: 'News Integration', desc: 'AI monitors crypto news and market events to suggest timely, relevant content based on trending topics.', features: ['Trend detection', 'News aggregation', 'Timely suggestions'] },
              { icon: '👥', iconBg: '#EC489920', title: 'Community Growth', desc: 'Build and engage your community with AI-powered responses, engagement strategies, and growth tactics.', features: ['Engagement automation', 'Reply suggestions', 'Follower insights'] }
            ].map((f, i) => (
              <div
                key={i}
                className="hover-lift"
                style={{ flex: 1, padding: '32px', borderRadius: '16px', backgroundColor: '#0A0A0B', border: '1px solid #1F1F23', transition: 'border-color 0.3s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5C0040'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1F1F23'; }}
              >
                <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: f.iconBg, marginBottom: '20px' }}>
                  <span style={{ fontSize: '24px' }}>{f.icon}</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', margin: '0 0 12px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: 1.6, margin: '0 0 20px' }}>{f.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {f.features.map((feat) => (
                    <div key={feat} className="flex items-center" style={{ gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5C00" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: '13px', color: '#D1D5DB' }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={{ padding: '100px 80px', backgroundColor: '#0A0A0B', position: 'relative', zIndex: 10 }}>
        <div className="flex flex-col items-center" style={{ gap: '16px', marginBottom: '64px' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF5C00', letterSpacing: '3px' }}>HOW IT WORKS</span>
          <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: '48px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', letterSpacing: '-1px', margin: 0 }}>
            Three Steps to Marketing Autopilot
          </h2>
        </div>

        <div className="flex" style={{ gap: '32px' }}>
          {[
            { num: '1', numStyle: { background: 'linear-gradient(135deg, #FF5C00, #FF8A4C)', color: '#FFFFFF' }, title: 'Connect Your Brand', desc: 'Link your Twitter, Discord, and upload your brand kit. AI learns your voice in minutes.', visual: 'connect' },
            { num: '2', numStyle: { background: '#1A1A1D', border: '2px solid #FF5C00', color: '#FF5C00' }, title: 'Get AI Recommendations', desc: 'AI CMO analyzes trends and suggests campaigns. Review, approve, and customize as needed.', visual: 'recommend' },
            { num: '3', numStyle: { background: '#1A1A1D', border: '2px solid #2A2A2E', color: '#6B6B70' }, title: 'Watch It Execute', desc: 'Content gets posted automatically. Track performance in real-time from your dashboard.', visual: 'execute' }
          ].map((step, i) => (
            <div
              key={i}
              className="flex flex-col items-center hover-lift"
              style={{ flex: 1, padding: '40px', borderRadius: '20px', backgroundColor: '#111113', border: '1px solid #1F1F23', gap: '24px' }}
            >
              <div className="flex items-center justify-center" style={{ width: '72px', height: '72px', borderRadius: '50%', ...step.numStyle }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '28px', fontWeight: 600 }}>{step.num}</span>
              </div>
              <div className="flex flex-col items-center" style={{ gap: '12px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#FFFFFF', textAlign: 'center', margin: 0 }}>{step.title}</h3>
                <p style={{ fontSize: '15px', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </div>
              {/* Visual */}
              <div style={{ width: '100%', height: '140px', borderRadius: '12px', backgroundColor: '#0A0A0B', position: 'relative', overflow: 'hidden' }}>
                {step.visual === 'connect' && (
                  <div className="flex items-center justify-center" style={{ height: '100%', gap: '20px' }}>
                    {[{ bg: '#1DA1F220', icon: '𝕏' }, { bg: '#5865F220', icon: '💬' }, { bg: '#FF5C0020', icon: '📁' }].map((ic, idx) => (
                      <div key={idx} className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: ic.bg, animation: `bounce-subtle 2s ease-in-out ${idx * 0.2}s infinite` }}>
                        <span style={{ fontSize: '20px' }}>{ic.icon}</span>
                      </div>
                    ))}
                  </div>
                )}
                {step.visual === 'recommend' && (
                  <div className="flex items-center justify-center" style={{ height: '100%' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#1A1A1D', border: '1px solid #FF5C0040', boxShadow: '0 16px 32px #FF5C0020' }}>
                      <div className="flex items-center" style={{ gap: '6px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', color: '#FF5C00' }}>✨ AI Suggestion</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#FFFFFF', marginBottom: '8px' }}>Launch Twitter Spaces about...</div>
                      <div className="flex" style={{ gap: '8px' }}>
                        <button style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#22C55E', border: 'none', fontSize: '10px', color: '#FFFFFF' }}>Approve</button>
                        <button style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#3B82F6', border: 'none', fontSize: '10px', color: '#FFFFFF' }}>Edit</button>
                      </div>
                    </div>
                  </div>
                )}
                {step.visual === 'execute' && (
                  <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: '8px' }}>
                    <div className="flex items-center" style={{ gap: '20px' }}>
                      {[1, 2, 3, 4].map((_, idx) => (
                        <React.Fragment key={idx}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: idx < 3 ? '#22C55E' : '#2A2A2E', animation: idx < 3 ? `pulse-glow 1.5s ease-in-out ${idx * 0.3}s infinite` : 'none' }} />
                          {idx < 3 && <div style={{ width: '30px', height: '2px', backgroundColor: '#2A2A2E' }} />}
                        </React.Fragment>
                      ))}
                    </div>
                    <span style={{ fontSize: '10px', color: '#22C55E' }}>Auto-posting in progress...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof Section */}
      <section style={{ padding: '100px 80px', backgroundColor: '#111113', position: 'relative', zIndex: 10 }}>
        {/* Stats Row */}
        <div className="flex justify-around" style={{ padding: '48px 60px', borderRadius: '20px', backgroundColor: '#0A0A0B', border: '1px solid #1F1F23', marginBottom: '80px' }}>
          {[
            { icon: '👥', iconBg: '#FF5C0015', iconColor: '#FF5C00', value: '500+', valueColor: '#FF5C00', label: 'Active Projects' },
            { icon: '💬', iconBg: '#3B82F615', iconColor: '#3B82F6', value: '2.4M', valueColor: '#FFFFFF', label: 'Tweets Generated' },
            { icon: '📈', iconBg: '#22C55E15', iconColor: '#22C55E', value: '340%', valueColor: '#FFFFFF', label: 'Avg. Engagement Increase' },
            { icon: '🕐', iconBg: '#8B5CF615', iconColor: '#8B5CF6', value: '24/7', valueColor: '#FFFFFF', label: 'AI Monitoring' }
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center" style={{ gap: '8px' }}>
              <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: stat.iconBg }}>
                <span style={{ fontSize: '24px' }}>{stat.icon}</span>
              </div>
              <span style={{ fontFamily: 'DM Mono', fontSize: '56px', fontWeight: 500, color: stat.valueColor, letterSpacing: '-2px' }}>{stat.value}</span>
              <span style={{ fontSize: '16px', color: '#9CA3AF' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="flex flex-col items-center" style={{ gap: '40px' }}>
          <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: '36px', fontWeight: 'normal', color: '#FFFFFF', letterSpacing: '-1px', margin: 0 }}>
            Loved by Web3 Builders
          </h2>
          <div className="flex" style={{ gap: '24px', width: '100%' }}>
            {[
              { quote: '"Defia completely transformed our marketing. We went from struggling to post daily to having a full content calendar running on autopilot. Our engagement is up 400%."', author: 'Alex Chen', role: 'Founder, DeFi Protocol', color: '#FF5C00' },
              { quote: '"The AI recommendations are scary good. It suggested a Twitter Spaces about a trending topic and we got 5x our normal listeners. It\'s like having a marketing team that never sleeps."', author: 'Sarah Kim', role: 'Marketing Lead, NFT Project', color: '#3B82F6' },
              { quote: '"We used to spend 20 hours a week on content. Now it\'s 2 hours reviewing what Defia generates. The quality is indistinguishable from human-written content."', author: 'Mike Johnson', role: 'Community Manager', color: '#22C55E' }
            ].map((t, i) => (
              <div
                key={i}
                className="hover-lift"
                style={{ flex: 1, padding: '32px', borderRadius: '16px', backgroundColor: '#1A1A1D', border: `1px solid ${t.color}30`, boxShadow: i === 0 ? `0 30px 60px ${t.color}10` : 'none' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill={`${t.color}30`} style={{ marginBottom: '24px' }}><path d="M10 11H6.2c.1-.8.5-1.8 1.3-2.7C8.3 7.4 9.5 6.7 11 6.3l-.5-1.8c-1.8.5-3.3 1.4-4.5 2.7C4.7 8.5 4 10.2 4 12.2V18h6v-7zm10 0h-3.8c.1-.8.5-1.8 1.3-2.7.8-.9 2-1.6 3.5-2l-.5-1.8c-1.8.5-3.3 1.4-4.5 2.7-1.3 1.3-2 3-2 5V18h6v-7z"/></svg>
                <p style={{ fontSize: '16px', fontStyle: 'italic', color: '#D1D5DB', lineHeight: 1.7, margin: '0 0 24px' }}>{t.quote}</p>
                <div className="flex items-center" style={{ gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `linear-gradient(135deg, ${t.color}40, ${t.color}20)` }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{t.author}</div>
                    <div style={{ fontSize: '13px', color: '#6B6B70' }}>{t.role}</div>
                  </div>
                </div>
                <div className="flex" style={{ gap: '4px', marginTop: '16px' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section style={{ padding: '100px 80px', background: 'linear-gradient(0deg, #1A0A00 0%, #0A0A0B 100%)', position: 'relative', overflow: 'hidden', zIndex: 10 }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, #FF5C0025 0%, transparent 70%)', filter: 'blur(60px)', animation: 'float1 15s ease-in-out infinite' }} />

        {/* Floating icons */}
        {[
          { icon: '🚀', left: '150px', top: '120px', size: 56 },
          { icon: '⚡', right: '200px', top: '150px', size: 48 },
          { icon: '✨', left: '100px', bottom: '150px', size: 44 },
          { icon: '🎯', right: '150px', bottom: '120px', size: 40 }
        ].map((f, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{
              position: 'absolute',
              left: f.left,
              right: f.right,
              top: f.top,
              bottom: f.bottom,
              width: `${f.size}px`,
              height: `${f.size}px`,
              borderRadius: `${f.size / 4}px`,
              backgroundColor: '#1A1A1D',
              border: '1px solid #2A2A2E',
              boxShadow: '0 20px 40px #00000040',
              animation: `bounce-subtle 3s ease-in-out ${i * 0.5}s infinite`,
            }}
          >
            <span style={{ fontSize: `${f.size * 0.5}px` }}>{f.icon}</span>
          </div>
        ))}

        <div className="flex flex-col items-center" style={{ position: 'relative', gap: '24px' }}>
          <div style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: 'rgba(255, 92, 0, 0.15)', border: '1px solid rgba(255, 92, 0, 0.3)' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF5C00', letterSpacing: '0.5px' }}>Limited Early Access</span>
          </div>
          <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: '56px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', margin: 0 }}>
            Ready to 10x Your Web3 Marketing?
          </h2>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', lineHeight: 1.6, maxWidth: '600px', margin: 0 }}>
            Join 500+ Web3 projects already using Defia to automate their marketing and grow their communities.
          </p>
          <div className="flex items-center" style={{ gap: '16px', marginTop: '16px' }}>
            <button
              onClick={onOpenDashboard}
              className="flex items-center btn-glow"
              style={{
                gap: '10px',
                padding: '18px 36px',
                borderRadius: '12px',
                background: 'linear-gradient(180deg, #FF7A2E 0%, #FF5C00 100%)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div className="btn-shimmer" style={{ position: 'absolute', inset: 0 }} />
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', position: 'relative' }}>Start Free Trial</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button
              className="hover-lift"
              style={{ padding: '18px 36px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', transition: 'border-color 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5C00'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
            >
              <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF' }}>Schedule Demo</span>
            </button>
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.4)', margin: '8px 0 0' }}>
            No credit card required · Free 14-day trial · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '64px 80px', background: 'linear-gradient(180deg, #111113 0%, #0A0A0B 100%)', borderTop: '1px solid #1F1F23', position: 'relative', zIndex: 10 }}>
        <div className="flex justify-between" style={{ marginBottom: '48px' }}>
          <div style={{ maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <div className="flex items-center justify-center" style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #FF7A2E, #FF5C00)' }}>
                <span style={{ fontSize: '16px', color: '#FFFFFF' }}>D</span>
              </div>
              <span style={{ fontFamily: 'DM Mono', fontSize: '20px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '2px' }}>Defia</span>
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.6, margin: 0 }}>
              The AI-powered CMO for Web3 projects. Automate your marketing, grow your community, dominate your narrative.
            </p>
            <div className="flex" style={{ gap: '12px' }}>
              {['𝕏', '💬', '⌨️'].map((icon, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center hover-lift"
                  style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#1A1A1D', cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FF5C0020'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1A1A1D'; }}
                >
                  <span style={{ fontSize: '16px' }}>{icon}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex" style={{ gap: '80px' }}>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
              { title: 'Resources', links: ['Documentation', 'API Reference', 'Blog', 'Case Studies'] },
              { title: 'Company', links: ['About', 'Careers', 'Contact', 'Partners'] }
            ].map((col) => (
              <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{col.title}</span>
                {col.links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#FF5C00'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'; }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: '1px', backgroundColor: '#1F1F23', marginBottom: '32px' }} />
        <div className="flex items-center justify-between">
          <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.4)' }}>© 2025 Defia. All rights reserved.</span>
          <div className="flex items-center" style={{ gap: '24px' }}>
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((link) => (
              <a
                key={link}
                href="#"
                style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF5C00'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'; }}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
