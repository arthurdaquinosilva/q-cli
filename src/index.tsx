import { parseArgs } from 'node:util';
import { render } from 'ink';
import { connect } from './db/client.js';
import { App } from './ui/components/App.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    connection: { type: 'string', short: 'c' },
    'ai-url':   { type: 'string', default: 'http://localhost:11434/v1' },
    'ai-model': { type: 'string', default: 'llama3.2' },
  },
  strict: false,
});

if (!values.connection) {
  console.error('Error: --connection <dsn> is required');
  console.error('Usage: sql-cli --connection postgresql://user:pass@host/db');
  process.exit(1);
}

const connectionState = await connect(values.connection);

render(
  <App
    connectionState={connectionState}
    aiUrl={values['ai-url'] as string}
    aiModel={values['ai-model'] as string}
  />,
  { exitOnCtrlC: true },
);
