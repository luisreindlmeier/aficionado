import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SEED_VENTURES } from '../src/app/core/data/seed';
import { resolveFounder } from './_lib/founders';

export const config = { maxDuration: 10 };

// GET /api/founder?id=<id> -> one founder + its venture.
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) {
    res.status(400).json({ error: 'id query param required' });
    return;
  }
  const founder = resolveFounder(id);
  if (!founder) {
    res.status(404).json({ error: `No founder ${id}` });
    return;
  }
  const venture = SEED_VENTURES.find((v) => v.id === founder.ventureId) ?? null;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ founder, venture });
}
