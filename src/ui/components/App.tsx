import { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type { ConnectionState } from '../../db/client.js';
import { runQuery, type QueryState } from '../../db/query.js';
import { runCommand } from '../../commands/router.js';
import { streamExplain } from '../../ai/client.js';
import { loadHistory, saveHistory, addToHistory } from '../../config/history.js';
import { QueryInput } from './QueryInput.js';
import { QueryResult } from './QueryResult.js';
import { Banner } from './Banner.js';
import { theme } from '../theme.js';
import type { VimMode } from '../hooks/useVimInput.js';

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
  const [vimMode, setVimMode] = useState<VimMode>('INSERT');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [vimEnabled, setVimEnabled] = useState(true);
  const [commandMessage, setCommandMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
    setQueryState({ status: 'running' });
    const updated = addToHistory(history, sql);
    setHistory(updated);
    saveHistory(updated);
    const start = Date.now();
    const result = await runQuery(connectionState.client, sql);
    setElapsed(Date.now() - start);
    setQueryState(result);
  }

  async function handleSubmit(sql: string) {
    if (sql.startsWith('/') || sql.startsWith('\\')) {
      const result = runCommand(sql, {
        vimEnabled,
        setVimEnabled,
        lastSqlQuery,
        driver: connectionState.status === 'connected' ? connectionState.driver : 'postgresql',
        onExplain: (query) => { void handleExplain(query); },
        onQuery: (query) => { void handleQuery(query); },
        onChangeDatabase: (db) => { onChangeDatabase?.(db); },
      });
      setLastQuery(sql);
      if (result.message) setCommandMessage(result);
      else setCommandMessage(null);
      if (!result.message) setQueryState({ status: 'idle' });
      return;
    }
    void handleQuery(sql);
  }

  const isLoading = queryState.status === 'running' || isStreaming;
  const isConnected = connectionState.status === 'connected';
  const showAi = aiResponse !== '' || isStreaming || aiError !== null;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner connectionState={connectionState} />

      {lastQuery !== '' && (
        <Box flexDirection="column" marginBottom={2}>
          <Box borderStyle="round" borderColor={theme.accent} paddingX={1}>
            <Text color={theme.accent} bold>{lastQuery.startsWith('/') ? 'Command:' : 'Query:'} </Text>
            <Text dimColor>{lastQuery}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {commandMessage && (
              <Text color={commandMessage.ok ? theme.accent : theme.error}>
                {commandMessage.ok ? '✓' : '✗'} {commandMessage.message}
              </Text>
            )}
            {showAi ? (
              <Box flexDirection="column">
                <Text color={theme.accent} bold>Explanation:</Text>
              <Box borderStyle="round" borderColor={PLACEHOLDER} paddingX={1} flexDirection="column">
                {aiError ? (
                  <Text color={theme.error}>✗ {aiError}</Text>
                ) : (
                  <Text color={PLACEHOLDER}>
                    {aiResponse}
                    {isStreaming && <Text color={PLACEHOLDER}>{'▋'}</Text>}
                  </Text>
                )}
              </Box>
              </Box>
            ) : (
              !commandMessage && <QueryResult state={queryState} elapsed={elapsed} />
            )}
          </Box>
        </Box>
      )}

      {isConnected ? (
        <QueryInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onModeChange={setVimMode}
          vimEnabled={vimEnabled}
          history={history}
        />
      ) : (
        <Text dimColor>Not connected. Press Ctrl+C to exit.</Text>
      )}

      {vimEnabled && (
        <Box marginTop={1}>
          <Text bold color={vimMode === 'NORMAL' ? 'cyan' : theme.accent}>
            {isRawModeSupported ? `[${vimMode}]` : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

const ACCENT_DIM = '#4f46e5';
const PLACEHOLDER = '#a5b4fc';
