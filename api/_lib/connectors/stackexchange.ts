import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

interface SeUser {
  display_name: string;
  reputation?: number;
  user_id: number;
  answer_count?: number;
  link?: string;
}

// Proof: demonstrated expertise via Stack Overflow reputation
// (api.stackexchange.com, no key; STACK_EXCHANGE_KEY raises the quota).
export async function runStackExchange(query: FounderQuery): Promise<ConnectorResult> {
  const name = query.name?.trim();
  if (!name) return { signals: [], note: 'No name provided' };

  const key = process.env.STACK_EXCHANGE_KEY ? `&key=${process.env.STACK_EXCHANGE_KEY}` : '';
  const res = await fetch(
    `https://api.stackexchange.com/2.3/users?inname=${encodeURIComponent(name)}&site=stackoverflow&order=desc&sort=reputation&pagesize=1${key}`,
    { headers: { 'User-Agent': 'aficionado-connector' } },
  );
  if (!res.ok) throw new Error(`Stack Exchange request failed (${res.status})`);
  const data = (await res.json()) as { items?: SeUser[] };
  const user = data.items?.[0];
  if (!user || !user.reputation) return { signals: [], note: `No Stack Overflow user for ${name}` };

  const url = user.link ?? `https://stackoverflow.com/users/${user.user_id}`;
  const signals: Signal[] = [
    {
      connector: 'stackexchange',
      metric: 'Proof',
      text: `${user.reputation.toLocaleString('en-US')} Stack Overflow reputation`,
      value: user.reputation,
      url,
    },
  ];
  if (user.answer_count) {
    signals.push({
      connector: 'stackexchange',
      metric: 'Proof',
      text: `${user.answer_count.toLocaleString('en-US')} accepted-quality answers`,
      value: user.answer_count,
      url,
    });
  }
  return { signals };
}
