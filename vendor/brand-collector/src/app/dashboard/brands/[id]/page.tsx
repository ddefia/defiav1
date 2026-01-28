'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function BrandDetailPage() {
  const router = useRouter()
  const params = useParams()
  const brandId = params.id as string

  const [profile, setProfile] = useState<any>(null)
  const [brandInfo, setBrandInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (brandId) {
      fetchBrandProfile()
    }
  }, [brandId])

  const fetchBrandProfile = async () => {
    try {
      const response = await fetch(`/api/brands/${brandId}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('Brand profile not found')
        } else {
          throw new Error('Failed to fetch brand profile')
        }
        setLoading(false)
        return
      }

      const data = await response.json()
      setProfile(data.profile)
      setBrandInfo({
        id: data.id,
        brandHandle: data.brandHandle,
        isExternal: data.isExternal,
        createdAt: data.createdAt,
        version: data.version,
      })
      setLoading(false)
    } catch (error: any) {
      setError(error.message || 'Failed to load brand profile')
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
    const handleName = brandInfo?.brandHandle?.replace('@', '') || 'brand'
    a.download = `brand-profile-${handleName}-${new Date().toISOString()}.json`
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
            onClick={() => router.push('/dashboard/brands')}
          >
            Back to Brands
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
            <div className="card-title">
              {brandInfo?.brandHandle || 'Brand Profile'}
            </div>
            <div className="card-subtitle">
              Generated on {profile?.meta?.generatedAt ? new Date(profile.meta.generatedAt).toLocaleString() : 'N/A'}
              {brandInfo?.isExternal && ' • External Analysis'}
              {!brandInfo?.isExternal && ' • Connected Account'}
              {brandInfo && ` • Version ${brandInfo.version}`}
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
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push('/dashboard/brands')}
            >
              ← Back
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
    </div>
  )
}
