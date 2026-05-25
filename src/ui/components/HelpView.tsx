import { Box, Text } from 'ink';
import type { HelpData } from '../../commands/router.js';
import { theme } from '../theme.js';

const USAGE_WIDTH = 28;

export function HelpView({ data }: { data: HelpData }) {
  if (data.mode === 'detail' && data.entry) {
    const { usage, description, psqlAlias, detail, example } = data.entry;
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="white">{usage}{psqlAlias ? `  ${psqlAlias}` : ''}</Text>
        <Box marginTop={1}>
          <Text>{description}</Text>
        </Box>
        {detail && (
          <Box marginTop={1}>
            <Text dimColor>{detail}</Text>
          </Box>
        )}
        {example && (
          <Box marginTop={1}>
            <Text dimColor>Example: </Text>
            <Text color={theme.accent}>{example}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (data.mode === 'list' && data.groups) {
    return (
      <Box flexDirection="column" marginTop={1}>
        {data.groups.map((group, gi) => (
          <Box key={group.category} flexDirection="column" marginBottom={gi < data.groups!.length - 1 ? 1 : 0}>
            <Text bold color={theme.accent}>{group.category}</Text>
            {group.entries.map((entry) => (
              <Box key={entry.name} marginLeft={2}>
                <Text color="white">{entry.usage.padEnd(USAGE_WIDTH)}</Text>
                <Text dimColor>{entry.description}</Text>
                {entry.psqlAlias && <Text dimColor>  {entry.psqlAlias}</Text>}
              </Box>
            ))}
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>/help {'<command>'} for more details.</Text>
        </Box>
      </Box>
    );
  }

  return null;
}
