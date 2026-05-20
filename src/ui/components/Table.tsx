import { Box, Text } from 'ink';

const COL_PAD = 1;
const INDIGO = '#818cf8';
const BORDER = 'white';

function cellValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function colWidths(columns: string[], rows: Record<string, unknown>[]): number[] {
  return columns.map((col) => {
    const dataMax = rows.reduce(
      (max, row) => Math.max(max, cellValue(row[col]).length),
      0,
    );
    return Math.max(col.length, dataMax);
  });
}

function pad(str: string, width: number): string {
  return str.slice(0, width).padEnd(width);
}

function hline(
  widths: number[],
  left: string,
  mid: string,
  right: string,
): string {
  const segments = widths.map((w) => '─'.repeat(w + COL_PAD * 2));
  return left + segments.join(mid) + right;
}

interface TableProps {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function Table({ columns, rows }: TableProps) {
  const widths = colWidths(columns, rows);

  const topLine = hline(widths, '╭', '┬', '╮');
  const midLine = hline(widths, '├', '┼', '┤');
  const botLine = hline(widths, '╰', '┴', '╯');

  function renderRow(values: string[], textColor?: string, bold?: boolean) {
    return (
      <Box>
        <Text color={BORDER}>│</Text>
        {values.map((v, i) => (
          <Box key={i}>
            <Text color={textColor} bold={bold}>
              {' '.repeat(COL_PAD) + pad(v, widths[i]) + ' '.repeat(COL_PAD)}
            </Text>
            <Text color={BORDER}>│</Text>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color={BORDER}>{topLine}</Text>
      {renderRow(columns, INDIGO, true)}
      <Text color={BORDER}>{midLine}</Text>
      {rows.map((row, i) => (
        <Box key={i} flexDirection="column">
          {renderRow(columns.map((col) => cellValue(row[col])))}
          {i < rows.length - 1 && <Text color={BORDER}>{midLine}</Text>}
        </Box>
      ))}
      <Text color={BORDER}>{botLine}</Text>
    </Box>
  );
}
