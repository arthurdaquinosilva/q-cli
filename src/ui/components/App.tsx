import { Box, Text, useApp, useInput } from 'ink';

export function App() {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q' || key.ctrl && input === 'c') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">sql-cli</Text>
      <Text dimColor>Press q to quit</Text>
    </Box>
  );
}
