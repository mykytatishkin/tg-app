import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const host = process.env.DB_HOST ?? 'localhost';
  const port = parseInt(process.env.DB_PORT ?? '5432', 10);
  const database = process.env.DB_NAME ?? 'tgapp';
  const synchronize = process.env.NODE_ENV !== 'production';
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6fe093b8-22a7-43f9-b1c3-8380735d7087', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'database.config.ts:getDatabaseConfig', message: 'App DB config (where TypeORM connects)', data: { host, port, database, synchronize, NODE_ENV: process.env.NODE_ENV }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1-H2-H4-H5' }) }).catch(() => {});
  // #endregion
  return {
    type: 'postgres',
    host,
    port,
    username: process.env.DB_USER ?? 'tgapp',
    password: process.env.DB_PASSWORD ?? 'tgapp_secret',
    database,
    autoLoadEntities: true,
    synchronize,
    logging: process.env.NODE_ENV === 'development',
  };
};
