interface GithubRepoItem {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
}

const getGithubSearchUrl = (brandName: string) => {
  const query = encodeURIComponent(`${brandName} in:name,description`);
  return `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=3`;
};

export const researchGithubBrandSignals = async (brandName: string): Promise<string[]> => {
  if (!brandName.trim()) return [];

  try {
    const response = await fetch(getGithubSearchUrl(brandName));
    if (!response.ok) return [];

    const data = (await response.json()) as { items?: GithubRepoItem[] };
    const items = data.items || [];
    if (items.length === 0) return [];

    return items.map((repo) => {
      const description = repo.description ? ` — ${repo.description}` : '';
      return `GitHub: ${repo.full_name}${description} (${repo.stargazers_count}★) ${repo.html_url}`;
    });
  } catch (error) {
    console.warn('GitHub brand research failed', error);
    return [];
  }
};
