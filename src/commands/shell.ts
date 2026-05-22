import { exec } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Strip cursor-movement and screen-control codes but preserve SGR color codes (m).
// Programs won't produce colors if stdout isn't a TTY, so we set CLICOLOR_FORCE
// and COLORTERM in the exec env to hint them to use colors anyway.
const ANSI_CONTROL_RE = /\x1B\[(?:[0-9;]*[GKHJFST]|[?][0-9;]*[hl])/g;
const stripControl = (s: string) => s.replace(ANSI_CONTROL_RE, '').replace(/\r/g, '');

const MAX_LINES = 200;

function trimLines(s: string): string {
  const lines = s.split('\n');
  if (lines.length <= MAX_LINES) return s;
  return lines.slice(0, MAX_LINES).join('\n') + `\n… (truncated, ${lines.length - MAX_LINES} more lines)`;
}

// `history` is an interactive-shell builtin (fc -l in zsh) that doesn't work
// in non-interactive exec subshells. Read the history file directly instead.
function readHistory(countArg: string): ShellResult {
  const shell = process.env.SHELL ?? '/bin/sh';
  const histFile =
    process.env.HISTFILE ??
    (shell.endsWith('zsh') ? join(homedir(), '.zsh_history') : join(homedir(), '.bash_history'));

  let raw: string;
  try {
    raw = readFileSync(histFile, 'utf8');
  } catch {
    return { stdout: '', stderr: `history: cannot read ${histFile}`, exitCode: 1 };
  }

  // zsh extended history: ": timestamp:elapsed;command"
  // bash / plain zsh: "command"
  const commands = raw
    .split('\n')
    .map((line) => line.replace(/^: \d+:\d+;/, ''))
    .filter(Boolean);

  const count = countArg ? parseInt(countArg, 10) : NaN;
  const visible = Number.isFinite(count) && count > 0 ? commands.slice(-count) : commands;
  const offset = commands.length - visible.length + 1;
  const output = visible.map((cmd, i) => `${String(offset + i).padStart(5)}  ${cmd}`).join('\n');
  return { stdout: output || '(no history)', stderr: '', exitCode: 0 };
}

export function runShell(command: string): Promise<ShellResult> {
  const trimmed = command.trim();

  // Match "history [N]" at the start of any command (standalone or piped/chained).
  // history | grep … → replace with "cat <tmpfile> | grep …" so pipelines work.
  const historyMatch = trimmed.match(/^history(?:\s+(\d+))?(\s.*)?$/);
  if (historyMatch) {
    const countStr = historyMatch[1] ?? '';
    const rest = (historyMatch[2] ?? '').trimStart();
    const histResult = readHistory(countStr);
    if (histResult.exitCode !== 0 || !rest) return Promise.resolve(histResult);

    // Write history to a temp file so the shell can pipe/redirect it naturally.
    const tmpPath = join(tmpdir(), `querky-hist-${Date.now()}.txt`);
    writeFileSync(tmpPath, histResult.stdout);
    const piped = `cat '${tmpPath}' ${rest}`;
    const shell = process.env.SHELL ?? '/bin/sh';
    const env = { ...process.env, CLICOLOR_FORCE: '1', COLORTERM: 'truecolor', FORCE_COLOR: '3' };
    return new Promise((resolve) => {
      exec(piped, { shell, timeout: 30_000, env }, (err, stdout, stderr) => {
        try { unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
        resolve({
          stdout: trimLines(stripControl(stdout).trimEnd()),
          stderr: trimLines(stripControl(stderr).trimEnd()),
          exitCode: err?.code ?? 0,
        });
      });
    });
  }

  const shell = process.env.SHELL ?? '/bin/sh';
  const env = {
    ...process.env,
    CLICOLOR_FORCE: '1',   // BSD + newer GNU coreutils: force color even without TTY
    COLORTERM: 'truecolor', // hint: terminal supports 24-bit color
    FORCE_COLOR: '3',       // Node.js / chalk-based CLIs
  };
  return new Promise((resolve) => {
    exec(command, { shell, timeout: 30_000, env }, (err, stdout, stderr) => {
      resolve({
        stdout: trimLines(stripControl(stdout).trimEnd()),
        stderr: trimLines(stripControl(stderr).trimEnd()),
        exitCode: err?.code ?? 0,
      });
    });
  });
}
