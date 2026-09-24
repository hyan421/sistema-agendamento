import { execFileSync } from 'node:child_process';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

const range = process.argv[2];
const logArgs = ['shortlog', '-sne', '--all'];
if (range) {
  logArgs.push(range);
}

const output = git(logArgs).trim();
if (!output) {
  console.log('Nenhum commit encontrado.');
  process.exit(0);
}

const rows = output.split('\n').map((line) => {
  const match = line.trim().match(/^(\d+)\s+(.+)$/);
  if (!match) return null;
  return { count: Number(match[1]), author: match[2] };
}).filter(Boolean);

const total = rows.reduce((sum, row) => sum + row.count, 0);
console.log(`Total de commits considerados: ${total}`);
for (const row of rows) {
  const pct = ((row.count / total) * 100).toFixed(1);
  console.log(`${pct.padStart(6)}%  ${String(row.count).padStart(4)}  ${row.author}`);
}
