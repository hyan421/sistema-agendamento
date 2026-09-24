import { closeDatabase, verifyDatabaseConnection } from './db/pool.js';

async function main(): Promise<void> {
  await verifyDatabaseConnection();
  console.log('Navalha & Hora API: banco conectado.');
}

async function shutdown(signal: string): Promise<void> {
  console.log(`Recebido ${signal}; encerrando conexao com o banco.`);
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
