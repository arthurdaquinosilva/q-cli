import { exec } from 'node:child_process';

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

export function runShell(command: string): Promise<ShellResult> {
  return new Promise((resolve) => {
    exec(command, { shell: process.env.SHELL ?? '/bin/sh', timeout: 30_000 }, (err, stdout, stderr) => {
      resolve({
        stdout: trimLines(stripAnsi(stdout).trimEnd()),
        stderr: trimLines(stripAnsi(stderr).trimEnd()),
        exitCode: err?.code ?? 0,
      });
    });
  });
}
