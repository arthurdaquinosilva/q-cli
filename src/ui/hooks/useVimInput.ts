import { useState } from 'react';
import { useInput, useStdin } from 'ink';

export type VimMode = 'INSERT' | 'NORMAL';

interface State {
  value: string;
  cursor: number;
  mode: VimMode;
  pending: string;
  yank: string;
}

function wordForward(str: string, pos: number): number {
  let i = pos;
  while (i < str.length && !/\s/.test(str[i])) i++;
  while (i < str.length && /\s/.test(str[i])) i++;
  return i;
}

function wordEnd(str: string, pos: number): number {
  let i = pos + 1;
  while (i < str.length && /\s/.test(str[i])) i++;
  while (i < str.length - 1 && !/\s/.test(str[i + 1])) i++;
  return Math.min(i, Math.max(0, str.length - 1));
}

function wordBackward(str: string, pos: number): number {
  let i = pos;
  while (i > 0 && /\s/.test(str[i - 1])) i--;
  while (i > 0 && !/\s/.test(str[i - 1])) i--;
  return i;
}

function deleteWordForward(str: string, pos: number): string {
  const end = wordForward(str, pos);
  return str.slice(0, pos) + str.slice(end);
}

function deleteWordBackward(str: string, pos: number): { value: string; cursor: number } {
  const start = wordBackward(str, pos);
  return { value: str.slice(0, start) + str.slice(pos), cursor: start };
}

