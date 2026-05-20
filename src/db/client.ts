import { Client } from 'pg';

export type ConnectionState =
  | { status: 'connected'; client: Client; database: string; host: string }
  | { status: 'error'; message: string };

export async function connect(dsn: string): Promise<ConnectionState> {
  const client = new Client({ connectionString: dsn });
  try {
    await client.connect();
    const res = await client.query<{ current_database: string }>(
      'SELECT current_database()',
    );
    return {
      status: 'connected',
      client,
      database: res.rows[0].current_database,
      host: client.host,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
