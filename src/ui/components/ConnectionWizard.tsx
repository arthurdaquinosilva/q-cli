import { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { connectParams, type ConnectionState, type Driver } from '../../db/client.js';
import { theme } from '../theme.js';

const FIELD_LABELS = ['Driver', 'Host', 'Port', 'Database', 'User', 'Password'] as const;
const FIELD_COUNT = FIELD_LABELS.length;
const LABEL_WIDTH = 10;

interface WizardFields {
  driver: Driver;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

interface ConnectionWizardProps {
  onConnect: (state: ConnectionState) => void;
}

export function ConnectionWizard({ onConnect }: ConnectionWizardProps) {
  const { isRawModeSupported } = useStdin();
  const [focus, setFocus] = useState(0);
  const [fields, setFields] = useState<WizardFields>({
    driver: 'postgresql',
    host: 'localhost',
    port: '5432',
    database: '',
    user: '',
    password: '',
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getTextValue(idx: number): string {
    switch (idx) {
      case 1: return fields.host;
      case 2: return fields.port;
      case 3: return fields.database;
      case 4: return fields.user;
      case 5: return fields.password;
      default: return '';
    }
  }

  function setTextValue(idx: number, value: string) {
    setFields((prev) => {
      switch (idx) {
        case 1: return { ...prev, host: value };
        case 2: return { ...prev, port: value };
        case 3: return { ...prev, database: value };
        case 4: return { ...prev, user: value };
        case 5: return { ...prev, password: value };
        default: return prev;
      }
    });
  }

  function toggleDriver() {
    setFields((prev) => {
      const next: Driver = prev.driver === 'postgresql' ? 'mysql' : 'postgresql';
      return { ...prev, driver: next, port: next === 'mysql' ? '3306' : '5432' };
    });
  }

  async function submit() {
    setConnecting(true);
    setError(null);
    const result = await connectParams({
      driver: fields.driver,
      host: fields.host || 'localhost',
      port: parseInt(fields.port) || (fields.driver === 'mysql' ? 3306 : 5432),
      database: fields.database,
      user: fields.user,
      password: fields.password,
    });
    setConnecting(false);
    if (result.status === 'error') {
      setError(result.message);
    } else {
      onConnect(result);
    }
  }

  useInput(
    (input, key) => {
      if (connecting) return;

      if (key.tab && key.shift) {
        setFocus((f) => (f - 1 + FIELD_COUNT) % FIELD_COUNT);
        return;
      }
      if (key.tab || key.downArrow) {
        setFocus((f) => (f + 1) % FIELD_COUNT);
        return;
      }
      if (key.upArrow) {
        setFocus((f) => (f - 1 + FIELD_COUNT) % FIELD_COUNT);
        return;
      }

      if (focus === 0) {
        if (key.leftArrow || key.rightArrow || input === ' ') toggleDriver();
        if (key.return) setFocus(1);
        return;
      }

      if (key.return) {
        if (focus === FIELD_COUNT - 1) {
          void submit();
        } else {
          setFocus((f) => f + 1);
        }
        return;
      }

      if (key.backspace || key.delete) {
        setTextValue(focus, getTextValue(focus).slice(0, -1));
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setTextValue(focus, getTextValue(focus) + input);
      }
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Box flexDirection="column" paddingX={2} paddingTop={2} paddingBottom={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.accent}>Connect to a database</Text>
      </Box>

      {FIELD_LABELS.map((label, idx) => {
        const isFocused = focus === idx;
        const isDriver = idx === 0;
        const isPassword = idx === 5;

        return (
          <Box key={label}>
            <Text color={isFocused ? theme.accent : undefined} bold={isFocused}>
              {label.padEnd(LABEL_WIDTH)}
            </Text>
            {isDriver ? (
              <Box>
                <Text color={fields.driver === 'postgresql' ? theme.accent : undefined} bold={fields.driver === 'postgresql'}>
                  {fields.driver === 'postgresql' ? '● ' : '○ '}{'PostgreSQL'}
                </Text>
                <Text>{'   '}</Text>
                <Text color={fields.driver === 'mysql' ? theme.accent : undefined} bold={fields.driver === 'mysql'}>
                  {fields.driver === 'mysql' ? '● ' : '○ '}{'MySQL'}
                </Text>
              </Box>
            ) : (
              <Box>
                <Text>
                  {isPassword
                    ? '•'.repeat(getTextValue(idx).length)
                    : getTextValue(idx)}
                </Text>
                {isFocused && <Text color={theme.accent} bold>▌</Text>}
              </Box>
            )}
          </Box>
        );
      })}

      <Box marginTop={1}>
        {connecting ? (
          <Text dimColor>Connecting…</Text>
        ) : error ? (
          <Text color={theme.error}>✗ {error}</Text>
        ) : null}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Tab · ↑↓ navigate   Enter connect   ←→ toggle driver</Text>
      </Box>
    </Box>
  );
}
