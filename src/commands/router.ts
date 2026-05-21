import type { Driver } from '../db/client.js';

export interface CommandResult {
  ok: boolean;
  message: string;
}

export interface CommandContext {
  vimEnabled: boolean;
  setVimEnabled: (enabled: boolean) => void;
  lastSqlQuery: string;
  currentDatabase: string;
  args: string;
  driver: Driver;
  onExplain: (query: string) => void;
  onQuery: (sql: string) => void;
  onChangeDatabase: (database: string) => void;
}

interface Command {
  description: string;
  run: (ctx: CommandContext) => CommandResult;
}

const DB_QUERIES: Record<Driver, { databases: string; tables: string; users: string }> = {
  postgresql: {
    databases: `SELECT datname AS database FROM pg_database WHERE datistemplate = false ORDER BY datname`,
    tables: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    users: `SELECT usename AS user, usesuper AS superuser FROM pg_user ORDER BY usename`,
  },
  mysql: {
    databases: `SHOW DATABASES`,
    tables: `SHOW TABLES`,
    users: `SELECT user, host FROM mysql.user ORDER BY user`,
  },
};

const PSQL_ALIASES: Record<string, string> = {
  l: 'databases',
  d: 'tables',
  dt: 'tables',
  du: 'users',
  c: 'changeDatabase',
};

const COMMANDS: Record<string, Command> = {
  'toggle-vim-mode': {
    description: 'Toggle vim keybindings on/off',
    run: (ctx) => {
      const next = !ctx.vimEnabled;
      ctx.setVimEnabled(next);
      return { ok: true, message: `Vim mode ${next ? 'enabled' : 'disabled'}` };
    },
  },
  'databases': {
    description: 'List available databases',
    run: (ctx) => {
      ctx.onQuery(DB_QUERIES[ctx.driver].databases);
      return { ok: true, message: '' };
    },
  },
  'tables': {
    description: 'List tables in the current database',
    run: (ctx) => {
      ctx.onQuery(DB_QUERIES[ctx.driver].tables);
      return { ok: true, message: '' };
    },
  },
  'users': {
    description: 'List database users',
    run: (ctx) => {
      ctx.onQuery(DB_QUERIES[ctx.driver].users);
      return { ok: true, message: '' };
    },
  },
  'changeDatabase': {
    description: 'Switch to a different database: \\c dbname',
    run: (ctx) => {
      if (!ctx.args) return { ok: true, message: `Connected to database: ${ctx.currentDatabase}` };
      ctx.onChangeDatabase(ctx.args.trim());
      return { ok: true, message: '' };
    },
  },
  'explain': {
    description: 'Explain a SQL query using AI: /explain SELECT ...',
    run: (ctx) => {
      if (!ctx.args) return { ok: false, message: 'Usage: /explain <SQL query>' };
      ctx.onExplain(ctx.args);
      return { ok: true, message: '' };
    },
  },
  'explain-previous': {
    description: 'Explain the last executed query using AI',
    run: (ctx) => {
      if (!ctx.lastSqlQuery) {
        return { ok: false, message: 'No query to explain — run a SQL query first.' };
      }
      ctx.onExplain(ctx.lastSqlQuery);
      return { ok: true, message: '' };
    },
  },
};

export const COMMAND_LIST = Object.entries(COMMANDS).map(([name, cmd]) => ({
  name,
  description: cmd.description,
}));

export function getCompletions(partial: string): string[] {
  return COMMAND_LIST.map((c) => c.name).filter((n) => n.startsWith(partial));
}

export function runCommand(input: string, ctx: Omit<CommandContext, 'args'>): CommandResult {
  const [rawName, ...rest] = input.slice(1).trim().split(/\s+/);
  const name = PSQL_ALIASES[rawName ?? ''] ?? rawName ?? '';
  const cmd = COMMANDS[name];
  const prefix = input.startsWith('\\') ? '\\' : '/';
  if (!cmd) return { ok: false, message: `Unknown command: ${prefix}${rawName}` };
  return cmd.run({ ...ctx, args: rest.join(' ') });
}
