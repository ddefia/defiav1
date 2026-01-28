'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ReactNode } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    {
      section: 'OVERVIEW',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '▦' },
        { path: '/dashboard/setup', label: 'Setup', icon: '⚙' },
        { path: '/dashboard/status', label: 'Status', icon: '📊' },
        { path: '/dashboard/profile', label: 'Profile', icon: '📄' },
        { path: '/dashboard/external-branding', label: 'External Branding', icon: '🔍' },
        { path: '/dashboard/brands', label: 'Our Brands', icon: '🏢' },
      ],
    },
  ]

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-brand">
            <div className="logo-icon">B</div>
            <div className="logo-text">Brand Collector</div>
          </div>
          <div className="logo-plan">Enterprise Plan</div>
        </div>
        
        <nav className="nav">
          {navItems.map((section) => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-title">{section.section}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.path || 
                  (item.path === '/dashboard' && pathname === '/')
                return (
                  <div
                    key={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => router.push(item.path)}
                  >
                    <div className="nav-item-icon">{item.icon}</div>
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="pulse-item">
            <div className="pulse-dot"></div>
            <span>PULSE</span>
          </div>
          <div className="user-profile">
            <div className="user-avatar">BC</div>
            <div className="user-info">
              <div className="user-name">Brand Collector</div>
              <div className="user-email">admin@brandcollector.com</div>
            </div>
          </div>
        </div>
      </aside>
      
      <main className="main-content">
        <header className="header">
          <div className="header-content">
            <div>
              <div className="header-title">
                {navItems[0].items.find(item => 
                  pathname === item.path || 
                  (item.path === '/dashboard' && pathname === '/')
                )?.label || 'Brand Collector'}
              </div>
              <div className="header-breadcrumb">
                Brand Collector / System Status: <span className="status-online">ONLINE</span>
              </div>
            </div>
            <div className="header-status">
              <div className="status-dot"></div>
              <div className="status-text">COLLECTION ENGINE: LIVE</div>
            </div>
          </div>
        </header>
        <div className="content">
          {children}
        </div>
      </main>
    </div>
  )
}
