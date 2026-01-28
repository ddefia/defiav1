'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/brand-profile/latest')
      if (!response.ok) {
        if (response.status === 404) {
          setError('No brand profile found. Please start a collection first.')
        } else {
          throw new Error('Failed to fetch profile')
        }
        setLoading(false)
        return
      }

      const data = await response.json()
      setProfile(data)
      setLoading(false)
    } catch (error: any) {
      setError(error.message || 'Failed to load profile')
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
    a.download = `brand-profile-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="loading"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="card">
          <div className="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
          </div>
          <button
            className="btn btn-primary mt-4"
            onClick={() => router.push('/dashboard/setup')}
          >
            Go to Setup
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Brand Profile</div>
            <div className="card-subtitle">
              Generated on {profile?.meta?.generatedAt ? new Date(profile.meta.generatedAt).toLocaleString() : 'N/A'}
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
                <div className="metric-label">X Posts Analyzed</div>
                <div className="metric-value">{profile.meta.sources.x.itemsUsed}</div>
                <div className="metric-dot success"></div>
              </div>
            )}
            {profile.meta.sources?.youtube && (
              <div className="metric-card">
                <div className="metric-label">YouTube Videos</div>
                <div className="metric-value">{profile.meta.sources.youtube.itemsUsed}</div>
                <div className="metric-dot success"></div>
              </div>
            )}
            {profile.meta.sources?.website && (
              <div className="metric-card">
                <div className="metric-label">Website Pages</div>
                <div className="metric-value">{profile.meta.sources.website.itemsUsed}</div>
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

      {/* Actions */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <div className="card-title">Actions</div>
            <div className="card-subtitle">Manage your brand profile</div>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/dashboard/setup')}
            >
              Create New Profile
            </button>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
