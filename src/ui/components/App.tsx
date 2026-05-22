import { useState, useEffect, useRef } from 'react';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Box, Text, Static, useApp, useInput, useStdin } from 'ink';
import type { ConnectionState, DbResult } from '../../db/client.js';
import { runQuery, type QueryState } from '../../db/query.js';
import { runCommand } from '../../commands/router.js';
import { runShell } from '../../commands/shell.js';
import { streamExplain } from '../../ai/client.js';
import { loadHistory, saveHistory, addToHistory } from '../../config/history.js';
import { getAllAliases, saveAlias, deleteAlias, makeScope } from '../../config/aliases.js';
import { fetchSchema, type Schema } from '../../db/schema.js';
import { QueryInput } from './QueryInput.js';
import { QueryResult, ErrorBox } from './QueryResult.js';
import { Banner } from './Banner.js';
import { theme } from '../theme.js';
import type { VimMode } from '../hooks/useVimInput.js';

const PAGE_SIZE = 50;
const PLACEHOLDER = '#a5b4fc';

// Limit what the live result area shows so the dynamic region (result +
// QueryInput ~9 lines + mode indicator ~2 lines + entry chrome ~5 lines)
// stays within terminal height.  Full output lands in the static scrollback
// history after the next submit.  Minimum 3 so there is always something.
function activePageSize(): number {
  return Math.max(3, (process.stdout.rows ?? 24) - 21);
}

function limitLines(s: string, n: number): string {
  const lines = s.split('\n');
  if (lines.length <= n) return s;
  return lines.slice(0, n).join('\n') + `\n… +${lines.length - n} more lines (scroll up after next submit)`;
}

interface Entry {
  id: number;
  query: string;
  commandMessage: { text: string; ok: boolean } | null;
  queryState: QueryState;
  elapsed: number | null;
  page: number;
  aiResponse: string;
  aiError: string | null;
  shellOutput: string | null;
}

