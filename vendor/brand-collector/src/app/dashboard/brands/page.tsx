'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Brand {
  id: string
  brandHandle: string | null
  isExternal: boolean
  createdAt: string
  version: number
  tweetsAnalyzed: number
  generatedAt?: string
}

export default function BrandsPage() {
  const router = useRouter()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBrands()
  }, [])

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands')
      if (!response.ok) {
        throw new Error('Failed to fetch brands')
      }

      const data = await response.json()
      setBrands(data.brands || [])
    } catch (error: any) {
      setError(error.message || 'Failed to load brands')
    } finally {
      setLoading(false)
    }
  }

  const handleViewBrand = (brandId: string) => {
    router.push(`/dashboard/brands/${brandId}`)
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
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Our Brands</div>
            <div className="card-subtitle">
              All analyzed brands from connected accounts and external analysis
            </div>
          </div>
        </div>

        {brands.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">No brands analyzed yet</div>
            <div className="flex gap-2 justify-center">
              <button
                className="btn btn-primary"
                onClick={() => router.push('/dashboard/setup')}
              >
                Connect an Account
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => router.push('/dashboard/external-branding')}
              >
                Analyze External Brand
              </button>
            </div>
          </div>
        ) : (
          <div className="brands-grid">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="brand-card"
                onClick={() => handleViewBrand(brand.id)}
              >
                <div className="brand-card-header">
                  <div className="brand-handle">
                    {brand.brandHandle || 'Unknown Brand'}
                  </div>
                  <div className={`brand-badge ${brand.isExternal ? 'external' : 'connected'}`}>
                    {brand.isExternal ? 'External' : 'Connected'}
                  </div>
                </div>
                <div className="brand-card-body">
                  <div className="brand-metric">
                    <div className="metric-label">Tweets Analyzed</div>
                    <div className="metric-value">{brand.tweetsAnalyzed}</div>
                  </div>
                  <div className="brand-metric">
                    <div className="metric-label">Version</div>
                    <div className="metric-value">v{brand.version}</div>
                  </div>
                  <div className="brand-metric">
                    <div className="metric-label">Generated</div>
                    <div className="metric-value">
                      {brand.generatedAt
                        ? new Date(brand.generatedAt).toLocaleDateString()
                        : new Date(brand.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="brand-card-footer">
                  <button className="btn btn-primary btn-sm">View Report →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
