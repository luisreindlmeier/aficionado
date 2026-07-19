import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

interface NpmSearchResult {
  objects?: { package?: { name?: string } }[];
}

// Proof: packages published and how much they get used (downloads last month).
export async function runNpm(query: FounderQuery): Promise<ConnectorResult> {
  const author = query.npm?.trim().replace(/^@/, '');
  if (!author) return { signals: [], note: 'No npm handle provided' };

  const searchRes = await fetch(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`author:${author}`)}&size=20`,
  );
  if (!searchRes.ok) throw new Error(`npm search failed (${searchRes.status})`);
  const data = (await searchRes.json()) as NpmSearchResult;
  const pkgs = (data.objects || [])
    .map((o) => o.package?.name)
    .filter((n): n is string => Boolean(n))
    .slice(0, 20);
  if (!pkgs.length) return { signals: [], note: `No npm packages for ${author}` };

  let total = 0;
  for (const pkg of pkgs.slice(0, 10)) {
    try {
      const dRes = await fetch(
        `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`,
      );
      if (dRes.ok) {
        const d = (await dRes.json()) as { downloads?: number };
        total += d.downloads || 0;
      }
    } catch {
      // ignore per-package download failures
    }
  }

  const signals: Signal[] = [
    {
      connector: 'npm',
      metric: 'Proof',
      text: `${pkgs.length} npm packages published`,
      value: pkgs.length,
      url: `https://www.npmjs.com/~${author}`,
    },
  ];
  if (total > 0) {
    signals.push({
      connector: 'npm',
      metric: 'Proof',
      text: `${total.toLocaleString('en-US')} downloads last month`,
      value: total,
      url: `https://www.npmjs.com/~${author}`,
    });
  }
  return { signals };
}
