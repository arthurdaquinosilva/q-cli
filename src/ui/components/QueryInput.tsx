import { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useVimInput, type VimMode } from '../hooks/useVimInput.js';
import { BUILTIN_COMMAND_LIST, getCompletions } from '../../commands/router.js';
import { getSqlCompletions, getCurrentToken, applyCompletion, fuzzyMatchPositions, type Schema } from '../completions.js';
import { tokenizeSql, type TokenType } from '../sqlHighlight.js';
import { theme } from '../theme.js';

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
const KW_COLOR = '#a5b4fc';
const STR_COLOR = '#fb923c';
const NUM_COLOR = '#86efac';
const CMT_COLOR = '#6b7280';

function sqlTokenColor(type: TokenType): string | undefined {
  if (type === 'keyword') return KW_COLOR;
  if (type === 'string') return STR_COLOR;
  if (type === 'number') return NUM_COLOR;
  if (type === 'comment') return CMT_COLOR;
  return undefined;
}

function SqlLine({ text }: { text: string }) {
  const tokens = tokenizeSql(text);
  return (
    <>
      {tokens.map((tok, i) => (
        <Text key={i} color={sqlTokenColor(tok.type)}>{tok.text}</Text>
      ))}
    </>
  );
}

function SqlHighlightedInput({ text, cursorAt, mode }: { text: string; cursorAt: number; mode: VimMode }) {
  const tokens = tokenizeSql(text);
  const parts: React.ReactElement[] = [];
  let pos = 0;
  let cursorDone = false;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const tokEnd = pos + tok.text.length;
    const color = sqlTokenColor(tok.type);

    if (!cursorDone && cursorAt >= pos && cursorAt < tokEnd) {
      const rel = cursorAt - pos;
      const before = tok.text.slice(0, rel);
      const ch = tok.text[rel];
      const after = tok.text.slice(rel + 1);
      if (before) parts.push(<Text key={`${i}b`} backgroundColor={BG} color={color}>{before}</Text>);
      if (mode === 'INSERT') {
        parts.push(<Text key={`${i}c`} backgroundColor={BG} color={ACCENT} bold>{'▌'}</Text>);
        if (ch) parts.push(<Text key={`${i}ca`} backgroundColor={BG} color={color}>{ch}</Text>);
      } else {
        parts.push(<Text key={`${i}c`} backgroundColor={ACCENT} color={BG} bold>{ch || ' '}</Text>);
      }
      if (after) parts.push(<Text key={`${i}a`} backgroundColor={BG} color={color}>{after}</Text>);
      cursorDone = true;
    } else {
      parts.push(<Text key={i} backgroundColor={BG} color={color}>{tok.text}</Text>);
    }

    pos = tokEnd;
  }

  if (!cursorDone) {
    if (mode === 'INSERT') {
      parts.push(<Text key="c" backgroundColor={BG} color={ACCENT} bold>{'▌'}</Text>);
    } else {
      parts.push(<Text key="c" backgroundColor={ACCENT} color={BG} bold>{' '}</Text>);
    }
  }

  return <>{parts}</>;
}

const HINTS = {
  INSERT: [
    ['Esc', 'NORMAL MODE'],
    ['Enter', 'RUN QUERY'],
    ['Ctrl+E', 'EDITOR'],
    ['!cmd', 'SHELL'],
    ['Ctrl+C', 'EXIT'],
  ],
  NORMAL: [
    ['i/a/A', 'INSERT'],
    ['h/l', 'MOVE'],
    ['w/b', 'WORD'],
    ['0/$', 'LINE ENDS'],
    ['dd/cc/S', 'CLEAR'],
    ['x/s/dw/cw', 'DELETE'],
    ['D/C', 'TO END'],
    ['e', 'EDITOR'],
  ],
  PLAIN: [
    ['Enter', 'RUN QUERY'],
    ['!cmd', 'SHELL'],
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
  onShellModeChange?: (isShell: boolean) => void;
  vimEnabled?: boolean;
  history?: string[];
  aliases?: Record<string, string>;
  schema?: Schema;
}

export function QueryInput({ onSubmit, isLoading, onModeChange, onShellModeChange, vimEnabled = true, history = [], aliases = {}, schema }: QueryInputProps) {
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

  const isShellMode = value.startsWith('!');
  const isCommand = !isShellMode && value.startsWith('/');
  const partial = isCommand ? value.slice(1) : '';
  const suggestions = isCommand
    ? getCompletions(partial, aliases)
    : (!isShellMode && schema ? getSqlCompletions(value, cursorPos, schema) : []);
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

  useEffect(() => {
    onShellModeChange?.(isShellMode);
  }, [isShellMode, onShellModeChange]);

  const termWidth = process.stdout.columns ?? 80;
  const innerWidth = termWidth - 2; // App paddingX={1} consumes 1 char each side
  const emptyLine = ' '.repeat(innerWidth);

  const isEmpty = value === '';
  const isMultiLine = !isEmpty && !isShellMode && !isCommand && value.includes('\n');
  // In shell mode, hide the '! ' prefix from the display (2 chars)
  const dOff = isShellMode ? 2 : 0;
  const before = value.slice(dOff, cursorPos);
  const atCursor = cursorPos < dOff ? ' ' : (value[cursorPos] ?? ' ');
  const after = value.slice(Math.max(cursorPos + 1, dOff));

  const placeholder = 'Type a SQL query…';


  const SEP = '  |  ';
  const allHints = vimEnabled ? HINTS[mode] : HINTS.PLAIN;
  const totalHintsWidth = allHints.reduce(
    (w, [key, desc], i) => w + (i > 0 ? SEP.length : 0) + desc.length + 2 + key.length,
    0,
  );
  const hintsInline = totalHintsWidth <= termWidth;

  return (
    <Box flexDirection="column">
      {isMultiLine ? (
        <Box flexDirection="column">
          <Box flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={1}>
            {value.split('\n').map((line, i, arr) => {
              const numW = String(arr.length).length;
              const isLast = i === arr.length - 1;
              return (
                <Box key={i}>
                  <Text dimColor>{String(i + 1).padStart(numW)}{' │ '}</Text>
                  <SqlLine text={line} />
                  {isLast && (mode === 'INSERT'
                    ? <Text color={ACCENT} bold>{'▌'}</Text>
                    : <Text backgroundColor={ACCENT} color={BG} bold>{' '}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter: run  ·  Ctrl+E / e: re-edit</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Text backgroundColor={BG}>{emptyLine}</Text>

          {/* Input line — Box width+backgroundColor fills the whole row including
              wrapped lines, so we never need manual padding spaces. */}
          <Box width={innerWidth} backgroundColor={BG}>
            <Text color={isShellMode ? theme.shellMode : ACCENT} bold>{isShellMode ? '  $ ' : '  > '}</Text>
            {isEmpty ? (
              <>
                <Text color={PLACEHOLDER}>{placeholder}</Text>
                <Text color={ACCENT} bold>{'▌'}</Text>
              </>
            ) : isShellMode || isCommand ? (
              <>
                <Text>{before}</Text>
                {mode === 'INSERT' ? (
                  <Text color={ACCENT} bold>{'▌'}</Text>
                ) : (
                  <Text backgroundColor={ACCENT} color={BG} bold>{atCursor}</Text>
                )}
                <Text>{after}</Text>
              </>
            ) : (
              <SqlHighlightedInput text={value} cursorAt={cursorPos} mode={mode} />
            )}
          </Box>

          <Text backgroundColor={BG}>{emptyLine}</Text>
        </>
      )}

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
