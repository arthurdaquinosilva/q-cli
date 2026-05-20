export interface CommandResult {
  ok: boolean;
  message: string;
}

export interface CommandContext {
  vimEnabled: boolean;
  setVimEnabled: (enabled: boolean) => void;
  lastSqlQuery: string;
  onExplain: (query: string) => void;
  onQuery: (sql: string) => void;
}

interface Command {
  description: string;
  run: (ctx: CommandContext) => CommandResult;
}

const PG_DATABASES = `SELECT datname AS database FROM pg_database WHERE datistemplate = false ORDER BY datname`;
const PG_TABLES = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;

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
      ctx.onQuery(PG_DATABASES);
      return { ok: true, message: '' };
    },
  },
  'tables': {
    description: 'List tables in the current database',
    run: (ctx) => {
      ctx.onQuery(PG_TABLES);
      return { ok: true, message: '' };
    },
  },
  'explain': {
    description: 'Explain the last query using AI',
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

export function runCommand(input: string, ctx: CommandContext): CommandResult {
  const [name] = input.slice(1).trim().split(/\s+/);
  const cmd = COMMANDS[name ?? ''];
  if (!cmd) return { ok: false, message: `Unknown command: /${name}` };
  return cmd.run(ctx);
}
