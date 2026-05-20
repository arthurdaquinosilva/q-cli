export interface CommandResult {
  ok: boolean;
  message: string;
}

export interface CommandContext {
  vimEnabled: boolean;
  setVimEnabled: (enabled: boolean) => void;
}

interface Command {
  description: string;
  run: (ctx: CommandContext) => CommandResult;
}

const COMMANDS: Record<string, Command> = {
  'toggle-vim-mode': {
    description: 'Toggle vim keybindings on/off',
    run: (ctx) => {
      const next = !ctx.vimEnabled;
      ctx.setVimEnabled(next);
      return { ok: true, message: `Vim mode ${next ? 'enabled' : 'disabled'}` };
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
