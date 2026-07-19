import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { EvalEvent } from '../src/app/core/model';
import type { FounderQuery } from '../src/app/core/connectors/types';
import { RunRecorder } from './_lib/agent-runs';
import { emitter, evaluationWorkflow } from './_lib/workflow';

export const config = { maxDuration: 60 };

// LOOP B: on-demand evaluation, now a durable Mastra workflow (see
// api/_lib/workflow.ts). Streams EvalEvent frames as SSE so the UI can render the
// "brain at work" trace: each connector and signal as it lands, a MetricScore per
// metric, then the deterministic FounderScore. Body is a FounderQuery.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
  const query: FounderQuery = {
    name: body.name || '',
    github: body.github,
    npm: body.npm,
    pypi: body.pypi,
    producthunt: body.producthunt,
    x: body.x,
    linkedin: body.linkedin,
    domain: body.domain,
    keywords: body.keywords,
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Recorded so the Agent Runs page shows this alongside the unattended runs.
  const recorder = new RunRecorder('founder-evaluation', query.name || 'founder', 'ui');
  let signals = 0;

  const send = (event: EvalEvent): void => {
    if (event.type === 'trace') recorder.addTrace(event.step);
    if (event.type === 'connector') recorder.addTool(event.connector);
    if (event.type === 'signal') signals++;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Run the workflow inside the emitter context so its steps can stream SSE frames.
  await emitter.run(send, async () => {
    try {
      const run = await evaluationWorkflow.createRun();
      const result = await run.start({
        inputData: { ...query, keywords: query.keywords ? [...query.keywords] : undefined },
      });
      if (result.status !== 'success') {
        const reason =
          result.status === 'failed' ? message(result.error) : `workflow ${result.status}`;
        send({ type: 'error', message: reason });
        await recorder.fail(reason);
      } else {
        const s = result.result;
        await recorder.finish(`${s.composite} ${s.band}, ${signals} signals`);
      }
      send({ type: 'done' });
    } catch (err) {
      send({ type: 'error', message: message(err) });
      await recorder.fail(message(err));
    } finally {
      res.end();
    }
  });
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
