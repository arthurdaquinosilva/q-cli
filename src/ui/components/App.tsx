import { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type { ConnectionState } from '../../db/client.js';
import { runQuery, type QueryState } from '../../db/query.js';
import { runCommand } from '../../commands/router.js';
import { loadHistory, saveHistory, addToHistory } from '../../config/history.js';
import { QueryInput } from './QueryInput.js';
import { QueryResult } from './QueryResult.js';
import { Banner } from './Banner.js';
import { theme } from '../theme.js';
import type { VimMode } from '../hooks/useVimInput.js';

interface AppProps {
  connectionState: ConnectionState;
}

export function App({ connectionState }: AppProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [queryState, setQueryState] = useState<QueryState>({ status: 'idle' });
  const [lastQuery, setLastQuery] = useState<string>('');
  const [vimMode, setVimMode] = useState<VimMode>('INSERT');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [vimEnabled, setVimEnabled] = useState(true);
  const [commandMessage, setCommandMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<string[]>(() => loadHistory());

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

  async function handleSubmit(sql: string) {
    if (sql.startsWith('/')) {
      const result = runCommand(sql, { vimEnabled, setVimEnabled });
      setLastQuery(sql);
      setCommandMessage(result);
      setQueryState({ status: 'idle' });
      return;
    }
    if (connectionState.status !== 'connected') return;
    setCommandMessage(null);
    setLastQuery(sql);
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

  const isLoading = queryState.status === 'running';
  const isConnected = connectionState.status === 'connected';

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner connectionState={connectionState} />

      {lastQuery !== '' && (
        <Box flexDirection="column" marginBottom={1}>
          <Box borderStyle="round" borderColor={theme.accent} paddingX={1}>
            <Text color={theme.accent} bold>Query  </Text>
            <Text dimColor>{lastQuery}</Text>
          </Box>
          <Box marginTop={1}>
            {commandMessage ? (
              <Text color={commandMessage.ok ? theme.accent : theme.error}>
                {commandMessage.ok ? '✓' : '✗'} {commandMessage.text}
              </Text>
            ) : (
              <QueryResult state={queryState} elapsed={elapsed} />
            )}
          </Box>
        </Box>
      )}

      {isConnected ? (
        <QueryInput onSubmit={handleSubmit} isLoading={isLoading} onModeChange={setVimMode} vimEnabled={vimEnabled} history={history} />
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
