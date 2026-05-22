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
  const isDefaultOllama = baseUrl === 'http://localhost:11434/v1';

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
    if (isDefaultOllama) {
      throw new Error(
        'No AI model configured.\n\n' +
        'Option A — run Ollama locally (free, offline):\n' +
        '  ollama serve\n' +
        '  ollama pull llama3.2\n\n' +
        'Option B — use Groq (free, fast):\n' +
        '  querky -c <dsn> --ai-url https://api.groq.com/openai/v1 \\\n' +
        '    --ai-model llama-3.1-8b-instant --api-key YOUR_GROQ_KEY'
      );
    }
    throw new Error(`Could not reach ${baseUrl} — check your --ai-url and connection.`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const provider = isDefaultOllama ? 'Ollama' : baseUrl;
    throw new Error(`${provider} error ${res.status}: ${body || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body from AI provider');

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
