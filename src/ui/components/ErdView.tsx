import { Box, Text } from 'ink';
import type { ErdData, ErdTable } from '../../db/erd.js';

const TABLE_COLORS = [
  '#f472b6',
  '#34d399',
  '#fb923c',
  '#60a5fa',
  '#a78bfa',
  '#f87171',
  '#fbbf24',
  '#2dd4bf',
];

const PAD = 1;
const GAP = 2;
const FK_PREFIX = 'FK → ';

interface Metrics {
  nameW: number;
  typeW: number;
  keyW: number;
  totalW: number;
}

function computeMetrics(table: ErdTable): Metrics {
  const nameW = Math.max(2, ...table.columns.map((c) => c.name.length));
  const typeW = Math.max(4, ...table.columns.map((c) => c.type.length));
  const keyW = Math.max(
    2,
    ...table.columns.map((c) => {
      if (c.isPk) return 2;
      if (c.fkTable) return FK_PREFIX.length + c.fkTable.length;
      return 0;
    }),
  );
  const totalW = 4 + 3 * PAD * 2 + nameW + typeW + keyW;
  return { nameW, typeW, keyW, totalW };
}

function groupIntoRows(metrics: Metrics[], termW: number): number[][] {
  const rows: number[][] = [];
  let row: number[] = [];
  let usedW = 0;
  for (let i = 0; i < metrics.length; i++) {
    const w = metrics[i].totalW;
    if (row.length === 0) {
      row.push(i); usedW = w;
    } else if (usedW + GAP + w <= termW) {
      row.push(i); usedW += GAP + w;
    } else {
      rows.push(row); row = [i]; usedW = w;
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

interface TableBoxProps {
  table: ErdTable;
  m: Metrics;
  color: string;
  colorMap: Map<string, string>;
}

function TableBox({ table, m, color, colorMap }: TableBoxProps) {
  const { nameW, typeW, keyW, totalW } = m;
  const sp = ' '.repeat(PAD);
  const p = (s: string, w: number) => s.slice(0, w).padEnd(w);

  const top = '╭' + '─'.repeat(totalW - 2) + '╮';
  const sep = '├' + '─'.repeat(nameW + PAD * 2) + '┬' + '─'.repeat(typeW + PAD * 2) + '┬' + '─'.repeat(keyW + PAD * 2) + '┤';
  const bot = '╰' + '─'.repeat(nameW + PAD * 2) + '┴' + '─'.repeat(typeW + PAD * 2) + '┴' + '─'.repeat(keyW + PAD * 2) + '╯';
  const headerW = totalW - 4;

  return (
    <Box flexDirection="column">
      <Text color={color}>{top}</Text>
      <Box>
        <Text color={color}>{'│'}</Text>
        <Text color={color} bold>{sp}{p(table.name, headerW)}{sp}</Text>
        <Text color={color}>{'│'}</Text>
      </Box>
      <Text color={color}>{sep}</Text>
      {table.columns.map((col, i) => (
        <Box key={i}>
          <Text color={color}>{'│'}</Text>
          <Text>{sp}{p(col.name, nameW)}{sp}</Text>
          <Text color={color}>{'│'}</Text>
          <Text dimColor>{sp}{p(col.type, typeW)}{sp}</Text>
          <Text color={color}>{'│'}</Text>
          {col.isPk ? (
            <Text bold>{sp}{p('PK', keyW)}{sp}</Text>
          ) : col.fkTable ? (
            <>
              <Text dimColor>{sp}{FK_PREFIX}</Text>
              <Text color={colorMap.get(col.fkTable) ?? color}>{p(col.fkTable, keyW - FK_PREFIX.length)}{sp}</Text>
            </>
          ) : (
            <Text>{sp}{' '.repeat(keyW)}{sp}</Text>
          )}
          <Text color={color}>{'│'}</Text>
        </Box>
      ))}
      <Text color={color}>{bot}</Text>
    </Box>
  );
}

export function ErdView({ data }: { data: ErdData }) {
  if (data.tables.length === 0) {
    return <Text dimColor>No tables found in the current schema.</Text>;
  }

  const termW = process.stdout.columns ?? 80;
  const metrics = data.tables.map(computeMetrics);
  const colorMap = new Map(
    data.tables.map((t, i) => [t.name, TABLE_COLORS[i % TABLE_COLORS.length]]),
  );
  const rows = groupIntoRows(metrics, termW);

  return (
    <Box flexDirection="column" marginTop={1}>
      {rows.map((row, ri) => (
        <Box key={ri} flexDirection="row" marginBottom={ri < rows.length - 1 ? 1 : 0}>
          {row.map((ti, j) => (
            <Box key={ti} marginRight={j < row.length - 1 ? GAP : 0}>
              <TableBox
                table={data.tables[ti]}
                m={metrics[ti]}
                color={colorMap.get(data.tables[ti].name) ?? BORDER}
                colorMap={colorMap}
              />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
