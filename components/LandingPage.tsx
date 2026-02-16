import React, { useEffect, useState, useRef } from 'react';

interface LandingPageProps {
  onOpenDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenDashboard }) => {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const [showMobileModal, setShowMobileModal] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const handleGetStarted = () => {
    if (isMobile) {
      setShowMobileModal(true);
    } else {
      onOpenDashboard();
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const setSectionRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  const isVisible = (id: string) => visibleSections.has(id);

  return (
    <div className="min-h-full text-white overflow-x-hidden" style={{ backgroundColor: '#0A0A0B', fontFamily: 'Inter, sans-serif' }}>
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
            background: 'radial-gradient(circle, rgba(255,92,0,0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'lp-float1 20s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-30%',
            right: '-20%',
            width: '70%',
            height: '70%',
            background: 'radial-gradient(circle, rgba(255,138,76,0.08) 0%, transparent 70%)',
            filter: 'blur(100px)',
            animation: 'lp-float2 25s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '60%',
            width: '40%',
            height: '40%',
            background: 'radial-gradient(circle, rgba(255,92,0,0.06) 0%, transparent 60%)',
            filter: 'blur(60px)',
            animation: 'lp-float3 18s ease-in-out infinite',
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
            background: 'radial-gradient(circle, rgba(255,92,0,0.05) 0%, transparent 70%)',
            filter: 'blur(40px)',
            transition: 'left 0.3s ease-out, top 0.3s ease-out',
            pointerEvents: 'none',
          }}
        />
        {/* Subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(rgba(255,92,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,92,0,0.02) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
            opacity: 0.4,
          }}
        />
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes lp-float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(10%, 5%) scale(1.05); }
          50% { transform: translate(5%, 10%) scale(0.95); }
          75% { transform: translate(-5%, 5%) scale(1.02); }
        }
        @keyframes lp-float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-8%, -5%) scale(1.08); }
          66% { transform: translate(5%, -8%) scale(0.92); }
        }
        @keyframes lp-float3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-10%, 10%) rotate(5deg); }
        }
        @keyframes lp-pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,92,0,0.3), 0 0 40px rgba(255,92,0,0.1); }
          50% { box-shadow: 0 0 30px rgba(255,92,0,0.5), 0 0 60px rgba(255,92,0,0.2); }
        }
        @keyframes lp-slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lp-scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes lp-bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes lp-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes lp-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes lp-counter {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-draw-line {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes lp-rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes lp-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes lp-typewriter {
          from { width: 0; }
          to { width: 100%; }
        }

        .lp-slide-up { animation: lp-slide-up 0.8s ease-out forwards; }
        .lp-slide-up-d1 { animation: lp-slide-up 0.8s ease-out 0.15s forwards; opacity: 0; }
        .lp-slide-up-d2 { animation: lp-slide-up 0.8s ease-out 0.3s forwards; opacity: 0; }
        .lp-slide-up-d3 { animation: lp-slide-up 0.8s ease-out 0.45s forwards; opacity: 0; }
        .lp-fade-in { animation: lp-fade-in 1s ease-out forwards; }
        .lp-scale-in { animation: lp-scale-in 0.6s ease-out forwards; }
        .lp-hover-lift { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .lp-hover-lift:hover { transform: translateY(-6px); box-shadow: 0 24px 48px rgba(255,92,0,0.15); }
        .lp-btn-glow { animation: lp-pulse-glow 2s ease-in-out infinite; }
        .lp-btn-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: lp-shimmer 3s infinite;
        }

        /* Feature card hover effects */
        .lp-feature-card {
          position: relative;
          overflow: hidden;
          transition: transform 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
        }
        .lp-feature-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,92,0,0.06), transparent 40%);
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
        }
        .lp-feature-card:hover::before { opacity: 1; }
        .lp-feature-card:hover {
          transform: translateY(-8px);
          border-color: rgba(255,92,0,0.3) !important;
          box-shadow: 0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,92,0,0.15);
        }
        .lp-feature-card .lp-feature-icon {
          transition: transform 0.4s ease, box-shadow 0.4s ease;
        }
        .lp-feature-card:hover .lp-feature-icon {
          transform: scale(1.1);
          box-shadow: 0 8px 24px rgba(255,92,0,0.2);
        }

        /* Scroll reveal */
        .lp-reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .lp-reveal.lp-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .lp-reveal-d1 { transition-delay: 0.1s; }
        .lp-reveal-d2 { transition-delay: 0.2s; }
        .lp-reveal-d3 { transition-delay: 0.3s; }
        .lp-reveal-d4 { transition-delay: 0.4s; }
        .lp-reveal-d5 { transition-delay: 0.5s; }

        /* Stat counter */
        .lp-stat-value {
          background: linear-gradient(180deg, #FFFFFF 0%, #9CA3AF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Testimonial card */
        .lp-testimonial {
          transition: transform 0.4s ease, box-shadow 0.4s ease;
        }
        .lp-testimonial:hover {
          transform: translateY(-4px) scale(1.02);
        }

        /* ===== Mobile Responsive ===== */
        @media (max-width: 768px) {
          .lp-header {
            padding: 16px 20px !important;
          }
          .lp-header-nav {
            display: none !important;
          }
          .lp-hero {
            padding: 60px 20px 40px !important;
            gap: 32px !important;
          }
          .lp-hero h1 {
            font-size: 36px !important;
            letter-spacing: -1px !important;
          }
          .lp-hero-subtitle {
            font-size: 16px !important;
            padding: 0 8px;
          }
          .lp-hero-ctas {
            flex-direction: column !important;
            width: 100% !important;
            padding: 0 8px;
          }
          .lp-hero-ctas button {
            width: 100% !important;
            justify-content: center;
          }
          .lp-product-mockup {
            display: none !important;
          }
          .lp-trust-logos {
            gap: 24px !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            padding: 0 16px;
          }
          .lp-trust-logos span {
            font-size: 12px !important;
            letter-spacing: 2px !important;
          }
          .lp-section {
            padding: 60px 20px !important;
          }
          .lp-section-heading {
            font-size: 32px !important;
            letter-spacing: -1px !important;
          }
          .lp-section-desc {
            font-size: 15px !important;
          }
          .lp-features-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .lp-hiw-steps {
            flex-direction: column !important;
            gap: 16px !important;
          }
          .lp-hiw-line {
            display: none !important;
          }
          .lp-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 32px 20px !important;
            gap: 24px !important;
          }
          .lp-stat-value {
            font-size: 32px !important;
          }
          .lp-testimonials-row {
            flex-direction: column !important;
            gap: 16px !important;
          }
          .lp-cta-section {
            padding: 80px 20px !important;
          }
          .lp-cta-section h2 {
            font-size: 32px !important;
            letter-spacing: -1px !important;
          }
          .lp-cta-buttons {
            flex-direction: column !important;
            width: 100% !important;
          }
          .lp-cta-buttons button {
            width: 100% !important;
            justify-content: center;
          }
          .lp-floating-icon {
            display: none !important;
          }
          .lp-footer {
            padding: 48px 20px !important;
          }
          .lp-footer-top {
            flex-direction: column !important;
            gap: 40px !important;
          }
          .lp-footer-links {
            flex-wrap: wrap !important;
            gap: 32px !important;
          }
          .lp-footer-bottom {
            flex-direction: column !important;
            gap: 16px !important;
            align-items: center !important;
            text-align: center;
          }
          .lp-footer-bottom-links {
            flex-wrap: wrap !important;
            justify-content: center !important;
          }
        }
      `}</style>

      {/* Mobile Modal */}
      {showMobileModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', padding: '24px' }}>
          <div style={{ maxWidth: '360px', width: '100%', padding: '40px 28px', borderRadius: '20px', backgroundColor: '#111113', border: '1px solid #1F1F23', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #FF5C00, #FF8A4C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '32px' }}>💻</span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Desktop Required</h3>
            <p style={{ fontSize: '15px', color: '#9CA3AF', lineHeight: 1.7, margin: 0 }}>
              Defia is optimized for desktop. Please open <span style={{ color: '#FF5C00', fontWeight: 500 }}>app.defia.io</span> on your laptop or desktop to get started.
            </p>
            <button
              onClick={() => setShowMobileModal(false)}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #FF5C00 0%, #FF8A4C 100%)', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className="lp-header flex items-center justify-between sticky top-0 z-50 transition-all duration-300"
        style={{
          padding: '20px 80px',
          backgroundColor: scrollY > 50 ? 'rgba(10,10,11,0.92)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 50 ? '1px solid rgba(255,92,0,0.08)' : 'none',
        }}
      >
        <div className="flex items-center" style={{ gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #FF5C00, #FF8A4C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#FFF' }}>D</span>
          </div>
          <span style={{ fontFamily: 'DM Mono', fontSize: '20px', fontWeight: 600, letterSpacing: '3px', color: '#FFFFFF' }}>Defia</span>
        </div>
        <nav className="lp-header-nav flex items-center" style={{ gap: '40px' }}>
          {['Features', 'How It Works', 'Pricing'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
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
            onClick={handleGetStarted}
            style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#FF5C00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#FFFFFF'}
          >
            Log in
          </button>
          <button
            onClick={handleGetStarted}
            className="flex items-center lp-btn-glow"
            style={{
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #FF5C00 0%, #FF8A4C 100%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s',
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
      <section className="lp-hero flex flex-col items-center relative z-10" style={{ padding: '120px 80px 80px', gap: '48px' }}>
        {/* Badge */}
        <div className="flex items-center lp-slide-up" style={{ gap: '10px', padding: '8px 20px', borderRadius: '100px', backgroundColor: '#FF5C0010', border: '1px solid #FF5C0030', backdropFilter: 'blur(10px)' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 8px #22C55E', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '-2px', borderRadius: '50%', backgroundColor: '#22C55E', animation: 'lp-ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#FF8A4C', letterSpacing: '0.5px' }}>AI-Powered Marketing for Web3</span>
        </div>

        {/* Hero Content */}
        <div className="flex flex-col items-center" style={{ gap: '28px', maxWidth: '900px' }}>
          <h1 className="lp-slide-up-d1" style={{ fontFamily: 'Instrument Serif, serif', fontSize: '76px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', letterSpacing: '-2.5px', lineHeight: 1.05, margin: 0 }}>
            Your Web3 CMO That{' '}
            <span style={{
              background: 'linear-gradient(90deg, #FF5C00, #FF8A4C, #FFB380, #FF5C00)',
              backgroundSize: '300% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'lp-gradient-shift 4s ease infinite',
            }}>
              Never Sleeps
            </span>
          </h1>
          <p className="lp-hero-subtitle lp-slide-up-d2" style={{ fontSize: '20px', fontWeight: 400, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.7, maxWidth: '680px', margin: 0 }}>
            Defia analyzes trends, generates content, and executes campaigns automatically. Focus on building while AI handles your marketing.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="lp-hero-ctas flex items-center lp-slide-up-d3" style={{ gap: '16px' }}>
          <button
            onClick={handleGetStarted}
            className="flex items-center lp-btn-glow"
            style={{
              gap: '10px',
              padding: '18px 36px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FF5C00 0%, #FF8A4C 100%)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <div className="lp-btn-shimmer" style={{ position: 'absolute', inset: 0 }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', position: 'relative' }}>Start Free Trial</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button
            className="flex items-center"
            style={{ gap: '10px', padding: '18px 36px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.3s ease', backdropFilter: 'blur(10px)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5C00'; e.currentTarget.style.backgroundColor = 'rgba(255,92,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF' }}>Watch Demo</span>
          </button>
        </div>

        {/* Product Mockup with enhanced glow */}
        <div
          className="lp-product-mockup"
          style={{
            width: '1100px',
            borderRadius: '20px',
            border: '1px solid rgba(255,92,0,0.15)',
            backgroundColor: '#111113',
            overflow: 'hidden',
            boxShadow: '0 40px 120px rgba(255,92,0,0.15), 0 0 0 1px rgba(255,92,0,0.05)',
            transform: `translateY(${scrollY * 0.03}px)`,
            transition: 'transform 0.1s ease-out, box-shadow 0.3s ease',
          }}
        >
          {/* Browser Chrome */}
          <div className="flex items-center justify-between" style={{ padding: '14px 18px', backgroundColor: '#0A0A0B', borderBottom: '1px solid #1F1F23' }}>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FF5F57' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FEBC2E' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#28C840' }} />
            </div>
            <div style={{ padding: '4px 16px', borderRadius: '6px', backgroundColor: '#1A1A1D', border: '1px solid #2E2E2E' }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: '#6B6B70' }}>app.defia.io/dashboard</span>
            </div>
            <div style={{ width: '68px' }} />
          </div>
          {/* Dashboard Mockup */}
          <div className="flex" style={{ height: '500px', backgroundColor: '#0A0A0B' }}>
            {/* Sidebar */}
            <div style={{ width: '200px', padding: '16px 12px', borderRight: '1px solid #1F1F23', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="flex items-center" style={{ gap: '8px', padding: '0 8px 16px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #FF5C00, #FF8A4C)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Defia</span>
              </div>
              {[
                { name: 'Dashboard', icon: '⊞', active: true },
                { name: 'Campaigns', icon: '📋' },
                { name: 'Content Studio', icon: '✏️' },
                { name: 'AI CMO', icon: '🤖' },
                { name: 'Analytics', icon: '📊' }
              ].map((item) => (
                <div key={item.name} className="flex items-center" style={{ gap: '10px', padding: '8px 10px', borderRadius: '8px', backgroundColor: item.active ? '#FF5C0015' : 'transparent' }}>
                  <span style={{ fontSize: '14px' }}>{item.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: item.active ? '#FF5C00' : '#6B6B70' }}>{item.name}</span>
                </div>
              ))}
            </div>
            {/* Main Content */}
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>Dashboard Overview</span>
                <div className="flex items-center" style={{ gap: '8px', padding: '6px 12px', borderRadius: '8px', backgroundColor: '#1F1F23' }}>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Last 7 days</span>
                </div>
              </div>
              {/* Stats */}
              <div className="flex" style={{ gap: '12px' }}>
                {[
                  { label: 'Total Impressions', value: '2.4M', change: '+23.5%', color: '#FF5C00' },
                  { label: 'Engagement Rate', value: '8.7%', change: '+4.2%', color: '#3B82F6' },
                  { label: 'New Followers', value: '12.8K', change: '+18.9%', color: '#22C55E' },
                  { label: 'Posts Generated', value: '147', change: 'This week', color: '#8B5CF6' }
                ].map((stat) => (
                  <div key={stat.label} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#111113', border: '1px solid #1F1F23' }}>
                    <div style={{ fontSize: '11px', color: '#6B6B70', marginBottom: '6px' }}>{stat.label}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '24px', fontWeight: 500, color: stat.color, letterSpacing: '-1px' }}>{stat.value}</div>
                    <div style={{ fontSize: '11px', color: '#22C55E', marginTop: '4px' }}>{stat.change}</div>
                  </div>
                ))}
              </div>
              {/* Chart */}
              <div style={{ flex: 1, padding: '16px', borderRadius: '12px', backgroundColor: '#111113', border: '1px solid #1F1F23' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Performance</span>
                  <div className="flex items-center" style={{ gap: '16px' }}>
                    {[{ color: '#FF5C00', label: 'Impressions' }, { color: '#22C55E', label: 'Engagement' }].map(l => (
                      <div key={l.label} className="flex items-center" style={{ gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: l.color }} />
                        <span style={{ fontSize: '11px', color: '#6B6B70' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-end" style={{ gap: '10px', height: '180px' }}>
                  {[35, 45, 40, 55, 50, 65, 60, 75, 70, 85, 80, 95].map((h, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'stretch' }}>
                      <div style={{ height: `${h * 0.4}%`, borderRadius: '3px 3px 0 0', backgroundColor: '#22C55E30' }} />
                      <div style={{ height: `${h}%`, borderRadius: '3px 3px 0 0', background: 'linear-gradient(180deg, #FF8A4C 0%, #FF5C00 100%)', opacity: 0.9 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Logos */}
        <div className="flex flex-col items-center" style={{ gap: '24px', paddingTop: '48px', width: '100%' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#4A4A4E', letterSpacing: '1px', textTransform: 'uppercase' }}>Trusted by leading Web3 projects</span>
          <div className="lp-trust-logos flex items-center" style={{ gap: '64px' }}>
            {['SOLANA', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE'].map((name, i) => (
              <span
                key={name}
                style={{
                  fontFamily: 'DM Mono',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#3A3A3E',
                  letterSpacing: '3px',
                  animation: `lp-fade-in 0.6s ease-out ${0.6 + i * 0.1}s forwards`,
                  opacity: 0,
                  transition: 'color 0.3s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#6B6B70'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#3A3A3E'}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features-section"
        ref={setSectionRef('features-section')}
        className="lp-section"
        style={{ padding: '120px 80px', position: 'relative', zIndex: 10 }}
      >
        <div className={`flex flex-col items-center lp-reveal ${isVisible('features-section') ? 'lp-visible' : ''}`} style={{ gap: '16px', marginBottom: '72px' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF5C00', letterSpacing: '4px', textTransform: 'uppercase' }}>FEATURES</span>
          <h2 className="lp-section-heading" style={{ fontFamily: 'Instrument Serif, serif', fontSize: '52px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', letterSpacing: '-1.5px', maxWidth: '800px', margin: 0 }}>
            Everything You Need to Dominate{' '}
            <span style={{ color: '#FF5C00' }}>Web3 Marketing</span>
          </h2>
          <p className="lp-section-desc" style={{ fontSize: '18px', color: '#6B6B70', textAlign: 'center', lineHeight: 1.7, maxWidth: '600px', margin: 0 }}>
            From trend analysis to content creation to automated posting — all powered by AI that understands crypto.
          </p>
        </div>

        <div className="lp-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {[
            { icon: '🧠', gradient: 'linear-gradient(135deg, #FF5C00, #FF8A4C)', title: 'AI CMO Brain', desc: 'Your AI marketing executive analyzing market trends, competitor moves, and community sentiment 24/7.', features: ['Real-time market analysis', 'Competitor intelligence', 'Sentiment monitoring'], tag: 'Core' },
            { icon: '✍️', gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)', title: 'Content Generation', desc: 'Generate tweets, threads, and announcements that match your brand voice and resonate with your audience.', features: ['Brand voice matching', 'Thread generation', 'Multi-format content'], tag: 'Create' },
            { icon: '📅', gradient: 'linear-gradient(135deg, #22C55E, #4ADE80)', title: 'Campaign Automation', desc: 'Schedule and execute multi-day campaigns across platforms with full automation and smart timing.', features: ['Multi-platform posting', 'Smart scheduling', 'Campaign templates'], tag: 'Automate' },
            { icon: '📈', gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', title: 'Real-Time Analytics', desc: 'Track engagement, follower growth, and campaign performance with actionable insights.', features: ['Performance dashboards', 'Growth metrics', 'ROI tracking'], tag: 'Measure' },
            { icon: '📰', gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)', title: 'News Integration', desc: 'AI monitors crypto news and market events to suggest timely, relevant content for your brand.', features: ['Trend detection', 'News aggregation', 'Timely suggestions'], tag: 'Discover' },
            { icon: '👥', gradient: 'linear-gradient(135deg, #EC4899, #F472B6)', title: 'Community Growth', desc: 'Build and engage your community with AI-powered responses and growth strategies.', features: ['Engagement automation', 'Reply suggestions', 'Growth tactics'], tag: 'Grow' }
          ].map((f, i) => (
            <div
              key={i}
              className={`lp-feature-card lp-reveal ${isVisible('features-section') ? 'lp-visible' : ''}`}
              style={{
                padding: '36px',
                borderRadius: '20px',
                backgroundColor: '#0C0C0E',
                border: '1px solid #1A1A1E',
                transitionDelay: `${(i % 3) * 0.1 + 0.2}s`,
                cursor: 'default',
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
              }}
            >
              {/* Tag */}
              <div style={{ marginBottom: '20px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
                  color: '#FF5C00', backgroundColor: '#FF5C0012', padding: '4px 10px', borderRadius: '4px',
                }}>{f.tag}</span>
              </div>

              {/* Icon */}
              <div
                className="lp-feature-icon"
                style={{
                  width: '56px', height: '56px', borderRadius: '16px', background: f.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                <span style={{ fontSize: '28px' }}>{f.icon}</span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#FFFFFF', margin: '0 0 12px', letterSpacing: '-0.3px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: '#6B6B70', lineHeight: 1.7, margin: '0 0 24px' }}>{f.desc}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {f.features.map((feat) => (
                  <div key={feat} className="flex items-center" style={{ gap: '10px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#FF5C0015', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF5C00" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works-section"
        ref={setSectionRef('how-it-works-section')}
        className="lp-section"
        style={{ padding: '120px 80px', backgroundColor: '#080809', position: 'relative', zIndex: 10 }}
      >
        {/* Background accent */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse, rgba(255,92,0,0.04) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div className={`flex flex-col items-center lp-reveal ${isVisible('how-it-works-section') ? 'lp-visible' : ''}`} style={{ gap: '16px', marginBottom: '72px' }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF5C00', letterSpacing: '4px' }}>HOW IT WORKS</span>
          <h2 className="lp-section-heading" style={{ fontFamily: 'Instrument Serif, serif', fontSize: '52px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', letterSpacing: '-1.5px', margin: 0 }}>
            Three Steps to{' '}<span style={{ color: '#FF5C00' }}>Marketing Autopilot</span>
          </h2>
        </div>

        <div className="lp-hiw-steps flex items-stretch" style={{ gap: '24px', position: 'relative' }}>
          {/* Connecting line */}
          <div className="lp-hiw-line" style={{ position: 'absolute', top: '60px', left: 'calc(33.33% - 12px)', right: 'calc(33.33% - 12px)', height: '2px', background: 'linear-gradient(90deg, #FF5C0040, #FF5C00, #FF5C0040)', zIndex: 1 }} />

          {[
            { num: '01', title: 'Connect Your Brand', desc: 'Link your Twitter account and upload your brand kit. The AI learns your voice, tone, and audience in minutes.', visual: 'connect', accentColor: '#FF5C00' },
            { num: '02', title: 'Get AI Recommendations', desc: 'Your AI CMO analyzes trends and suggests campaigns, tweets, and strategies. Review and customize as needed.', visual: 'recommend', accentColor: '#3B82F6' },
            { num: '03', title: 'Watch It Execute', desc: 'Content gets posted automatically on your schedule. Track performance in real-time from your dashboard.', visual: 'execute', accentColor: '#22C55E' }
          ].map((step, i) => (
            <div
              key={i}
              className={`lp-reveal ${isVisible('how-it-works-section') ? 'lp-visible' : ''}`}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '48px 36px', borderRadius: '24px',
                backgroundColor: '#0C0C0E', border: '1px solid #1A1A1E',
                gap: '28px', position: 'relative', zIndex: 2,
                transitionDelay: `${i * 0.15 + 0.2}s`,
                transition: 'opacity 0.7s ease, transform 0.7s ease, box-shadow 0.4s ease, border-color 0.4s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${step.accentColor}30`; e.currentTarget.style.boxShadow = `0 32px 64px ${step.accentColor}10`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A1A1E'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Step Number */}
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: i === 0 ? 'linear-gradient(135deg, #FF5C00, #FF8A4C)' : '#111113',
                border: i === 0 ? 'none' : `2px solid ${step.accentColor}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: i === 0 ? '0 8px 32px rgba(255,92,0,0.25)' : 'none',
              }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '24px', fontWeight: 600, color: i === 0 ? '#FFFFFF' : step.accentColor }}>{step.num}</span>
              </div>

              <div className="flex flex-col items-center" style={{ gap: '12px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 600, color: '#FFFFFF', textAlign: 'center', margin: 0 }}>{step.title}</h3>
                <p style={{ fontSize: '15px', color: '#6B6B70', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
              </div>

              {/* Visual */}
              <div style={{ width: '100%', height: '140px', borderRadius: '14px', backgroundColor: '#080809', border: '1px solid #1A1A1E', position: 'relative', overflow: 'hidden' }}>
                {step.visual === 'connect' && (
                  <div className="flex items-center justify-center" style={{ height: '100%', gap: '24px' }}>
                    {[
                      { bg: '#1DA1F218', border: '#1DA1F230', icon: '𝕏' },
                      { bg: '#FF5C0018', border: '#FF5C0030', icon: '📁' },
                      { bg: '#22C55E18', border: '#22C55E30', icon: '✓' }
                    ].map((ic, idx) => (
                      <div key={idx} className="flex items-center justify-center" style={{
                        width: '52px', height: '52px', borderRadius: '14px',
                        backgroundColor: ic.bg, border: `1px solid ${ic.border}`,
                        animation: `lp-bounce-subtle 3s ease-in-out ${idx * 0.3}s infinite`
                      }}>
                        <span style={{ fontSize: '22px' }}>{ic.icon}</span>
                      </div>
                    ))}
                  </div>
                )}
                {step.visual === 'recommend' && (
                  <div className="flex items-center justify-center" style={{ height: '100%' }}>
                    <div style={{ padding: '14px 18px', borderRadius: '12px', backgroundColor: '#111113', border: '1px solid #FF5C0030', boxShadow: '0 16px 32px rgba(255,92,0,0.08)' }}>
                      <div className="flex items-center" style={{ gap: '6px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px' }}>✨</span>
                        <span style={{ fontSize: '11px', color: '#FF5C00', fontWeight: 600 }}>AI Suggestion</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#FFFFFF', marginBottom: '10px' }}>Launch Twitter Spaces about...</div>
                      <div className="flex" style={{ gap: '8px' }}>
                        <div style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#22C55E', fontSize: '10px', color: '#FFFFFF', fontWeight: 600 }}>Approve</div>
                        <div style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#3B82F6', fontSize: '10px', color: '#FFFFFF', fontWeight: 600 }}>Edit</div>
                      </div>
                    </div>
                  </div>
                )}
                {step.visual === 'execute' && (
                  <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: '12px' }}>
                    <div className="flex items-center" style={{ gap: '16px' }}>
                      {[0, 1, 2, 3].map((idx) => (
                        <React.Fragment key={idx}>
                          <div style={{
                            width: '14px', height: '14px', borderRadius: '50%',
                            backgroundColor: idx < 3 ? '#22C55E' : '#2A2A2E',
                            boxShadow: idx < 3 ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                          }} />
                          {idx < 3 && <div style={{ width: '32px', height: '2px', backgroundColor: idx < 2 ? '#22C55E60' : '#2A2A2E' }} />}
                        </React.Fragment>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 500 }}>Auto-posting in progress...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats / Social Proof Section */}
      <section
        id="stats-section"
        ref={setSectionRef('stats-section')}
        className="lp-section"
        style={{ padding: '120px 80px', position: 'relative', zIndex: 10 }}
      >
        {/* Stats Row */}
        <div className={`lp-stats-grid lp-reveal ${isVisible('stats-section') ? 'lp-visible' : ''}`} style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px',
          padding: '56px 48px', borderRadius: '24px',
          backgroundColor: '#0C0C0E', border: '1px solid #1A1A1E',
          marginBottom: '100px',
        }}>
          {[
            { value: '500+', label: 'Active Projects', icon: '👥' },
            { value: '2.4M', label: 'Tweets Generated', icon: '💬' },
            { value: '340%', label: 'Avg. Engagement Boost', icon: '📈' },
            { value: '24/7', label: 'AI Monitoring', icon: '🕐' }
          ].map((stat, i) => (
            <div key={stat.label} className={`flex flex-col items-center lp-reveal ${isVisible('stats-section') ? 'lp-visible' : ''}`} style={{ gap: '12px', transitionDelay: `${i * 0.1 + 0.2}s` }}>
              <span style={{ fontSize: '28px', marginBottom: '4px' }}>{stat.icon}</span>
              <span className="lp-stat-value" style={{ fontFamily: 'DM Mono', fontSize: '48px', fontWeight: 600, letterSpacing: '-2px' }}>{stat.value}</span>
              <span style={{ fontSize: '14px', color: '#6B6B70', fontWeight: 500 }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className={`flex flex-col items-center lp-reveal ${isVisible('stats-section') ? 'lp-visible' : ''}`} style={{ gap: '48px' }}>
          <div className="flex flex-col items-center" style={{ gap: '12px' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF5C00', letterSpacing: '4px' }}>TESTIMONIALS</span>
            <h2 className="lp-section-heading" style={{ fontFamily: 'Instrument Serif, serif', fontSize: '44px', fontWeight: 'normal', color: '#FFFFFF', letterSpacing: '-1px', margin: 0 }}>
              Loved by Web3 Builders
            </h2>
          </div>
          <div className="lp-testimonials-row flex" style={{ gap: '20px', width: '100%' }}>
            {[
              { quote: 'Defia completely transformed our marketing. We went from struggling to post daily to having a full content calendar running on autopilot.', author: 'Alex Chen', role: 'Founder, DeFi Protocol', color: '#FF5C00', metric: '+400% engagement' },
              { quote: 'The AI recommendations are next level. It suggested a trending topic strategy and we got 5x our normal reach. Like having a team that never sleeps.', author: 'Sarah Kim', role: 'Marketing Lead, NFT Project', color: '#3B82F6', metric: '5x reach increase' },
              { quote: 'We used to spend 20 hours a week on content. Now it\'s 2 hours reviewing what Defia generates. The quality rivals human-written content.', author: 'Mike Johnson', role: 'Community Manager', color: '#22C55E', metric: '-90% time spent' }
            ].map((t, i) => (
              <div
                key={i}
                className={`lp-testimonial lp-reveal ${isVisible('stats-section') ? 'lp-visible' : ''}`}
                style={{
                  flex: 1, padding: '36px', borderRadius: '20px',
                  backgroundColor: '#0C0C0E', border: `1px solid ${t.color}15`,
                  transitionDelay: `${i * 0.1 + 0.4}s`,
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Metric badge */}
                <div style={{ marginBottom: '24px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 600, color: t.color,
                    backgroundColor: `${t.color}12`, padding: '6px 12px', borderRadius: '6px',
                  }}>{t.metric}</span>
                </div>

                {/* Stars */}
                <div className="flex" style={{ gap: '4px', marginBottom: '20px' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                </div>

                <p style={{ fontSize: '15px', fontStyle: 'italic', color: '#9CA3AF', lineHeight: 1.8, margin: '0 0 28px', flex: 1 }}>"{t.quote}"</p>

                <div className="flex items-center" style={{ gap: '14px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${t.color}30, ${t.color}10)`,
                    border: `1px solid ${t.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: t.color }}>{t.author[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{t.author}</div>
                    <div style={{ fontSize: '12px', color: '#4A4A4E' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section
        id="cta-section"
        ref={setSectionRef('cta-section')}
        className="lp-cta-section"
        style={{ padding: '140px 80px', position: 'relative', overflow: 'hidden', zIndex: 10 }}
      >
        {/* Background effects */}
        <div style={{ position: 'absolute', top: '-150px', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '500px', background: 'radial-gradient(ellipse, rgba(255,92,0,0.12) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'lp-float1 15s ease-in-out infinite', pointerEvents: 'none' }} />

        {/* Floating icons */}
        {[
          { icon: '🚀', left: '12%', top: '20%', size: 56, delay: 0 },
          { icon: '⚡', right: '15%', top: '25%', size: 48, delay: 0.5 },
          { icon: '✨', left: '8%', bottom: '25%', size: 44, delay: 1 },
          { icon: '🎯', right: '10%', bottom: '20%', size: 40, delay: 1.5 }
        ].map((f, i) => (
          <div
            key={i}
            className="lp-floating-icon flex items-center justify-center"
            style={{
              position: 'absolute',
              left: f.left,
              right: (f as any).right,
              top: f.top,
              bottom: (f as any).bottom,
              width: `${f.size}px`,
              height: `${f.size}px`,
              borderRadius: `${f.size / 3}px`,
              backgroundColor: '#111113',
              border: '1px solid #1A1A1E',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              animation: `lp-bounce-subtle 4s ease-in-out ${f.delay}s infinite`,
            }}
          >
            <span style={{ fontSize: `${f.size * 0.45}px` }}>{f.icon}</span>
          </div>
        ))}

        <div className={`flex flex-col items-center lp-reveal ${isVisible('cta-section') ? 'lp-visible' : ''}`} style={{ position: 'relative', gap: '28px' }}>
          <div style={{ padding: '8px 20px', borderRadius: '100px', backgroundColor: 'rgba(255, 92, 0, 0.08)', border: '1px solid rgba(255, 92, 0, 0.2)' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF8A4C', letterSpacing: '1px' }}>Limited Early Access</span>
          </div>
          <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: '60px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', margin: 0, letterSpacing: '-2px' }}>
            Ready to 10x Your{' '}
            <span style={{
              background: 'linear-gradient(90deg, #FF5C00, #FF8A4C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Web3 Marketing?</span>
          </h2>
          <p style={{ fontSize: '18px', color: '#6B6B70', textAlign: 'center', lineHeight: 1.7, maxWidth: '560px', margin: 0 }}>
            Join 500+ Web3 projects already using Defia to automate their marketing and grow their communities.
          </p>
          <div className="lp-cta-buttons flex items-center" style={{ gap: '16px', marginTop: '12px' }}>
            <button
              onClick={handleGetStarted}
              className="flex items-center lp-btn-glow"
              style={{
                gap: '10px',
                padding: '20px 40px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #FF5C00 0%, #FF8A4C 100%)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div className="lp-btn-shimmer" style={{ position: 'absolute', inset: 0 }} />
              <span style={{ fontSize: '17px', fontWeight: 600, color: '#FFFFFF', position: 'relative' }}>Start Free Trial</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button
              className="flex items-center"
              style={{ padding: '20px 40px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer', transition: 'all 0.3s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5C00'; e.currentTarget.style.backgroundColor = 'rgba(255,92,0,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
            >
              <span style={{ fontSize: '17px', fontWeight: 500, color: '#FFFFFF' }}>Schedule Demo</span>
            </button>
          </div>
          <p style={{ fontSize: '13px', color: '#4A4A4E', margin: '4px 0 0' }}>
            No credit card required · Free 24-hour trial · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer" style={{ padding: '64px 80px', backgroundColor: '#080809', borderTop: '1px solid #141416', position: 'relative', zIndex: 10 }}>
        <div className="lp-footer-top flex justify-between" style={{ marginBottom: '48px' }}>
          <div style={{ maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #FF5C00, #FF8A4C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>D</span>
              </div>
              <span style={{ fontFamily: 'DM Mono', fontSize: '20px', fontWeight: 600, color: '#FFFFFF', letterSpacing: '2px' }}>Defia</span>
            </div>
            <p style={{ fontSize: '14px', color: '#4A4A4E', lineHeight: 1.7, margin: 0 }}>
              The AI-powered CMO for Web3 projects. Automate your marketing, grow your community, dominate your narrative.
            </p>
            <div className="flex" style={{ gap: '10px' }}>
              {['𝕏', '💬', '⌨️'].map((icon, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center"
                  style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#111113', border: '1px solid #1A1A1E', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FF5C0015'; e.currentTarget.style.borderColor = '#FF5C0030'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#111113'; e.currentTarget.style.borderColor = '#1A1A1E'; }}
                >
                  <span style={{ fontSize: '14px' }}>{icon}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-footer-links flex" style={{ gap: '80px' }}>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
              { title: 'Resources', links: ['Documentation', 'API Reference', 'Blog', 'Case Studies'] },
              { title: 'Company', links: ['About', 'Careers', 'Contact', 'Partners'] }
            ].map((col) => (
              <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.5px' }}>{col.title}</span>
                {col.links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    style={{ fontSize: '13px', color: '#4A4A4E', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#FF5C00'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#4A4A4E'; }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: '1px', backgroundColor: '#141416', marginBottom: '32px' }} />
        <div className="lp-footer-bottom flex items-center justify-between">
          <span style={{ fontSize: '13px', color: '#3A3A3E' }}>© {new Date().getFullYear()} Defia. All rights reserved.</span>
          <div className="lp-footer-bottom-links flex items-center" style={{ gap: '24px' }}>
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((link) => (
              <a
                key={link}
                href="#"
                style={{ fontSize: '13px', color: '#3A3A3E', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF5C00'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#3A3A3E'; }}
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
