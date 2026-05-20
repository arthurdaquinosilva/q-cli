const EXPLAIN_PROMPT = (query: string) =>
  `You are a SQL expert. Explain this query in plain English. Be concise — cover what it does, which tables/columns it touches, and any notable behaviour (JOINs, aggregations, subqueries, etc.). Skip obvious observations.

SQL: ${query}`;

interface SSEChunk {
  choices: Array<{ delta: { content?: string }; finish_reason?: string | null }>;
}

export async function* streamExplain(
  query: string,
  baseUrl: string,
  model: string,
): AsyncGenerator<string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: EXPLAIN_PROMPT(query) }],
        stream: true,
      }),
    });
  } catch {
    throw new Error(`Could not reach AI at ${baseUrl} — is Ollama running?`);
  }

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
  }
  if (!response.body) throw new Error('AI response has no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as SSEChunk;
        const content = parsed.choices[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // skip malformed SSE chunks
      }
    }
  }
}
