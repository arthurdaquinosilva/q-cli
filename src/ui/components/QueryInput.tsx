import { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useVimInput, type VimMode } from '../hooks/useVimInput.js';

const BG = '#1e1b4b';
const ACCENT = '#818cf8';
const PLACEHOLDER = '#6366f1';

const HINTS = {
  INSERT: [
    ['Esc', 'normal mode'],
    ['Enter', 'run query'],
    ['Ctrl+C', 'exit'],
    ['Ctrl+Z', 'background'],
  ],
  NORMAL: [
    ['i / a / A', 'insert'],
    ['h / l', 'move'],
    ['w / b', 'word'],
    ['0 / $', 'line ends'],
    ['dd', 'clear line'],
    ['x / dw', 'delete'],
  ],
} as const;

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  onModeChange?: (mode: VimMode) => void;
}

export function QueryInput({ onSubmit, isLoading, onModeChange }: QueryInputProps) {
  const { value, cursor, mode } = useVimInput(onSubmit, !isLoading);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const termWidth = process.stdout.columns ?? 80;
  const innerWidth = termWidth - 4;
  const emptyLine = ' '.repeat(innerWidth);

  const isEmpty = value === '';
  const before = value.slice(0, cursor);
  const atCursor = value[cursor] ?? ' ';
  const after = value.slice(cursor + 1);

  const placeholder = 'Type a SQL query…';
  const contentLen = isEmpty
    ? 4 + placeholder.length
    : 4 + before.length + 1 + after.length;
  const pad = ' '.repeat(Math.max(0, innerWidth - contentLen));

  const hints = HINTS[mode]
    .map(([key, desc]) => `${key}  ${desc}`)
    .join('    ');

  return (
    <Box flexDirection="column">
      <Text backgroundColor={BG}>{emptyLine}</Text>
      <Text backgroundColor={BG}>{emptyLine}</Text>

      {/* Input line */}
      <Box>
        <Text backgroundColor={BG} color={ACCENT} bold>{'  > '}</Text>
        {isEmpty ? (
          <>
            <Text backgroundColor={BG} color={PLACEHOLDER}>{placeholder}</Text>
            <Text backgroundColor={BG} color={ACCENT} bold>{'▌'}</Text>
            <Text backgroundColor={BG}>{pad}</Text>
          </>
        ) : (
          <>
            <Text backgroundColor={BG}>{before}</Text>
            {mode === 'INSERT' ? (
              <Text backgroundColor={BG} color={ACCENT} bold>{'▌'}</Text>
            ) : (
              <Text backgroundColor={ACCENT} color={BG} bold>{atCursor}</Text>
            )}
            <Text backgroundColor={BG}>{after}{pad}</Text>
          </>
        )}
      </Box>

      <Text backgroundColor={BG}>{emptyLine}</Text>
      <Text backgroundColor={BG}>{emptyLine}</Text>

      {/* Hints line */}
      <Box marginTop={1}>
        <Text dimColor>{hints}</Text>
      </Box>
    </Box>
  );
}
