import type { DbClient, DbResult } from './client.js';

export type QueryState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'success'; result: DbResult }
  | { status: 'error'; message: string };

export async function runQuery(client: DbClient, sql: string): Promise<QueryState> {
  try {
    const result = await client.query(sql);
    return { status: 'success', result };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
