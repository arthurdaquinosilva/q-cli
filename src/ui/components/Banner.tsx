import { Box, Text } from 'ink';
import type { ConnectionState } from '../../db/client.js';
import { theme } from '../theme.js';

declare const __PKG_VERSION__: string;
const version = typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : (process.env.npm_package_version ?? 'unknown');

const LOGO = [
  ' ▗▄▄▄▄▄▖',
  '▐░ ● ● ░▌',
  '▐░ ◡◡◡ ░▌',
  '▐░   ▗▟▌',
  ' ▀▀▀▀▝▀▄',
];

const GRADIENT = [
  '#ff00dd',
  '#ff33bb',
  '#ff6699',
  '#ff9966',
  '#ff7722',
];

interface BannerProps {
  connectionState: ConnectionState;
}

export function Banner({ connectionState }: BannerProps) {
  const isConnected = connectionState.status === 'connected';

  return (
    <Box flexDirection="row" marginTop={2} marginBottom={2}>
      {/* Logo — fixed 4 lines */}
      <Box flexDirection="column" marginRight={2}>
        {LOGO.map((line, i) => (
          <Text key={i} color={GRADIENT[i]} bold>
            {line}
          </Text>
        ))}
      </Box>

      {/* Info — aligned to top, matches logo line by line */}
      <Box flexDirection="column">
        <Text bold color={theme.accent}>
          Querky <Text dimColor>v{version}</Text>
        </Text>
        <Text> </Text>
        {isConnected ? (
          <>
            <Text>
              <Text dimColor>Connected as  </Text>
              <Text bold color={theme.insertMode}>{connectionState.user}</Text>
            </Text>
            <Text>
              <Text dimColor>Database      </Text>
              <Text bold color={theme.insertMode}>{connectionState.database}</Text>
            </Text>
            <Text>
              <Text dimColor>Host          </Text>
              <Text bold color={theme.insertMode}>{connectionState.host}</Text>
            </Text>
          </>
        ) : (
          <Text color={theme.error}>✗ {connectionState.message}</Text>
        )}
      </Box>
    </Box>
  );
}
