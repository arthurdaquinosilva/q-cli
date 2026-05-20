import { Box, Text } from 'ink';
import type { QueryState } from '../../db/query.js';

interface QueryResultProps {
  state: QueryState;
}

export function QueryResult({ state }: QueryResultProps) {
  if (state.status === 'idle' || state.status === 'running') return null;

  if (state.status === 'error') {
    return (
      <Box marginTop={1}>
        <Text color="red">✗ {state.message}</Text>
      </Box>
    );
  }

  const { result } = state;

  if (result.rows.length === 0) {
    return (
      <Box marginTop={1}>
        <Text dimColor>No rows returned. ({result.rowCount ?? 0} affected)</Text>
      </Box>
    );
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <Text dimColor>{JSON.stringify(result.rows, null, 2)}</Text>
      <Text dimColor>
        {result.rows.length} row{result.rows.length !== 1 ? 's' : ''}
      </Text>
    </Box>
  );
}
