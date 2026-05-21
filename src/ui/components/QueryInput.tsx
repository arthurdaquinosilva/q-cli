import { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useVimInput, type VimMode } from '../hooks/useVimInput.js';
import { BUILTIN_COMMAND_LIST, getCompletions } from '../../commands/router.js';
import { getSqlCompletions, getCurrentToken, applyCompletion, fuzzyMatchPositions, type Schema } from '../completions.js';

function FuzzyHighlight({ text, token, selected }: { text: string; token: string; selected: boolean }) {
  if (!token) return <Text dimColor={!selected}>{text}</Text>;
  const matched = new Set(fuzzyMatchPositions(token.toLowerCase(), text.toLowerCase()));
  type Seg = { chars: string; hit: boolean };
  const segs: Seg[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = matched.has(i);
    const last = segs[segs.length - 1];
    if (last && last.hit === hit) last.chars += text[i];
    else segs.push({ chars: text[i], hit });
  }
  return (
    <>
      {segs.map((seg, i) =>
        seg.hit
          ? <Text key={i} color={ACCENT} bold>{seg.chars}</Text>
          : <Text key={i} dimColor={!selected}>{seg.chars}</Text>
      )}
    </>
  );
}

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
  schema?: Schema;
}

export function QueryInput({ onSubmit, isLoading, onModeChange, vimEnabled = true, history = [], aliases = {}, schema }: QueryInputProps) {
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

  function handleSuggestionAccept(v: string, cur: number, suggestion: string) {
    if (v.startsWith('/')) {
      const val = `/${suggestion}`;
      return { value: val, cursor: val.length };
    }
    return applyCompletion(v, cur, suggestion);
  }

  const { value, cursor: cursorPos, mode, suggestionIndex } = useVimInput(
    onSubmit, !isLoading, vimEnabled, handleTab, history,
    (v, cur) => v.startsWith('/') ? getCompletions(v.slice(1), aliases) : (schema ? getSqlCompletions(v, cur, schema) : []),
    handleSuggestionAccept,
  );

  const isCommand = value.startsWith('/');
  const partial = isCommand ? value.slice(1) : '';
  const suggestions = isCommand
    ? getCompletions(partial, aliases)
    : (schema ? getSqlCompletions(value, cursorPos, schema) : []);
  const sqlToken = isCommand ? '' : getCurrentToken(value, cursorPos);

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
  const before = value.slice(0, cursorPos);
  const atCursor = value[cursorPos] ?? ' ';
  const after = value.slice(cursorPos + 1);

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
            if (isCommand) {
              return (
                <Box key={name}>
                  <Text>
                    <Text dimColor={!selected} color={selected ? ACCENT : undefined}>/</Text>
                    <FuzzyHighlight text={name} token={partial} selected={selected} />
                  </Text>
                  <Text dimColor>{'  —  '}{descMap[name]}</Text>
                </Box>
              );
            }
            return (
              <Box key={name}>
                <FuzzyHighlight text={name} token={sqlToken} selected={selected} />
              </Box>
            );
          })}
          <Text dimColor>Tab/↑↓ navigate  Enter select</Text>
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
