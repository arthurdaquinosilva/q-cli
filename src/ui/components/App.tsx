import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type { ConnectionState } from '../../db/client.js';

interface AppProps {
  connectionState: ConnectionState;
}

export function App({ connectionState }: AppProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  useInput(
    (input, key) => {
      if (input === 'q' || (key.ctrl && input === 'c')) {
        exit();
      }
    },
    { isActive: isRawModeSupported },
  );

  const statusLine =
    connectionState.status === 'connected'
      ? `✓ Connected to ${connectionState.database} on ${connectionState.host}`
      : `✗ Connection failed: ${connectionState.message}`;

  const statusColor =
    connectionState.status === 'connected' ? 'green' : 'red';

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">sql-cli</Text>
      <Box marginTop={1}>
        <Text color={statusColor}>{statusLine}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press q to quit</Text>
      </Box>
    </Box>
  );
}
