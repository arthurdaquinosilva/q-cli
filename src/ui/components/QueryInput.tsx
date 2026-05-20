import { Box, Text, useInput, useStdin } from 'ink';
import { useState } from 'react';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export function QueryInput({ onSubmit, isLoading }: QueryInputProps) {
  const [value, setValue] = useState('');
  const { isRawModeSupported } = useStdin();

  useInput(
    (input, key) => {
      if (key.return) {
        const trimmed = value.trim();
        if (trimmed) {
          onSubmit(trimmed);
          setValue('');
        }
        return;
      }

      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        setValue((v) => v + input);
      }
    },
    { isActive: isRawModeSupported && !isLoading },
  );

  return (
    <Box>
      <Text color="cyan" bold>{'> '}</Text>
      <Text>{value}</Text>
      {!isLoading && <Text color="cyan">█</Text>}
      {isLoading && <Text dimColor> running...</Text>}
    </Box>
  );
}
