'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Source {
  id: string
  type: 'x' | 'youtube' | 'website'
  handleOrUrl: string
  status: 'pending' | 'connected' | 'error'
}

export default function SetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(false)
  const [xHandle, setXHandle] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (searchParams.get('success') === 'x_connected') {
      setSuccess('X account connected successfully!')
    } else if (searchParams.get('error')) {
      setError('OAuth connection failed. Please try again.')
    }
  }, [searchParams])

  useEffect(() => {
    fetchSources()
  }, [])

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources')
      const data = await response.json()
      setSources(data.sources || [])

      // Only fetch X sources
    } catch (error) {
      console.error('Error fetching sources:', error)
    }
  }

  const handleConnectX = async () => {
    const handle = xHandle.trim()
    if (!handle) {
      setError('Please enter an X handle')
      return
    }

    // Check if handle already exists
    const existingSource = xSources.find(
      (s) => s.handleOrUrl.toLowerCase() === handle.toLowerCase()
    )
    if (existingSource) {
      setError('This X handle is already connected')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'x', value: handle }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create source')
      }

      // Clear input and immediately redirect to OAuth
      setXHandle('')
      // Force immediate redirect - don't wait for React state updates
      window.location.href = `/api/oauth/x/start?handle=${encodeURIComponent(handle)}`
    } catch (error: any) {
      setError(error.message || 'Failed to start X connection')
      setLoading(false)
    }
  }


  const handleStartCollection = async () => {
    const connectedSources = sources.filter((s) => s.status === 'connected')
    
    if (connectedSources.length === 0) {
      setError('Please connect at least one X account before starting')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/collect/start', {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start collection')
      }

      const data = await response.json()
      router.push(`/dashboard/status?jobId=${data.jobId}`)
    } catch (error: any) {
      setError(error.message || 'Failed to start collection')
      setLoading(false)
    }
  }

  const xSources = sources.filter((s) => s.type === 'x')
  const hasConnectedSource = xSources.some((s) => s.status === 'connected')

  const handleDeleteSource = async (sourceId: string) => {
    const source = sources.find((s) => s.id === sourceId)
    if (!confirm(`Are you sure you want to delete ${source?.handleOrUrl || 'this profile'}?`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/sources?id=${sourceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete source')
      }

      setSuccess('Profile deleted successfully!')
      setLoading(false)
      await fetchSources()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to delete profile')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Source Configuration</div>
              <div className="card-subtitle">Connect your X (Twitter) accounts to build brand profiles</div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {/* X Sources - Multiple Profiles */}
          <div className="source-card">
            <div className="source-header">
              <div className="source-icon" style={{ background: '#1DA1F2', color: 'white' }}>
                🐦
              </div>
              <div className="source-info">
                <h3>X (Twitter) Profiles</h3>
                <p>Connect multiple X accounts to collect tweets and analyze your voice</p>
              </div>
            </div>

            {/* List of connected X accounts - only show connected, not pending */}
            {xSources.filter(s => s.status === 'connected').length > 0 && (
              <div className="mb-4">
                {xSources
                  .filter(s => s.status === 'connected')
                  .map((source) => (
                  <div
                    key={source.id}
                    className="alert alert-success"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span>
                      <span>✅</span>
                      <span style={{ marginLeft: '0.5rem' }}>
                        Connected: {source.handleOrUrl}
                      </span>
                    </span>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleDeleteSource(source.id)}
                      disabled={loading}
                      style={{
                        background: 'transparent',
                        color: 'var(--color-error)',
                        border: '1px solid var(--color-error)',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new X account */}
            <div className="form-group">
              <label className="label">Add X Handle</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="@username"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  disabled={loading}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleConnectX}
                  disabled={loading || !xHandle.trim()}
                >
                  {xSources.length > 0 ? 'Add Another' : 'Connect X Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Collection */}
      {hasConnectedSource && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Ready to Build Brand Profile</div>
              <div className="card-subtitle">Start collecting and analyzing your brand content</div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStartCollection}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? (
              <>
                <span className="loading"></span>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Start Building Brand Profile</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
