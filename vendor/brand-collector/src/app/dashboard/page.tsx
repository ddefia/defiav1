'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Source {
  id: string
  type: 'x' | 'youtube' | 'website'
  handleOrUrl: string
  status: 'pending' | 'connected' | 'error'
}

interface Job {
  id: string
  status: 'queued' | 'running' | 'complete' | 'error'
  progress: number
  createdAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>([])
  const [recentJob, setRecentJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const sourcesRes = await fetch('/api/sources')
      const sourcesData = await sourcesRes.json()
      setSources(sourcesData.sources || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      setLoading(false)
    }
  }

  const handleDeleteSource = async (sourceId: string, handleOrUrl: string) => {
    if (!confirm(`Are you sure you want to delete ${handleOrUrl}?`)) {
      return
    }

    setDeletingId(sourceId)
    try {
      const response = await fetch(`/api/sources?id=${sourceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete source')
      }

      // Refresh the sources list
      await fetchData()
      setDeletingId(null)
    } catch (error) {
      console.error('Error deleting source:', error)
      alert('Failed to delete source. Please try again.')
      setDeletingId(null)
    }
  }

  // Only show X sources
  const xSources = sources.filter(s => s.type === 'x')
  const connectedSources = xSources.filter(s => s.status === 'connected').length
  const totalSources = xSources.length

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="loading"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Connected Sources</div>
          <div className="metric-value">{connectedSources}</div>
          <div className="metric-change positive">
            <span>↑</span>
            <span>{totalSources} Total</span>
          </div>
          <div className="metric-dot success"></div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Content Items</div>
          <div className="metric-value">0</div>
          <div className="metric-change">
            <span>—</span>
            <span>No data yet</span>
          </div>
          <div className="metric-dot"></div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Brand Profiles</div>
          <div className="metric-value">0</div>
          <div className="metric-change">
            <span>—</span>
            <span>Ready to generate</span>
          </div>
          <div className="metric-dot"></div>
        </div>

        <div className="metric-card">
          <div className="metric-label">System Status</div>
          <div className="metric-value" style={{ fontSize: '1.5rem' }}>
            {recentJob ? (
              <span className={`badge badge-${recentJob.status === 'complete' ? 'success' : recentJob.status === 'error' ? 'error' : 'warning'}`}>
                {recentJob.status.toUpperCase()}
              </span>
            ) : (
              'IDLE'
            )}
          </div>
          <div className="metric-status">OPERATIONAL</div>
          <div className="metric-dot success"></div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2">
        {/* Active Sources */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Active Sources</div>
              <div className="card-subtitle">Connected content sources</div>
            </div>
            <button
              className="btn btn-link btn-sm"
              onClick={() => router.push('/dashboard/setup')}
            >
              Manage →
            </button>
          </div>

          {sources.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔗</div>
              <div className="empty-state-title">No sources connected</div>
              <div className="empty-state-text">
                Connect your X (Twitter) accounts to start collecting brand data
              </div>
              <button
                className="btn btn-primary mt-4"
                onClick={() => router.push('/dashboard/setup')}
              >
                Connect Your First Source
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {xSources.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>🐦</span>
                        <span>{source.handleOrUrl}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${source.status === 'connected' ? 'success' : source.status === 'error' ? 'error' : 'warning'}`}>
                        {source.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          className="btn btn-link btn-sm"
                          onClick={() => router.push('/dashboard/setup')}
                        >
                          Manage
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDeleteSource(source.id, source.handleOrUrl)}
                          disabled={deletingId === source.id}
                          style={{
                            background: 'transparent',
                            color: 'var(--color-error)',
                            border: '1px solid var(--color-error)',
                            padding: '0.25rem 0.75rem',
                            fontSize: '0.875rem',
                            opacity: deletingId === source.id ? 0.5 : 1,
                          }}
                        >
                          {deletingId === source.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Collection Status */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Collection Status</div>
              <div className="card-subtitle">Latest brand profile generation</div>
            </div>
          </div>

          {recentJob ? (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Progress
                  </span>
                  <span className="text-sm font-semibold">{recentJob.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${recentJob.progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`badge badge-${recentJob.status === 'complete' ? 'success' : recentJob.status === 'error' ? 'error' : 'warning'}`}>
                  {recentJob.status.toUpperCase()}
                </span>
                <button
                  className="btn btn-link btn-sm"
                  onClick={() => router.push(`/dashboard/status?jobId=${recentJob.id}`)}
                >
                  View Details →
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-text">
                No collection jobs yet. Start your first collection to generate a brand profile.
              </div>
              {connectedSources > 0 && (
                <button
                  className="btn btn-primary mt-4"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/collect/start', { method: 'POST' })
                      const data = await res.json()
                      if (data.jobId) {
                        router.push(`/dashboard/status?jobId=${data.jobId}`)
                      }
                    } catch (error) {
                      console.error('Error starting collection:', error)
                    }
                  }}
                >
                  Start Collection
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Quick Actions</div>
            <div className="card-subtitle">Get started with brand collection</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/dashboard/setup')}
          >
            <span>⚙️</span>
            <span>Connect Sources</span>
          </button>
          {connectedSources > 0 && (
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  const res = await fetch('/api/collect/start', { method: 'POST' })
                  const data = await res.json()
                  if (data.jobId) {
                    router.push(`/dashboard/status?jobId=${data.jobId}`)
                  }
                } catch (error) {
                  console.error('Error starting collection:', error)
                }
              }}
            >
              <span>🚀</span>
              <span>Start Collection</span>
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/dashboard/profile')}
          >
            <span>📄</span>
            <span>View Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
