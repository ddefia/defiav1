interface GithubRepoItem {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
}

/**
 * Extract a likely GitHub org/user name from a website domain.
 * e.g., "https://www.defiaxyz.com" → "defiaxyz"
 *       "https://uniswap.org" → "uniswap"
 */
const extractOrgFromDomain = (domain: string): string | null => {
  try {
    const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
    const host = url.hostname.replace(/^www\./, '');
    // Take the first part of the domain (before the TLD)
    const name = host.split('.')[0];
    if (name && name.length >= 2) return name;
  } catch { }
  return null;
};

/**
 * Try to find repos belonging to a specific GitHub org/user first.
 * Falls back to a scoped search if the org doesn't exist.
 */
export const researchGithubBrandSignals = async (
  brandName: string,
  websiteUrl?: string
): Promise<string[]> => {
  if (!brandName.trim()) return [];

  try {
    // Strategy 1: Try to find a GitHub org matching the website domain
    const orgName = websiteUrl ? extractOrgFromDomain(websiteUrl) : null;

    if (orgName) {
      // First, check if this org exists on GitHub
      const orgRes = await fetch(`https://api.github.com/orgs/${orgName}/repos?sort=stars&per_page=5`);
      if (orgRes.ok) {
        const repos = (await orgRes.json()) as GithubRepoItem[];
        if (repos.length > 0) {
          return repos.slice(0, 3).map((repo) => {
            const description = repo.description ? ` — ${repo.description}` : '';
            return `GitHub: ${repo.full_name}${description} (${repo.stargazers_count}★) ${repo.html_url}`;
          });
        }
      }

      // Org not found — try as a user account
      const userRes = await fetch(`https://api.github.com/users/${orgName}/repos?sort=stars&per_page=5`);
      if (userRes.ok) {
        const repos = (await userRes.json()) as GithubRepoItem[];
        if (repos.length > 0) {
          return repos.slice(0, 3).map((repo) => {
            const description = repo.description ? ` — ${repo.description}` : '';
            return `GitHub: ${repo.full_name}${description} (${repo.stargazers_count}★) ${repo.html_url}`;
          });
        }
      }
    }

    // Strategy 2: Search with org qualifier if we have a domain-derived name
    if (orgName) {
      const scopedQuery = encodeURIComponent(`org:${orgName}`);
      const scopedRes = await fetch(`https://api.github.com/search/repositories?q=${scopedQuery}&sort=stars&order=desc&per_page=3`);
      if (scopedRes.ok) {
        const data = (await scopedRes.json()) as { items?: GithubRepoItem[] };
        if (data.items && data.items.length > 0) {
          return data.items.map((repo) => {
            const description = repo.description ? ` — ${repo.description}` : '';
            return `GitHub: ${repo.full_name}${description} (${repo.stargazers_count}★) ${repo.html_url}`;
          });
        }
      }
    }

    // Strategy 3: Fall back to name search but with tighter matching
    // Use exact brand name in org/user field to avoid unrelated matches
    const exactQuery = encodeURIComponent(`${brandName.trim()} in:name`);
    const fallbackRes = await fetch(`https://api.github.com/search/repositories?q=${exactQuery}&sort=stars&order=desc&per_page=5`);
    if (!fallbackRes.ok) return [];

    const data = (await fallbackRes.json()) as { items?: GithubRepoItem[] };
    const items = data.items || [];
    if (items.length === 0) return [];

    // Filter: only include repos where the owner name EXACTLY matches the brand
    // Strategy 3 is a fallback — must be strict to avoid false positives
    // (e.g., "defiads" should NOT match "defia")
    const brandLower = brandName.trim().toLowerCase();
    const filtered = items.filter((repo) => {
      const owner = repo.full_name.split('/')[0].toLowerCase();
      return owner === brandLower;
    });

    // If no owner matches, return nothing rather than wrong repos
    if (filtered.length === 0) return [];

    return filtered.slice(0, 3).map((repo) => {
      const description = repo.description ? ` — ${repo.description}` : '';
      return `GitHub: ${repo.full_name}${description} (${repo.stargazers_count}★) ${repo.html_url}`;
    });
  } catch (error) {
    console.warn('GitHub brand research failed', error);
    return [];
  }
};
