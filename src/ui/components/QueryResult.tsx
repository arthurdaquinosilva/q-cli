import { Box, Text } from 'ink';
import type { QueryState } from '../../db/query.js';
import { Table } from './Table.js';
import { theme } from '../theme.js';

interface QueryResultProps {
  state: QueryState;
  elapsed: number | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function QueryResult({ state, elapsed }: QueryResultProps) {
  if (state.status === 'idle' || state.status === 'running') return null;

  const timing = elapsed !== null ? ` · ${formatDuration(elapsed)}` : '';

  if (state.status === 'error') {
    return (
      <Box flexDirection="column">
        <Text color={theme.error}>✗ {state.message}</Text>
        {elapsed !== null && <Text color={theme.accent}>{formatDuration(elapsed)}</Text>}
      </Box>
    );
  }

  const { result } = state;
  const columns = result.fields.map((f) => f.name);

  if (result.rows.length === 0) {
    return (
      <Box>
        <Text color={theme.accent}>
          No rows returned ({result.rowCount ?? 0} affected){timing}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Table columns={columns} rows={result.rows} />
      <Box marginTop={1}>
        <Text color={theme.accent}>
          {result.rows.length} row{result.rows.length !== 1 ? 's' : ''}{timing}
        </Text>
      </Box>
    </Box>
  );
}