export function useVimInput(
  onSubmit: (value: string) => void,
  isActive: boolean,
  vimEnabled: boolean = true,
  onTab?: (value: string) => string | null,
) {
  const { isRawModeSupported } = useStdin();
  const [state, setState] = useState<State>({
    value: '',
    cursor: 0,
    mode: 'INSERT',
    pending: '',
    yank: '',
  });

  useInput(
    (input, key) => {
      setState((s) => {
        // ── INSERT mode ──────────────────────────────────────────────
        if (s.mode === 'INSERT') {
          if (key.escape) {
            if (!vimEnabled) return s;
            return { ...s, mode: 'NORMAL', cursor: Math.max(0, s.cursor - 1), pending: '' };
          }
          if (key.return) {
            const trimmed = s.value.trim();
            if (trimmed) onSubmit(trimmed);
            return { value: '', cursor: 0, mode: 'INSERT', pending: '', yank: s.yank };
          }
          if (key.backspace || key.delete) {
            if (s.cursor === 0) return s;
            return {
              ...s,
              value: s.value.slice(0, s.cursor - 1) + s.value.slice(s.cursor),
              cursor: s.cursor - 1,
            };
          }
          if (key.leftArrow) return { ...s, cursor: Math.max(0, s.cursor - 1) };
          if (key.rightArrow) return { ...s, cursor: Math.min(s.value.length, s.cursor + 1) };
          if (key.tab) {
            const completed = onTab?.(s.value);
            if (completed != null) return { ...s, value: completed, cursor: completed.length };
            return s;
          }
          if (!key.ctrl && !key.meta && input) {
            return {
              ...s,
              value: s.value.slice(0, s.cursor) + input + s.value.slice(s.cursor),
              cursor: s.cursor + input.length,
            };
          }
          return s;
        }

        // ── NORMAL mode ──────────────────────────────────────────────
        if (key.return) {
          const trimmed = s.value.trim();
          if (trimmed) onSubmit(trimmed);
          return { value: '', cursor: 0, mode: 'INSERT', pending: '', yank: s.yank };
        }

        // Pending operator: d
        if (s.pending === 'd') {
          if (input === 'd') {
            return { ...s, value: '', cursor: 0, pending: '' };
          }
          if (input === 'w') {
            const val = deleteWordForward(s.value, s.cursor);
            return { ...s, value: val, cursor: Math.min(s.cursor, Math.max(0, val.length - 1)), pending: '' };
          }
          if (input === 'b') {
            const { value, cursor } = deleteWordBackward(s.value, s.cursor);
            return { ...s, value, cursor: Math.min(cursor, Math.max(0, value.length - 1)), pending: '' };
          }
          return { ...s, pending: '' };
        }

        // Pending operator: c (change = delete + INSERT)
        if (s.pending === 'c') {
          if (input === 'c') {
            return { ...s, value: '', cursor: 0, mode: 'INSERT', pending: '' };
          }
          if (input === 'w') {
            const val = deleteWordForward(s.value, s.cursor);
            return { ...s, value: val, cursor: s.cursor, mode: 'INSERT', pending: '' };
          }
          if (input === 'b') {
            const { value, cursor } = deleteWordBackward(s.value, s.cursor);
            return { ...s, value, cursor, mode: 'INSERT', pending: '' };
          }
          return { ...s, pending: '' };
        }

        // Pending operator: y (yank)
        if (s.pending === 'y') {
          if (input === 'y') {
            return { ...s, yank: s.value, pending: '' };
          }
          return { ...s, pending: '' };
        }

        const maxCursor = Math.max(0, s.value.length - 1);

        switch (input) {
          case 'i': return { ...s, mode: 'INSERT', pending: '' };
          case 'a': return { ...s, mode: 'INSERT', cursor: Math.min(s.value.length, s.cursor + 1), pending: '' };
          case 'A': return { ...s, mode: 'INSERT', cursor: s.value.length, pending: '' };
          case 'I': return { ...s, mode: 'INSERT', cursor: 0, pending: '' };
          case 'h': return { ...s, cursor: Math.max(0, s.cursor - 1) };
          case 'l': return { ...s, cursor: Math.min(maxCursor, s.cursor + 1) };
          case 'w': return { ...s, cursor: Math.min(maxCursor, wordForward(s.value, s.cursor)) };
          case 'b': return { ...s, cursor: wordBackward(s.value, s.cursor) };
          case 'e': return { ...s, cursor: wordEnd(s.value, s.cursor) };
          case '0': return { ...s, cursor: 0 };
          case '$': return { ...s, cursor: maxCursor };
          case 'x': {
            if (s.cursor >= s.value.length) return s;
            const val = s.value.slice(0, s.cursor) + s.value.slice(s.cursor + 1);
            return { ...s, value: val, cursor: Math.min(s.cursor, Math.max(0, val.length - 1)) };
          }
          case 's': {
            // substitute char: delete under cursor + INSERT
            if (s.cursor >= s.value.length) return { ...s, mode: 'INSERT' };
            const val = s.value.slice(0, s.cursor) + s.value.slice(s.cursor + 1);
            return { ...s, value: val, cursor: s.cursor, mode: 'INSERT' };
          }
          case 'S': {
            // substitute line: clear + INSERT
            return { ...s, value: '', cursor: 0, mode: 'INSERT' };
          }
          case 'C': {
            // change to end of line
            const val = s.value.slice(0, s.cursor);
            return { ...s, value: val, cursor: Math.min(s.cursor, Math.max(0, val.length - 1)), mode: 'INSERT' };
          }
          case 'D': {
            // delete to end of line
            const val = s.value.slice(0, s.cursor);
            return { ...s, value: val, cursor: Math.min(s.cursor, Math.max(0, val.length - 1)) };
          }
          case 'p': {
            // paste yanked text after cursor
            if (!s.yank) return s;
            const insertAt = Math.min(s.cursor + 1, s.value.length);
            const val = s.value.slice(0, insertAt) + s.yank + s.value.slice(insertAt);
            return { ...s, value: val, cursor: Math.max(0, insertAt + s.yank.length - 1) };
          }
          case 'd': return { ...s, pending: 'd' };
          case 'c': return { ...s, pending: 'c' };
          case 'y': return { ...s, pending: 'y' };
          default: return s;
        }
      });
    },
    { isActive: isActive && (isRawModeSupported ?? false) },
  );

  return { value: state.value, cursor: state.cursor, mode: vimEnabled ? state.mode : 'INSERT' };
}