function EntryView({ entry }: { entry: Entry }) {
  const showAi = entry.aiResponse !== '' || entry.aiError !== null;
  const isShell = entry.query.startsWith('!');
  const isCommand = !isShell && (entry.query.startsWith('/') || entry.query.startsWith('\\'));
  const label = isShell ? 'Shell:' : isCommand ? 'Command:' : 'Query:';
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box borderStyle="round" borderColor={theme.accent} paddingX={1}>
        <Text color={theme.accent} bold>{label} </Text>
        <Text dimColor>{entry.query}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {isShell ? (
          entry.shellOutput !== null && (
            <Text>{entry.shellOutput || '(no output)'}</Text>
          )
        ) : (
          <>
            {entry.commandMessage && (
              entry.commandMessage.ok
                ? <Text color={theme.accent}>✓ {entry.commandMessage.text}</Text>
                : <ErrorBox message={entry.commandMessage.text} />
            )}
            {showAi ? (
              <Box flexDirection="column">
                <Text color={theme.accent} bold>Explanation:</Text>
                <Box flexDirection="column" marginTop={1}>
                  {entry.aiError ? (
                    <ErrorBox message={entry.aiError} />
                  ) : (
                    <Text color={PLACEHOLDER}>{entry.aiResponse}</Text>
                  )}
                </Box>
              </Box>
            ) : (
              !entry.commandMessage && (
                <QueryResult state={entry.queryState} elapsed={entry.elapsed} page={entry.page} pageSize={PAGE_SIZE} />
              )
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

interface AppProps {
  connectionState: ConnectionState;
  aiUrl: string;
  aiModel: string;
  aiKey: string;
  onChangeDatabase?: (database: string) => void;
}

export function App({ connectionState, aiUrl, aiModel, aiKey, onChangeDatabase }: AppProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [queryState, setQueryState] = useState<QueryState>({ status: 'idle' });
  const [lastQuery, setLastQuery] = useState<string>('');
  const [lastSqlQuery, setLastSqlQuery] = useState<string>('');
  const [lastResult, setLastResult] = useState<DbResult | null>(null);
  const [page, setPage] = useState(0);
  const [vimMode, setVimMode] = useState<VimMode>('INSERT');
  const [inputIsShell, setInputIsShell] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [vimEnabled, setVimEnabled] = useState(true);
  const [commandMessage, setCommandMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [schema, setSchema] = useState<Schema | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [shellOutput, setShellOutput] = useState<string | null>(null);
  const [isShellRunning, setIsShellRunning] = useState(false);
  const [completedEntries, setCompletedEntries] = useState<Entry[]>([]);
  const entryIdRef = useRef(0);

  const aliasScope = connectionState.status === 'connected'
    ? makeScope(connectionState.driver, connectionState.user, connectionState.host, connectionState.database)
    : '';
  const [aliases, setAliases] = useState<Record<string, string>>(() =>
    aliasScope ? getAllAliases(aliasScope) : {}
  );

  function handleSaveAlias(name: string, query: string) {
    saveAlias(aliasScope, name, query);
    setAliases(getAllAliases(aliasScope));
  }

  function handleDeleteAlias(name: string): boolean {
    const removed = deleteAlias(aliasScope, name);
    if (removed) setAliases(getAllAliases(aliasScope));
    return removed;
  }

  useEffect(() => {
    if (connectionState.status !== 'connected') { setSchema(null); return; }
    void fetchSchema(connectionState.client, connectionState.driver).then(setSchema);
  }, [connectionState]);

  useEffect(() => {
    if (!isRawModeSupported) return;
    const ttyStdin = process.stdin as { setRawMode?: (mode: boolean) => void };
    const handleCont = () => ttyStdin.setRawMode?.(true);
    process.on('SIGCONT', handleCont);
    return () => { process.off('SIGCONT', handleCont); };
  }, [isRawModeSupported]);

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') exit();
      if (key.ctrl && input === 'z') {
        const ttyStdin = process.stdin as { setRawMode?: (mode: boolean) => void };
        ttyStdin.setRawMode?.(false);
        process.kill(process.pid, 'SIGTSTP');
      }
    },
    { isActive: isRawModeSupported },
  );

  async function handleExplain(query: string) {
    setAiResponse('');
    setAiError(null);
    setIsStreaming(true);
    setCommandMessage(null);
    setQueryState({ status: 'idle' });
    try {
      for await (const chunk of streamExplain(query, aiUrl, aiModel, aiKey || undefined)) {
        setAiResponse((prev) => prev + chunk);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleQuery(sql: string) {
    if (connectionState.status !== 'connected') return;
    setAiResponse('');
    setAiError(null);
    setCommandMessage(null);
    setLastQuery(sql);
    setLastSqlQuery(sql);
    setElapsed(null);
    setPage(0);
    setQueryState({ status: 'running' });
    const updated = addToHistory(history, sql);
    setHistory(updated);
    saveHistory(updated);
    const start = Date.now();
    const result = await runQuery(connectionState.client, sql);
    setElapsed(Date.now() - start);
    setQueryState(result);
    if (result.status === 'success') setLastResult(result.result);
  }

  function handleExport(format: 'csv' | 'json') {
    if (!lastResult || lastResult.rows.length === 0) {
      setCommandMessage({ ok: false, text: 'No results to export — run a query first.' });
      return;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = join(homedir(), `q-export-${ts}.${format}`);
    try {
      if (format === 'json') {
        writeFileSync(filename, JSON.stringify(lastResult.rows, null, 2));
      } else {
        const header = lastResult.fields.join(',');
        const rows = lastResult.rows.map((row) =>
          lastResult.fields.map((f) => {
            const v = row[f];
            if (v === null || v === undefined) return '';
            const s = String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
              ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(',')
        );
        writeFileSync(filename, [header, ...rows].join('\n'));
      }
      setCommandMessage({ ok: true, text: `Exported to ${filename}` });
    } catch (err) {
      setCommandMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  }

  function snapshotActiveEntry() {
    if (lastQuery === '') return;
    setCompletedEntries((prev) => [
      ...prev,
      {
        id: entryIdRef.current++,
        query: lastQuery,
        commandMessage,
        queryState,
        elapsed,
        page,
        aiResponse,
        aiError,
        shellOutput,
      },
    ]);
  }

  async function handleShell(cmd: string) {
    setShellOutput(null);
    setIsShellRunning(true);
    setCommandMessage(null);
    setAiResponse('');
    setAiError(null);
    setQueryState({ status: 'idle' });
    const result = await runShell(cmd);
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
    setShellOutput(combined || '(no output)');
    setIsShellRunning(false);
  }

  async function handleSubmit(sql: string) {
    if (sql === '/next') { setPage((p) => p + 1); return; }
    if (sql === '/prev') { setPage((p) => Math.max(0, p - 1)); return; }

    snapshotActiveEntry();

    if (sql.startsWith('!')) {
      const cmd = sql.slice(1).trim();
      setLastQuery(sql);
      setShellOutput(null);
      void handleShell(cmd);
      return;
    }

    if (sql.startsWith('/') || sql.startsWith('\\')) {
      const result = runCommand(sql, {
        vimEnabled,
        setVimEnabled,
        lastSqlQuery,
        currentDatabase: connectionState.status === 'connected' ? connectionState.database : '',
        driver: connectionState.status === 'connected' ? connectionState.driver : 'postgresql',
        onExplain: (query) => { void handleExplain(query); },
        onQuery: (query) => { void handleQuery(query); },
        onChangeDatabase: (db) => { onChangeDatabase?.(db); },
        onExport: handleExport,
        onClear: () => {
          // Erase the visible screen and scrollback buffer before React re-renders
          // so the banner appears at the very top with no residual output above it.
          // \x1B[2J = clear screen, \x1B[3J = clear scrollback, \x1B[H = cursor home.
          process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
          setCompletedEntries([]);
          setLastQuery('');
          setCommandMessage(null);
          setQueryState({ status: 'idle' });
          setShellOutput(null);
          setAiResponse('');
          setAiError(null);
          setElapsed(null);
          setPage(0);
        },
        aliases,
        onSaveAlias: handleSaveAlias,
        onDeleteAlias: handleDeleteAlias,
      });
      if (result.cleared) return;
      setLastQuery(sql);
      setAiResponse('');
      setAiError(null);
      setElapsed(null);
      setPage(0);
      setQueryState({ status: 'idle' });
      if (result.message) setCommandMessage({ ok: result.ok, text: result.message });
      else setCommandMessage(null);
      return;
    }
    void handleQuery(sql);
  }

  const isLoading = queryState.status === 'running' || isStreaming || isShellRunning;
  const isConnected = connectionState.status === 'connected';
  const showAi = aiResponse !== '' || isStreaming || aiError !== null;
  const isShellEntry = lastQuery.startsWith('!');
  const isCommand = !isShellEntry && (lastQuery.startsWith('/') || lastQuery.startsWith('\\'));
  const activeLabel = isShellEntry ? 'Shell:' : isCommand ? 'Command:' : 'Query:';

  return (
    <Box flexDirection="column">
      <Static items={completedEntries}>
        {(entry) => <EntryView key={entry.id} entry={entry} />}
      </Static>

      <Box flexDirection="column" paddingX={1}>
        {lastQuery === '' && <Banner connectionState={connectionState} />}

        {lastQuery !== '' && (
          <Box flexDirection="column" marginBottom={2}>
            <Box borderStyle="round" borderColor={theme.accent} paddingX={1}>
              <Text color={theme.accent} bold>{activeLabel} </Text>
              <Text dimColor>{lastQuery}</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              {isShellEntry ? (
                isShellRunning
                  ? <Text dimColor>running…</Text>
                  : <Text>{limitLines(shellOutput ?? '', activePageSize())}</Text>
              ) : (
                <>
                  {commandMessage && (
                    commandMessage.ok
                      ? <Text color={theme.accent}>✓ {commandMessage.text}</Text>
                      : <ErrorBox message={commandMessage.text} />
                  )}
                  {showAi ? (
                    <Box flexDirection="column">
                      <Text color={theme.accent} bold>Explanation:</Text>
                      <Box flexDirection="column" marginTop={1}>
                        {aiError ? (
                          <ErrorBox message={aiError} />
                        ) : (
                          <Text color={PLACEHOLDER}>
                            {aiResponse}
                            {isStreaming && <Text color={PLACEHOLDER}>{'▋'}</Text>}
                          </Text>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    !commandMessage && (
                      <QueryResult state={queryState} elapsed={elapsed} page={page} pageSize={activePageSize()} />
                    )
                  )}
                </>
              )}
            </Box>
          </Box>
        )}

        {isConnected ? (
          <QueryInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onModeChange={setVimMode}
            onShellModeChange={setInputIsShell}
            vimEnabled={vimEnabled}
            history={history}
            aliases={aliases}
            schema={schema ?? undefined}
          />
        ) : (
          <Text dimColor>Not connected. Press Ctrl+C to exit.</Text>
        )}

        {(vimEnabled || inputIsShell) && (
          <Box marginTop={1}>
            <Text bold color={inputIsShell ? theme.shellMode : (vimMode === 'NORMAL' ? theme.normalMode : theme.insertMode)}>
              {isRawModeSupported ? (inputIsShell ? '[SHELL]' : `[${vimMode}]`) : ''}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
