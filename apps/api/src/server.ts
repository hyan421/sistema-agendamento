import { env } from './config/env.js';
import { closeDatabase, verifyDatabaseConnection } from './db/pool.js';
import app from './app.js';

let server: ReturnType<typeof app.listen> | undefined;

async function main(): Promise<void> {
  await verifyDatabaseConnection();
  server = app.listen(env.port, '127.0.0.1', () => {
    console.log(`Navalha & Hora API ouvindo em http://127.0.0.1:${env.port}.`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`Recebido ${signal}; encerrando a API e a conexao com o banco.`);
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await closeDatabase();
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

main().catch((error: unknown) => {
  console.error('Falha ao conectar ao banco de dados.', error);
  process.exitCode = 1;
});
