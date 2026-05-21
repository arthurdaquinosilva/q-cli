const EXPLAIN_PROMPT = (query: string) =>
  `You are a SQL expert. Explain this query in plain English. Be concise — 2-4 sentences max. Do not repeat the SQL back.\n\nSQL: ${query}`;

interface SSEChunk {
  choices: Array<{ delta: { content?: string }; finish_reason?: string | null }>;
}

export async function* streamExplain(
  query: string,
  baseUrl: string,
  model: string,
  apiKey?: string,
): AsyncGenerator<string> {
  let res: Response;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'user', content: EXPLAIN_PROMPT(query) }],
      }),
    });
  } catch {
    throw new Error('Could not reach Ollama — is it running? Try: ollama serve');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${body || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body from Ollama');

  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const chunk = JSON.parse(data) as SSEChunk;
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // malformed SSE line — skip
      }
    }
  }
}
