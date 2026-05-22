import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const ANSI_RE = /\x1B\[[0-9;]*[mGKHFJKST]/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

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
  const historyMatch = trimmed.match(/^history(?:\s+(\d+))?$/);
  if (historyMatch) {
    return Promise.resolve(readHistory(historyMatch[1] ?? ''));
  }

  const shell = process.env.SHELL ?? '/bin/sh';
  return new Promise((resolve) => {
    exec(command, { shell, timeout: 30_000 }, (err, stdout, stderr) => {
      resolve({
        stdout: trimLines(stripAnsi(stdout).trimEnd()),
        stderr: trimLines(stripAnsi(stderr).trimEnd()),
        exitCode: err?.code ?? 0,
      });
    });
  });
}
