import { useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type { ConnectionState } from '../../db/client.js';
import { runQuery, type QueryState } from '../../db/query.js';
import { QueryInput } from './QueryInput.js';
import { QueryResult } from './QueryResult.js';

interface AppProps {
  connectionState: ConnectionState;
}

export function App({ connectionState }: AppProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [queryState, setQueryState] = useState<QueryState>({ status: 'idle' });

  useInput(
    (input, key) => {
      if (input === 'q' && key.ctrl) exit();
    },
    { isActive: isRawModeSupported },
  );

  async function handleSubmit(sql: string) {
    if (connectionState.status !== 'connected') return;
    setQueryState({ status: 'running' });
    const result = await runQuery(connectionState.client, sql);
    setQueryState(result);
  }

  const isLoading = queryState.status === 'running';

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">sql-cli</Text>
      <Box marginTop={1}>
        {connectionState.status === 'connected' ? (
          <Text color="green">
            {'✓ '}{connectionState.database}{'@'}{connectionState.host}
          </Text>
        ) : (
          <Text color="red">✗ {connectionState.message}</Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <QueryResult state={queryState} />
        <Box marginTop={1}>
          {connectionState.status === 'connected' ? (
            <QueryInput onSubmit={handleSubmit} isLoading={isLoading} />
          ) : (
            <Text dimColor>Not connected. Press Ctrl+C to exit.</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
