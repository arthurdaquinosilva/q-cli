import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { QueryState } from '../../db/query.js';
import { Table, cellValue, colWidths } from './Table.js';
import { theme } from '../theme.js';

const MAX_ROWS = 500;

interface QueryResultProps {
  state: QueryState;
  elapsed: number | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function useTerminalWidth() {
  const [width, setWidth] = useState(process.stdout.columns ?? 80);
  useEffect(() => {
    const handler = () => setWidth(process.stdout.columns ?? 80);
    process.stdout.on('resize', handler);
    return () => { process.stdout.off('resize', handler); };
  }, []);
  return width;
}

export function QueryResult({ state, elapsed }: QueryResultProps) {
  const termWidth = useTerminalWidth();

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

  const totalRows = result.rows.length;
  const truncated = totalRows > MAX_ROWS;
  const displayRows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;

  const widths = colWidths(columns, displayRows);
  const tableWidth = 1 + widths.reduce((sum, w) => sum + w + 3, 0);
  const expanded = tableWidth > termWidth;

  return (
    <Box flexDirection="column">
      <Table columns={columns} rows={displayRows} expanded={expanded} />
      <Box marginTop={1} flexDirection="column">
        {truncated && (
          <Text color={theme.warning}>⚠ Showing {MAX_ROWS} of {totalRows} rows</Text>
        )}
        <Text color={theme.accent}>
          {truncated ? MAX_ROWS : totalRows} row{totalRows !== 1 ? 's' : ''}{timing}
          {expanded ? '  [expanded]' : ''}
        </Text>
      </Box>
    </Box>
  );
}
