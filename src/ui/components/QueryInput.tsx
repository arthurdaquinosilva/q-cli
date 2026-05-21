import { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useVimInput, type VimMode } from '../hooks/useVimInput.js';
import { BUILTIN_COMMAND_LIST, getCompletions } from '../../commands/router.js';

const BG = '#1e1b4b';
const ACCENT = '#818cf8';
const PLACEHOLDER = '#6366f1';

const HINTS = {
  INSERT: [
    ['Esc', 'NORMAL MODE'],
    ['Enter', 'RUN QUERY'],
    ['Ctrl+C', 'EXIT'],
    ['Ctrl+Z', 'BACKGROUND'],
  ],
  NORMAL: [
    ['i/a/A', 'INSERT'],
    ['h/l', 'MOVE'],
    ['w/b/e', 'WORD'],
    ['0/$', 'LINE ENDS'],
    ['dd/cc/S', 'CLEAR'],
    ['x/s/dw/cw', 'DELETE'],
    ['D/C', 'TO END'],
    ['yy/p', 'YANK/PASTE'],
  ],
  PLAIN: [
    ['Enter', 'RUN QUERY'],
    ['Ctrl+C', 'EXIT'],
    ['Ctrl+Z', 'BACKGROUND'],
    ['/toggle-vim-mode', 'ENABLE VIM'],
  ],
} as const;

const BUILTIN_DESC_MAP = Object.fromEntries(BUILTIN_COMMAND_LIST.map((c) => [c.name, c.description]));

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  onModeChange?: (mode: VimMode) => void;
  vimEnabled?: boolean;
  history?: string[];
  aliases?: Record<string, string>;
}

export function QueryInput({ onSubmit, isLoading, onModeChange, vimEnabled = true, history = [], aliases = {} }: QueryInputProps) {
  function handleTab(current: string): string | null {
    if (!current.startsWith('/')) return null;
    const partial = current.slice(1);
    const matches = getCompletions(partial, aliases);
    if (matches.length === 0) return null;
    if (matches.length === 1) return `/${matches[0]}`;
    let prefix = matches[0];
    for (const m of matches.slice(1)) {
      while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
      if (!prefix) return null;
    }
    return `/${prefix}`;
  }

  const { value, cursor, mode, suggestionIndex } = useVimInput(
    onSubmit, !isLoading, vimEnabled, handleTab, history,
    (v) => v.startsWith('/') ? getCompletions(v.slice(1), aliases) : [],
  );

  const isCommand = value.startsWith('/');
  const partial = isCommand ? value.slice(1) : '';
  const suggestions = isCommand ? getCompletions(partial, aliases) : [];

  const descMap: Record<string, string> = {
    ...BUILTIN_DESC_MAP,
    ...Object.fromEntries(
      Object.entries(aliases).map(([name, sql]) => [
        name,
        sql.length > 55 ? sql.slice(0, 55) + '…' : sql,
      ])
    ),
  };

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const termWidth = process.stdout.columns ?? 80;
  const innerWidth = termWidth - 2; // App paddingX={1} consumes 1 char each side
  const emptyLine = ' '.repeat(innerWidth);

  const isEmpty = value === '';
  const before = value.slice(0, cursor);
  const atCursor = value[cursor] ?? ' ';
  const after = value.slice(cursor + 1);

  const placeholder = 'Type a SQL query…';
  const contentLen = isEmpty
    ? 4 + placeholder.length + 1 // +1 for the ▌ cursor rendered in placeholder state
    : 4 + before.length + 1 + after.length;
  const pad = ' '.repeat(Math.max(0, innerWidth - contentLen));


  const SEP = '  |  ';
  const allHints = vimEnabled ? HINTS[mode] : HINTS.PLAIN;
  const totalHintsWidth = allHints.reduce(
    (w, [key, desc], i) => w + (i > 0 ? SEP.length : 0) + desc.length + 2 + key.length,
    0,
  );
  const hintsInline = totalHintsWidth <= termWidth;

  return (
    <Box flexDirection="column">
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

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          {suggestions.map((name, i) => {
            const selected = i === suggestionIndex;
            return (
              <Box key={name}>
                <Text>
                  <Text dimColor={!selected} color={selected ? ACCENT : undefined}>/</Text>
                  <Text color={ACCENT} bold>{partial}</Text>
                  <Text dimColor={!selected} color={selected ? ACCENT : undefined}>{name.slice(partial.length)}</Text>
                </Text>
                <Text dimColor>{'  —  '}{descMap[name]}</Text>
              </Box>
            );
          })}
          <Text dimColor>↑↓ navigate  Tab/Enter select</Text>
        </Box>
      )}

      {/* Hints line */}
      <Box marginTop={1} flexDirection={hintsInline ? 'row' : 'column'}>
        {allHints.map(([key, desc], i) => (
          <Text key={desc}>
            {hintsInline && i > 0 && <Text dimColor>{'  |  '}</Text>}
            <Text color={ACCENT} bold>{desc}</Text>
            <Text dimColor>{`: ${key}`}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}
