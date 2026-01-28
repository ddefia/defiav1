'use client'

import { useState } from 'react'

export default function ExternalBrandingPage() {
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const handleAnalyze = async () => {
    if (!handle.trim()) {
      setError('Please enter an X handle')
      return
    }

    setLoading(true)
    setError('')
    setProfile(null)

    try {
      const response = await fetch('/api/external-branding/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ handle: handle.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to analyze brand')
      }

      const data = await response.json()
      setProfile(data.profile)
    } catch (error: any) {
      setError(error.message || 'Failed to analyze brand')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyJSON = () => {
    if (!profile) return

    navigator.clipboard.writeText(JSON.stringify(profile, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadJSON = () => {
    if (!profile) return

    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const handleName = handle.replace('@', '').trim() || 'external'
    a.download = `brand-profile-${handleName}-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">External Brand Analysis</div>
            <div className="card-subtitle">
              Analyze any X.com account without connecting it
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="handle">X Handle</label>
          <div className="input-group">
            <input
              id="handle"
              type="text"
              placeholder="@netswapofficial"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  handleAnalyze()
                }
              }}
              disabled={loading}
              className="input"
            />
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={loading || !handle.trim()}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <div className="form-hint">
            Enter an X.com handle (with or without @) to generate a brand profile
          </div>
        </div>

        {error && (
          <div className="alert alert-error mt-4">
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center mt-6" style={{ minHeight: '200px' }}>
            <div className="loading"></div>
            <div className="ml-4">Analyzing brand profile...</div>
          </div>
        )}
      </div>

      {profile && (
        <div className="card mb-6">
          <div className="card-header">
            <div>
              <div className="card-title">Brand Profile</div>
              <div className="card-subtitle">
                Generated on {profile?.meta?.generatedAt ? new Date(profile.meta.generatedAt).toLocaleString() : 'N/A'}
                {profile?.meta?.sources?.x && ` • ${profile.meta.sources.x.itemsUsed} tweets analyzed`}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className={`btn btn-secondary btn-sm ${copied ? 'badge-success' : ''}`}
                onClick={handleCopyJSON}
              >
                {copied ? '✓ Copied!' : '📋 Copy JSON'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleDownloadJSON}
              >
                💾 Download
              </button>
            </div>
          </div>

          {/* Profile Summary */}
          {profile?.meta && (
            <div className="metrics-grid mb-6">
              {profile.meta.sources?.x && (
                <div className="metric-card">
                  <div className="metric-label">X Handle</div>
                  <div className="metric-value">{profile.meta.sources.x.handle}</div>
                  <div className="metric-dot success"></div>
                </div>
              )}
              {profile.meta.sources?.x && (
                <div className="metric-card">
                  <div className="metric-label">Tweets Analyzed</div>
                  <div className="metric-value">{profile.meta.sources.x.itemsUsed}</div>
                  <div className="metric-dot success"></div>
                </div>
              )}
            </div>
          )}

          {/* JSON Viewer */}
          <div className="json-viewer">
            <pre>
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card">
        <div className="card-title">How It Works</div>
        <div className="card-subtitle mb-4">Understanding External Brand Analysis</div>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
          <li>Enter any public X.com handle (e.g., @netswapofficial)</li>
          <li>We fetch up to 200 recent tweets from the account</li>
          <li>Our AI analyzes the content to generate a comprehensive brand profile</li>
          <li>The profile includes voice, positioning, content mix, and crypto-specific insights</li>
          <li>No OAuth required - works with any public X account</li>
          <li>Note: Requires at least one connected X account in Setup for API access</li>
        </ul>
      </div>
    </div>
  )
}
