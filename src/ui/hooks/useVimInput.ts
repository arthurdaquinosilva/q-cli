import { useState, useEffect, useRef } from 'react';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useInput, useStdin } from 'ink';

export type VimMode = 'INSERT' | 'NORMAL';

interface State {
  value: string;
  cursor: number;
  mode: VimMode;
  pending: string;
  yank: string;
  historyIndex: number;  // -1 = not browsing history
  draft: string;         // saved input before history navigation started
  suggestionIndex: number; // -1 = none selected
  pendingSubmit: string | null; // set by Enter key, consumed by useEffect
  pendingEditor: string | null; // value to edit; set to trigger editor, consumed by useEffect
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
  history: string[] = [],
  getSuggestions?: (value: string, cursor: number) => string[],
  onSuggestionAccept?: (value: string, cursor: number, suggestion: string) => { value: string; cursor: number },
) {
  const { isRawModeSupported } = useStdin();
  const [state, setState] = useState<State>({
    value: '',
    cursor: 0,
    mode: 'INSERT',
    pending: '',
    yank: '',
    historyIndex: -1,
    draft: '',
    suggestionIndex: -1,
    pendingSubmit: null,
    pendingEditor: null,
  });

  // Always keep the ref pointing to the latest onSubmit so the effect
  // doesn't need onSubmit as a dependency (avoids stale-closure issues).
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Consume pendingSubmit after React has committed the state update.
  // This is the correct pattern: the updater runs during the render phase
  // (async from the event handler's perspective in React 18), so we cannot
  // rely on the updater having run by the time the event handler returns.
  useEffect(() => {
    if (state.pendingSubmit !== null) {
      onSubmitRef.current(state.pendingSubmit);
      setState((s) => ({ ...s, pendingSubmit: null }));
    }
  }, [state.pendingSubmit]);

  // Open $EDITOR when pendingEditor is set. spawnSync blocks the event loop,
  // giving the editor full terminal control. Raw mode is disabled before spawn
  // and re-enabled after so the editor gets a normal TTY.
  useEffect(() => {
    if (state.pendingEditor === null) return;
    const initialContent = state.pendingEditor;
    const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'vi';
    const tmpPath = join(tmpdir(), `querky-edit-${Date.now()}.sql`);
    const ttyStdin = process.stdin as { setRawMode?: (mode: boolean) => void };
    try {
      writeFileSync(tmpPath, initialContent);
      process.stdout.write('\x1B[?25h'); // show cursor for editor
      ttyStdin.setRawMode?.(false);
      spawnSync(editor, [tmpPath], { stdio: 'inherit' });
      // Clear visible screen so Ink redraws from a known position, then
      // re-hide the cursor (App hides it on mount but the editor showed it).
      process.stdout.write('\x1B[2J\x1B[H\x1B[?25l');
      ttyStdin.setRawMode?.(true);
      const content = readFileSync(tmpPath, 'utf8').trimEnd();
      setState((s) => ({ ...s, pendingEditor: null, value: content, cursor: content.length, mode: 'INSERT' }));
    } catch {
      ttyStdin.setRawMode?.(true);
      setState((s) => ({ ...s, pendingEditor: null }));
    } finally {
      try { unlinkSync(tmpPath); } catch { /* best-effort */ }
    }
  }, [state.pendingEditor]);

  useInput(
    (input, key) => {
      setState((s) => {
        // ── INSERT mode ──────────────────────────────────────────────
        if (s.mode === 'INSERT') {
          if (key.escape) {
            if (s.value.startsWith('!')) {
              return { ...s, value: '', cursor: 0, pending: '' };
            }
            if (!vimEnabled) return s;
            return { ...s, mode: 'NORMAL', cursor: Math.max(0, s.cursor - 1), pending: '' };
          }
          if (key.return) {
            const sugs = getSuggestions?.(s.value, s.cursor) ?? [];
            if (sugs.length > 0 && s.suggestionIndex >= 0) {
              const sug = sugs[s.suggestionIndex];
              if (onSuggestionAccept) {
                const r = onSuggestionAccept(s.value, s.cursor, sug);
                return { ...s, value: r.value, cursor: r.cursor, suggestionIndex: -1 };
              }
              const val = `/${sug}`;
              return { ...s, value: val, cursor: val.length, suggestionIndex: -1 };
            }
            const trimmed = s.value.trim();
            return { value: '', cursor: 0, mode: 'INSERT', pending: '', yank: s.yank, historyIndex: -1, draft: '', suggestionIndex: -1, pendingSubmit: trimmed || null };
          }
          if (key.upArrow) {
            const sugs = getSuggestions?.(s.value, s.cursor) ?? [];
            if (sugs.length > 0) {
              const next = s.suggestionIndex <= 0 ? sugs.length - 1 : s.suggestionIndex - 1;
              return { ...s, suggestionIndex: next };
            }
            if (history.length === 0) return s;
            const draft = s.historyIndex === -1 ? s.value : s.draft;
            const next = s.historyIndex === -1 ? history.length - 1 : Math.max(0, s.historyIndex - 1);
            const val = history[next] ?? '';
            return { ...s, value: val, cursor: val.length, historyIndex: next, draft };
          }
          if (key.downArrow) {
            const sugs = getSuggestions?.(s.value, s.cursor) ?? [];
            if (sugs.length > 0) {
              const next = s.suggestionIndex >= sugs.length - 1 ? 0 : s.suggestionIndex + 1;
              return { ...s, suggestionIndex: next };
            }
            if (s.historyIndex === -1) return s;
            if (s.historyIndex === history.length - 1) {
              return { ...s, value: s.draft, cursor: s.draft.length, historyIndex: -1, draft: '' };
            }
            const next = s.historyIndex + 1;
            const val = history[next] ?? '';
            return { ...s, value: val, cursor: val.length, historyIndex: next };
          }
          if (key.backspace || key.delete) {
            if (s.cursor === 0) return s;
            return {
              ...s,
              value: s.value.slice(0, s.cursor - 1) + s.value.slice(s.cursor),
              cursor: s.cursor - 1,
              historyIndex: -1,
            };
          }
          if (key.leftArrow) return { ...s, cursor: Math.max(0, s.cursor - 1) };
          if (key.rightArrow) return { ...s, cursor: Math.min(s.value.length, s.cursor + 1) };
          if (key.tab && !key.shift) {
            const sugs = getSuggestions?.(s.value, s.cursor) ?? [];
            if (sugs.length > 0) {
              const next = s.suggestionIndex < sugs.length - 1 ? s.suggestionIndex + 1 : 0;
              return { ...s, suggestionIndex: next };
            }
            const completed = onTab?.(s.value);
            if (completed != null) return { ...s, value: completed, cursor: completed.length };
            return s;
          }
          if (key.tab && key.shift) {
            const sugs = getSuggestions?.(s.value, s.cursor) ?? [];
            if (sugs.length > 0) {
              const next = s.suggestionIndex <= 0 ? sugs.length - 1 : s.suggestionIndex - 1;
              return { ...s, suggestionIndex: next };
            }
            return s;
          }
          if (key.ctrl && input === 'e') {
            return { ...s, pendingEditor: s.value };
          }
          if (!key.ctrl && !key.meta && input) {
            const chars = input === '!' && s.value === '' ? '! ' : input;
            return {
              ...s,
              value: s.value.slice(0, s.cursor) + chars + s.value.slice(s.cursor),
              cursor: s.cursor + chars.length,
              historyIndex: -1,
              suggestionIndex: -1,
            };
          }
          return s;
        }

        // ── NORMAL mode ──────────────────────────────────────────────
        if (key.return) {
          const trimmed = s.value.trim();
          return { value: '', cursor: 0, mode: 'INSERT', pending: '', yank: s.yank, historyIndex: -1, draft: '', suggestionIndex: -1, pendingSubmit: trimmed || null };
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
          case 'e': return { ...s, pendingEditor: s.value };
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

  return { value: state.value, cursor: state.cursor, mode: vimEnabled ? state.mode : 'INSERT', suggestionIndex: state.suggestionIndex };
}
