export interface BrandCollectorInputs {
  brandName: string;
  domains: string[];
  xHandles: string[];
  youtube?: string;
}

export interface BrandCollectorResult {
  profile: any | null;
  mode: 'collector' | 'fallback';
}

const getCollectorBaseUrl = () => {
  return import.meta.env.VITE_BRAND_COLLECTOR_BASE_URL || '';
};

export const runBrandCollector = async (inputs: BrandCollectorInputs): Promise<BrandCollectorResult> => {
  const baseUrl = getCollectorBaseUrl();
  if (!baseUrl) {
    return { profile: null, mode: 'fallback' };
  }

  const handle = inputs.xHandles[0];
  if (!handle) {
    return { profile: null, mode: 'fallback' };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/external-branding/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Brand collector request failed');
  }

  const data = await response.json();
  return { profile: data.profile || null, mode: 'collector' };
};
