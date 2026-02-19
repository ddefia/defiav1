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
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const [statsAnimated, setStatsAnimated] = useState(false);
  const [statValues, setStatValues] = useState({ projects: 0, tweets: 0, engagement: 0 });
  const [barsVisible, setBarsVisible] = useState(false);

  const heroWords = ['Never Sleeps', 'Thinks Ahead', 'Drives Growth', 'Creates Content'];

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Rotating hero word carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroWordIndex(prev => (prev + 1) % heroWords.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Trigger bar chart animation after page load
  useEffect(() => {
    const timer = setTimeout(() => setBarsVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Animated stats counter
  useEffect(() => {
    if (isVisible('stats-section') && !statsAnimated) {
      setStatsAnimated(true);
      const duration = 2000;
      const start = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = ease(progress);
        setStatValues({
          projects: Math.round(eased * 12),
          tweets: Math.round(eased * 8500),
          engagement: Math.round(eased * 340),
        });
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }, [visibleSections, statsAnimated]);

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
        {/* Floating particle star field */}
        {!isMobile && Array.from({ length: 25 }).map((_, i) => {
          const size = 2 + Math.random() * 2;
          const left = Math.random() * 100;
          const duration = 8 + Math.random() * 12;
          const delay = Math.random() * 10;
          const opacity = 0.3 + Math.random() * 0.5;
          return (
            <div
              key={`particle-${i}`}
              className="lp-particle"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${left}%`,
                bottom: `-${size}px`,
                opacity: 0,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                boxShadow: `0 0 ${size * 2}px rgba(255,138,76,${opacity})`,
              }}
            />
          );
        })}
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

        /* Particle star field */
        @keyframes lp-particle-drift {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
        }
        .lp-particle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,138,76,0.9), rgba(255,92,0,0.4));
          pointer-events: none;
          animation: lp-particle-drift linear infinite;
        }
        @media (max-width: 768px) {
          .lp-particle { display: none !important; }
        }

        /* Hero word carousel */
        @keyframes lp-word-slide-up {
          0% { transform: translateY(100%); opacity: 0; }
          15% { transform: translateY(0); opacity: 1; }
          85% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
        .lp-word-carousel {
          display: inline-block;
          position: relative;
          overflow: hidden;
          vertical-align: bottom;
          height: 1.1em;
        }
        .lp-word-carousel-inner {
          display: inline-block;
          animation: lp-word-slide-up 3s ease-in-out infinite;
        }

        /* Glowing rotating border */
        @keyframes lp-border-rotate {
          from { --lp-border-angle: 0deg; }
          to { --lp-border-angle: 360deg; }
        }
        .lp-glow-border {
          position: relative;
          z-index: 0;
        }
        .lp-glow-border::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 22px;
          background: conic-gradient(
            from var(--lp-border-angle, 0deg),
            transparent 0%,
            transparent 60%,
            rgba(255,92,0,0.6) 75%,
            rgba(255,138,76,0.8) 80%,
            rgba(255,92,0,0.6) 85%,
            transparent 100%
          );
          z-index: -1;
          animation: lp-border-rotate 8s linear infinite;
          filter: blur(2px);
        }
        .lp-glow-border::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 26px;
          background: conic-gradient(
            from var(--lp-border-angle, 0deg),
            transparent 0%,
            transparent 60%,
            rgba(255,92,0,0.15) 75%,
            rgba(255,138,76,0.25) 80%,
            rgba(255,92,0,0.15) 85%,
            transparent 100%
          );
          z-index: -2;
          animation: lp-border-rotate 8s linear infinite;
          filter: blur(12px);
        }
        @property --lp-border-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        /* Bar chart animation */
        .lp-bar-animated {
          transition: height 1s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .lp-bar-green-animated {
          transition: height 1s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* 3D tilt on feature cards */
        .lp-feature-card-3d {
          transform-style: preserve-3d;
          perspective: 1000px;
          transition: transform 0.15s ease-out;
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
          {[
            { label: 'Features', href: '#features-section' },
            { label: 'How It Works', href: '#how-it-works-section' },
            { label: 'Pricing', href: '#cta-section' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              style={{ fontSize: '14px', fontWeight: 500, color: '#9CA3AF', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FF5C00'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
            >
              {item.label}
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
            <span className="lp-word-carousel">
              <span
                key={heroWordIndex}
                className="lp-word-carousel-inner"
                style={{
                  background: 'linear-gradient(90deg, #FF5C00, #FF8A4C, #FFB380, #FF5C00)',
                  backgroundSize: '300% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'lp-gradient-shift 4s ease infinite, lp-word-slide-up 3s ease-in-out',
                }}
              >
                {heroWords[heroWordIndex]}
              </span>
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
            style={{ gap: '10px', padding: '18px 36px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.3s ease', backdropFilter: 'blur(10px)', position: 'relative' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5C00'; e.currentTarget.style.backgroundColor = 'rgba(255,92,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
            onClick={() => {
              const btn = document.getElementById('demo-toast');
              if (btn) { btn.style.opacity = '1'; btn.style.transform = 'translateY(0)'; setTimeout(() => { btn.style.opacity = '0'; btn.style.transform = 'translateY(8px)'; }, 2000); }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF' }}>Watch Demo</span>
            <span
              id="demo-toast"
              style={{ position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%) translateY(8px)', whiteSpace: 'nowrap', fontSize: '12px', color: '#FF5C00', background: '#1A1A1E', border: '1px solid #2E2E2E', borderRadius: '8px', padding: '6px 14px', opacity: 0, transition: 'all 0.3s ease', pointerEvents: 'none' }}
            >
              Coming soon
            </span>
          </button>
        </div>

        {/* Product Mockup with glowing rotating border */}
        <div
          className="lp-product-mockup lp-glow-border"
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
                      <div className="lp-bar-green-animated" style={{ height: barsVisible ? `${h * 0.4}%` : '0%', borderRadius: '3px 3px 0 0', backgroundColor: '#22C55E30', transitionDelay: `${i * 0.06 + 0.1}s` }} />
                      <div className="lp-bar-animated" style={{ height: barsVisible ? `${h}%` : '0%', borderRadius: '3px 3px 0 0', background: 'linear-gradient(180deg, #FF8A4C 0%, #FF5C00 100%)', opacity: 0.9, transitionDelay: `${i * 0.06}s` }} />
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
            {['METIS', 'LAZAI', 'TOPCHAT', 'NETSWAP', 'ENKIPROTOCOL'].map((name, i) => (
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
          <span style={{ fontFamily: 'DM Mono', fontSize: '12px', fontWeight: 500, color: '#FF5C00', letterSpacing: '4px', textTransform: 'uppercase' }}>PLATFORM</span>
          <h2 className="lp-section-heading" style={{ fontFamily: 'Instrument Serif, serif', fontSize: '52px', fontWeight: 'normal', color: '#FFFFFF', textAlign: 'center', letterSpacing: '-1.5px', maxWidth: '800px', margin: 0 }}>
            One Platform.{' '}
            <span style={{ color: '#FF5C00' }}>Full-Stack Marketing.</span>
          </h2>
          <p className="lp-section-desc" style={{ fontSize: '18px', color: '#6B6B70', textAlign: 'center', lineHeight: 1.7, maxWidth: '600px', margin: 0 }}>
            Strategy, content, execution, and analytics — unified under one AI-native marketing engine built for Web3.
          </p>
        </div>

        {/* Bento grid: 2 large on top, 3 compact on bottom */}
        <div className="lp-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {/* Top row — 2 large feature cards */}
          {[
            {
              icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF5C00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M10 21h4"/></svg>,
              gradient: 'linear-gradient(135deg, #FF5C00, #FF8A4C)',
              title: 'AI CMO Brain',
              desc: 'A 4-agent system that analyzes market conditions, evaluates sentiment, monitors competitors, and formulates multi-day campaign strategies — autonomously.',
              features: ['Multi-agent decision engine', 'Real-time market intelligence', 'Autonomous strategy formulation'],
            },
            {
              icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
              gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
              title: 'Content Studio',
              desc: 'Generate on-brand tweets, threads, and graphic assets from your templates. Every piece matches your voice, references your brand kit, and adapts to context.',
              features: ['Brand-voice–matched copy', 'Template-driven graphic generation', 'Multi-format output (tweets, threads, images)'],
            },
          ].map((f, i) => (
            <div
              key={`top-${i}`}
              className={`lp-feature-card lp-feature-card-3d lp-reveal ${isVisible('features-section') ? 'lp-visible' : ''}`}
              style={{
                padding: '40px',
                borderRadius: '20px',
                backgroundColor: '#0C0C0E',
                border: '1px solid #1A1A1E',
                transitionDelay: `${i * 0.1 + 0.15}s`,
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -3;
                const rotateY = ((x - centerX) / centerX) * 3;
                e.currentTarget.style.transform = `translateY(-8px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
              }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
            >
              <div className="lp-feature-icon" style={{
                width: '48px', height: '48px', borderRadius: '14px', background: f.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              }}>
                {f.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 600, color: '#FFFFFF', margin: '0 0 10px', letterSpacing: '-0.3px' }}>{f.title}</h3>
                <p style={{ fontSize: '15px', color: '#6B6B70', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                {f.features.map((feat) => (
                  <div key={feat} className="flex items-center" style={{ gap: '10px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FF5C00', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row — 3 compact feature cards */}
        <div className="lp-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
          {[
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
              color: '#22C55E',
              title: 'Campaign Automation',
              desc: 'Schedule and execute multi-day campaigns with smart timing and full autopilot.',
            },
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
              color: '#8B5CF6',
              title: 'Real-Time Analytics',
              desc: 'Track engagement, growth, and campaign ROI with actionable performance dashboards.',
            },
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6z"/></svg>,
              color: '#F59E0B',
              title: 'News Intelligence',
              desc: 'AI monitors crypto news and market events to surface timely content opportunities.',
            },
          ].map((f, i) => (
            <div
              key={`btm-${i}`}
              className={`lp-feature-card lp-feature-card-3d lp-reveal ${isVisible('features-section') ? 'lp-visible' : ''}`}
              style={{
                padding: '32px',
                borderRadius: '20px',
                backgroundColor: '#0C0C0E',
                border: '1px solid #1A1A1E',
                transitionDelay: `${i * 0.1 + 0.35}s`,
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -3;
                const rotateY = ((x - centerX) / centerX) * 3;
                e.currentTarget.style.transform = `translateY(-8px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
              }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                backgroundColor: `${f.color}12`, border: `1px solid ${f.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', margin: 0, letterSpacing: '-0.2px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: '#6B6B70', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
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
            { value: statsAnimated ? `${statValues.projects}` : '0', label: 'Brands Onboarded', icon: '🚀' },
            { value: statsAnimated ? `${statValues.tweets.toLocaleString()}+` : '0', label: 'Posts Generated', icon: '✍️' },
            { value: statsAnimated ? `${statValues.engagement}%` : '0%', label: 'Avg. Engagement Boost', icon: '📈' },
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
            Join the Web3 teams already using Defia to automate their marketing and grow their communities.
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
              { title: 'Product', links: [
                { label: 'Features', href: '#features-section' },
                { label: 'Pricing', href: '#cta-section' },
                { label: 'Integrations', href: '#features-section' },
                { label: 'Changelog', href: '#' },
              ]},
              { title: 'Resources', links: [
                { label: 'Documentation', href: '#' },
                { label: 'API Reference', href: '#' },
                { label: 'Blog', href: '#' },
                { label: 'Case Studies', href: '#' },
              ]},
              { title: 'Legal', links: [
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Contact', href: 'mailto:hello@defia.app' },
              ]},
            ].map((col) => (
              <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.5px' }}>{col.title}</span>
                {col.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    style={{ fontSize: '13px', color: '#4A4A4E', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#FF5C00'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#4A4A4E'; }}
                  >
                    {link.label}
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
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Cookie Policy', href: '/privacy' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{ fontSize: '13px', color: '#3A3A3E', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF5C00'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#3A3A3E'; }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
