import type { VercelRequest, VercelResponse } from '@vercel/node';
import { THESES } from '../src/app/core/data/seed';
import { resolveFounders } from './_lib/founders';

export const config = { maxDuration: 10 };

// GET /api/radar -> the discovered founders feed (freshest first) + theses.
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const founders = resolveFounders().sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ founders, theses: THESES });
}
