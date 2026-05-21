import { Box, Text } from 'ink';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ConnectionState } from '../../db/client.js';
import { theme } from '../theme.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pkg = { version: 'unknown' };
try {
  pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as { version: string };
} catch { /* non-critical */ }

const LOGO = [
  ' ▗▄▄▄▄▖',
  '▐░    ░▌',
  '▐░    ░▌',
  '▐░  ▗▟▌',
  ' ▀▀▀▝▀ ',
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
          <Text key={i} color={theme.accent} bold>
            {line}
          </Text>
        ))}
      </Box>

      {/* Info — aligned to top, matches logo line by line */}
      <Box flexDirection="column">
        <Text bold color={theme.accent}>
          Q CLI <Text dimColor>v{pkg.version}</Text>
        </Text>
        <Text> </Text>
        {isConnected ? (
          <>
            <Text>
              <Text dimColor>Connected as  </Text>
              <Text bold color="white">{connectionState.user}</Text>
            </Text>
            <Text>
              <Text dimColor>Database      </Text>
              <Text bold color="white">{connectionState.database}</Text>
            </Text>
            <Text>
              <Text dimColor>Host          </Text>
              <Text bold color="white">{connectionState.host}</Text>
            </Text>
          </>
        ) : (
          <Text color={theme.error}>✗ {connectionState.message}</Text>
        )}
      </Box>
    </Box>
  );
}
