import { useState } from 'react';
import { useInput, useStdin } from 'ink';

export type VimMode = 'INSERT' | 'NORMAL';

interface State {
  value: string;
  cursor: number;
  mode: VimMode;
  pending: string;
}

function wordForward(str: string, pos: number): number {
  let i = pos;
  while (i < str.length && !/\s/.test(str[i])) i++;
  while (i < str.length && /\s/.test(str[i])) i++;
  return i;
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

export function useVimInput(
  onSubmit: (value: string) => void,
  isActive: boolean,
) {
  const { isRawModeSupported } = useStdin();
  const [state, setState] = useState<State>({
    value: '',
    cursor: 0,
    mode: 'INSERT',
    pending: '',
  });

  useInput(
    (input, key) => {
      setState((s) => {
        // ── INSERT mode ──────────────────────────────────────────────
        if (s.mode === 'INSERT') {
          if (key.escape) {
            return { ...s, mode: 'NORMAL', cursor: Math.max(0, s.cursor - 1), pending: '' };
          }
          if (key.return) {
            const trimmed = s.value.trim();
            if (trimmed) onSubmit(trimmed);
            return { value: '', cursor: 0, mode: 'INSERT', pending: '' };
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
          return { value: '', cursor: 0, mode: 'INSERT', pending: '' };
        }

        // Pending operator handling (d + motion)
        if (s.pending === 'd') {
          if (input === 'd') {
            return { ...s, value: '', cursor: 0, pending: '' };
          }
          if (input === 'w') {
            return { ...s, value: deleteWordForward(s.value, s.cursor), pending: '' };
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
          case '0': return { ...s, cursor: 0 };
          case '$': return { ...s, cursor: maxCursor };
          case 'x': {
            if (s.cursor >= s.value.length) return s;
            const val = s.value.slice(0, s.cursor) + s.value.slice(s.cursor + 1);
            return { ...s, value: val, cursor: Math.min(s.cursor, Math.max(0, val.length - 1)) };
          }
          case 'd': return { ...s, pending: 'd' };
          default: return s;
        }
      });
    },
    { isActive: isActive && (isRawModeSupported ?? false) },
  );

  return { value: state.value, cursor: state.cursor, mode: state.mode };
}
