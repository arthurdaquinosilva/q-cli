import { useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type { ConnectionState } from '../../db/client.js';
import { runQuery, type QueryState } from '../../db/query.js';
import { QueryInput } from './QueryInput.js';
import { QueryResult } from './QueryResult.js';
import { Banner } from './Banner.js';
import { theme } from '../theme.js';
import type { VimMode } from '../hooks/useVimInput.js';

interface AppProps {
  connectionState: ConnectionState;
}

export function App({ connectionState }: AppProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [queryState, setQueryState] = useState<QueryState>({ status: 'idle' });
  const [lastQuery, setLastQuery] = useState<string>('');
  const [vimMode, setVimMode] = useState<VimMode>('INSERT');
  const [elapsed, setElapsed] = useState<number | null>(null);

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') exit();
    },
    { isActive: isRawModeSupported },
  );

  async function handleSubmit(sql: string) {
    if (connectionState.status !== 'connected') return;
    setLastQuery(sql);
    setElapsed(null);
    setQueryState({ status: 'running' });
    const start = Date.now();
    const result = await runQuery(connectionState.client, sql);
    setElapsed(Date.now() - start);
    setQueryState(result);
  }

  const isLoading = queryState.status === 'running';
  const isConnected = connectionState.status === 'connected';

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner connectionState={connectionState} />

      {lastQuery !== '' && (
        <Box flexDirection="column" marginBottom={1}>
          <Box borderStyle="round" borderColor={theme.accent} paddingX={1}>
            <Text color={theme.accent} bold>Query  </Text>
            <Text dimColor>{lastQuery}</Text>
          </Box>
          <Box marginTop={1}>
            <QueryResult state={queryState} elapsed={elapsed} />
          </Box>
        </Box>
      )}

      {isConnected ? (
        <QueryInput onSubmit={handleSubmit} isLoading={isLoading} onModeChange={setVimMode} />
      ) : (
        <Text dimColor>Not connected. Press Ctrl+C to exit.</Text>
      )}

      <Box marginTop={1}>
        <Text bold color={vimMode === 'NORMAL' ? 'cyan' : theme.accent}>
          {isRawModeSupported ? `[${vimMode}]` : ''}
        </Text>
      </Box>
    </Box>
  );
}
