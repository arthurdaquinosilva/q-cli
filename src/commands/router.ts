import type { Driver } from '../db/client.js';
import { expandAlias } from '../config/aliases.js';
import { fuzzyScore } from '../ui/completions.js';

export interface CommandResult {
  ok: boolean;
  message: string;
  cleared?: boolean;
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
  onExport: (format: 'csv' | 'json') => void;
  onClear: () => void;
  // alias context
  aliases: Record<string, string>;
  onSaveAlias: (name: string, query: string) => void;
  onDeleteAlias: (name: string) => boolean;
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
  sqlite: {
    databases: `SELECT name FROM pragma_database_list`,
    tables: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    users: `SELECT 'SQLite has no users' AS message`,
  },
};

const PSQL_ALIASES: Record<string, string> = {
  l: 'databases',
  d: 'd',
  dt: 'tables',
  du: 'users',
  c: 'changeDatabase',
};

function describeBasicSql(driver: Driver, table: string): string {
  const t = table.replace(/'/g, "''");
  if (driver === 'postgresql') {
    return `SELECT column_name, data_type, is_nullable AS nullable, COALESCE(column_default, '') AS "default" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${t}' ORDER BY ordinal_position`;
  }
  if (driver === 'mysql') {
    return `SELECT column_name, column_type AS data_type, is_nullable AS nullable, COALESCE(column_default, '') AS \`default\` FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${t}' ORDER BY ordinal_position`;
  }
  return `SELECT name AS column_name, type AS data_type, CASE WHEN "notnull" = 0 THEN 'YES' ELSE 'NO' END AS nullable, COALESCE(dflt_value, '') AS "default" FROM pragma_table_info('${t}')`;
}

function describeFullSql(driver: Driver, table: string): string {
  const t = table.replace(/'/g, "''");
  if (driver === 'postgresql') {
    return `SELECT c.column_name, c.data_type, c.is_nullable AS nullable, COALESCE(c.column_default, '') AS "default", COALESCE(string_agg(DISTINCT CASE tc.constraint_type WHEN 'PRIMARY KEY' THEN 'PK' WHEN 'FOREIGN KEY' THEN 'FK' WHEN 'UNIQUE' THEN 'UQ' END, ', ') FILTER (WHERE tc.constraint_type IS NOT NULL), '') AS key FROM information_schema.columns c LEFT JOIN information_schema.key_column_usage kcu ON kcu.table_schema = c.table_schema AND kcu.table_name = c.table_name AND kcu.column_name = c.column_name LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE c.table_schema = 'public' AND c.table_name = '${t}' GROUP BY c.column_name, c.data_type, c.is_nullable, c.column_default, c.ordinal_position ORDER BY c.ordinal_position`;
  }
  if (driver === 'mysql') {
    return `SELECT c.column_name, c.column_type AS data_type, c.is_nullable AS nullable, COALESCE(c.column_default, '') AS \`default\`, COALESCE(GROUP_CONCAT(DISTINCT CASE tc.constraint_type WHEN 'PRIMARY KEY' THEN 'PK' WHEN 'FOREIGN KEY' THEN 'FK' WHEN 'UNIQUE' THEN 'UQ' END SEPARATOR ', '), '') AS \`key\` FROM information_schema.columns c LEFT JOIN information_schema.key_column_usage kcu ON kcu.table_schema = c.table_schema AND kcu.table_name = c.table_name AND kcu.column_name = c.column_name LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE c.table_schema = DATABASE() AND c.table_name = '${t}' GROUP BY c.column_name, c.column_type, c.is_nullable, c.column_default, c.ordinal_position ORDER BY c.ordinal_position`;
  }
  return `SELECT name AS column_name, type AS data_type, CASE WHEN "notnull" = 0 THEN 'YES' ELSE 'NO' END AS nullable, COALESCE(dflt_value, '') AS "default", CASE WHEN pk > 0 THEN 'PK' ELSE '' END AS key FROM pragma_table_info('${t}')`;
}

const COMMANDS: Record<string, Command> = {
  'clear': {
    description: 'Clear the scrollback history',
    run: (ctx) => {
      ctx.onClear();
      return { ok: true, message: '', cleared: true };
    },
  },
  'toggle-vim-mode': {
    description: 'Toggle vim keybindings on/off',
    run: (ctx) => {
      const next = !ctx.vimEnabled;
      ctx.setVimEnabled(next);
      return { ok: true, message: `Vim mode ${next ? 'enabled' : 'disabled'}` };
    },
  },
  'd': {
    description: 'List tables, or describe a table: \\d [table]',
    run: (ctx) => {
      if (!ctx.args.trim()) {
        ctx.onQuery(DB_QUERIES[ctx.driver].tables);
      } else {
        ctx.onQuery(describeBasicSql(ctx.driver, ctx.args.trim()));
      }
      return { ok: true, message: '' };
    },
  },
  'describe': {
    description: 'Describe a table with constraints: /describe <table>',
    run: (ctx) => {
      const table = ctx.args.trim();
      if (!table) return { ok: false, message: 'Usage: /describe <table>' };
      ctx.onQuery(describeFullSql(ctx.driver, table));
      return { ok: true, message: '' };
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
  'export': {
    description: 'Export last result to a file: /export csv or /export json',
    run: (ctx) => {
      const fmt = ctx.args.trim().toLowerCase();
      if (fmt !== 'csv' && fmt !== 'json') {
        return { ok: false, message: 'Usage: /export csv  or  /export json' };
      }
      ctx.onExport(fmt as 'csv' | 'json');
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
  'save': {
    description: 'Save last query as an alias: /save <name>',
    run: (ctx) => {
      const name = ctx.args.trim();
      if (!name) return { ok: false, message: 'Usage: /save <name>' };
      if (!ctx.lastSqlQuery) return { ok: false, message: 'No query to save — run a SQL query first.' };
      if (/\s/.test(name)) return { ok: false, message: 'Alias name must not contain spaces.' };
      ctx.onSaveAlias(name, ctx.lastSqlQuery);
      return { ok: true, message: `Saved /${name}` };
    },
  },
  'alias': {
    description: 'Define an alias inline: /alias <name> <SQL>',
    run: (ctx) => {
      const [name, ...rest] = ctx.args.trim().split(/\s+/);
      if (!name || rest.length === 0) return { ok: false, message: 'Usage: /alias <name> <SQL>' };
      if (/\s/.test(name)) return { ok: false, message: 'Alias name must not contain spaces.' };
      ctx.onSaveAlias(name, rest.join(' '));
      return { ok: true, message: `Saved /${name}` };
    },
  },
  'aliases': {
    description: 'List all saved aliases for this database',
    run: (ctx) => {
      const entries = Object.entries(ctx.aliases);
      if (entries.length === 0) return { ok: true, message: 'No aliases saved. Use /save <name> or /alias <name> <SQL>.' };
      const maxLen = Math.max(...entries.map(([n]) => n.length));
      const lines = entries.map(([n, sql], i) =>
        `${i === 0 ? '·' : '  ·'} /${n.padEnd(maxLen)}  →  ${sql}`
      );
      return { ok: true, message: lines.join('\n') };
    },
  },
  'unalias': {
    description: 'Remove a saved alias: /unalias <name>',
    run: (ctx) => {
      const name = ctx.args.trim();
      if (!name) return { ok: false, message: 'Usage: /unalias <name>' };
      const removed = ctx.onDeleteAlias(name);
      return removed
        ? { ok: true, message: `Removed /${name}` }
        : { ok: false, message: `No alias named /${name}` };
    },
  },
};

export const BUILTIN_COMMAND_LIST = Object.entries(COMMANDS).map(([name, cmd]) => ({
  name,
  description: cmd.description,
}));

export function getCompletions(partial: string, aliases: Record<string, string> = {}): string[] {
  if (partial.length === 0) return BUILTIN_COMMAND_LIST.map((c) => c.name);
  const tokenLower = partial.toLowerCase();
  const candidates = [
    ...BUILTIN_COMMAND_LIST.map((c) => c.name),
    ...Object.keys(aliases).filter((n) => !COMMANDS[n]),
  ];
  return candidates
    .map((n) => ({ n, score: fuzzyScore(tokenLower, n.toLowerCase()) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ n }) => n);
}

export function runCommand(input: string, ctx: Omit<CommandContext, 'args'>): CommandResult {
  const trimmed = input.slice(1).trim();
  const spaceIdx = trimmed.indexOf(' ');
  const rawName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);

  const name = PSQL_ALIASES[rawName ?? ''] ?? rawName ?? '';
  const cmd = COMMANDS[name];
  const prefix = input.startsWith('\\') ? '\\' : '/';

  if (cmd) return cmd.run({ ...ctx, args });

  // Fall through to user aliases
  const template = ctx.aliases[rawName];
  if (template) {
    const expanded = expandAlias(template, args);
    ctx.onQuery(expanded);
    return { ok: true, message: '' };
  }

  return { ok: false, message: `Unknown command: ${prefix}${rawName}` };
}
