import { createClient } from "@hey-api/client-fetch";
import { ServerAdapter, installAuthInterceptor } from './serve.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('serve auth', () => {
  let tools: any[];
  let seen: { caller: string; authorization: string | null; apiKey: string | null }[];
  let client: ReturnType<typeof createClient>;
  let adapter: ServerAdapter<any>;

  beforeEach(() => {
    tools = [];
    seen = [];
    client = createClient({
      baseUrl: 'http://sentio.test',
      fetch: async (request: Request) => {
        seen.push({
          caller: new URL(request.url).searchParams.get('caller')!,
          authorization: request.headers.get('Authorization'),
          apiKey: request.headers.get('api-key'),
        });
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      },
    });
    installAuthInterceptor(client, { apiKey: 'server-key' });
    adapter = new ServerAdapter({ addTool: (tool: any) => tools.push(tool) } as any);
  });

  it('does not leak credentials between concurrent sessions', async () => {
    const releaseA = deferred();
    adapter.tool('probe', 'probe', {}, async ({ caller }: { caller: string }) => {
      // A is held until B has fully run, so B's call is in between A's start and A's request.
      if (caller === 'A') await releaseA.promise;
      await client.get({ url: '/probe', query: { caller } });
      return { content: [] };
    });
    const [probe] = tools;

    const callA = probe.execute({ caller: 'A' }, { session: { token: 'Bearer token-a' } });
    await probe.execute({ caller: 'B' }, { session: { apiKey: 'key-b' } });
    releaseA.resolve();
    await callA;

    expect(seen).toEqual([
      { caller: 'B', authorization: null, apiKey: 'key-b' },
      { caller: 'A', authorization: 'Bearer token-a', apiKey: null },
    ]);
  });

  it('falls back to server credentials outside a session', async () => {
    await client.get({ url: '/probe', query: { caller: 'none' } });

    expect(seen).toEqual([{ caller: 'none', authorization: null, apiKey: 'server-key' }]);
  });

  it('does not register interceptors per tool call', async () => {
    adapter.tool('noop', 'noop', {}, async () => ({ content: [] }));
    const before = client.interceptors.request._fns.length;

    for (let i = 0; i < 5; i++) {
      await tools[0].execute({}, { session: { apiKey: `key-${i}` } });
    }

    expect(client.interceptors.request._fns.length).toBe(before);
  });
});
