'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface JobStatus {
  status: 'queued' | 'running' | 'complete' | 'error'
  progress: number
  error?: string
  startedAt?: string
  finishedAt?: string
}

export default function StatusPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId')
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!jobId) {
      router.push('/dashboard/setup')
      return
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/collect/status?jobId=${jobId}`)
        const data = await response.json()
        setStatus(data)
        setLoading(false)

        if (data.status === 'complete') {
          setTimeout(() => {
            router.push('/dashboard/profile')
          }, 2000)
        } else if (data.status === 'error') {
          // Stop polling on error
        } else {
          // Continue polling
          setTimeout(pollStatus, 2000)
        }
      } catch (error) {
        console.error('Error polling status:', error)
        setLoading(false)
      }
    }

    pollStatus()
    const interval = setInterval(pollStatus, 3000)

    return () => clearInterval(interval)
  }, [jobId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="loading"></div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="card">
        <div className="alert alert-error">
          <span>❌</span>
          <span>Job not found</span>
        </div>
      </div>
    )
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'complete': return 'success'
      case 'error': return 'error'
      case 'running': return 'warning'
      default: return 'info'
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Collection Status</div>
            <div className="card-subtitle">Monitoring your brand profile generation</div>
          </div>
          <span className={`badge badge-${getStatusColor()}`}>
            {status.status.toUpperCase()}
          </span>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Progress
            </span>
            <span className="text-sm font-semibold">{status.progress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>

        {status.status === 'running' && (
          <div className="alert alert-info">
            <span>⏳</span>
            <span>Collecting content and generating your brand profile...</span>
          </div>
        )}

        {status.status === 'complete' && (
          <div className="alert alert-success">
            <span>✅</span>
            <span>Brand profile generated successfully! Redirecting to profile...</span>
          </div>
        )}

        {status.status === 'error' && (
          <div className="alert alert-error">
            <span>❌</span>
            <span>Error: {status.error || 'Unknown error occurred'}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6">
          {status.startedAt && (
            <div className="metric-card">
              <div className="metric-label">Started</div>
              <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                {new Date(status.startedAt).toLocaleString()}
              </div>
            </div>
          )}

          {status.finishedAt && (
            <div className="metric-card">
              <div className="metric-label">Finished</div>
              <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                {new Date(status.finishedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-4">
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/dashboard/setup')}
          >
            Back to Setup
          </button>
          {status.status === 'complete' && (
            <button
              className="btn btn-primary"
              onClick={() => router.push('/dashboard/profile')}
            >
              View Profile →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
