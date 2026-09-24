import { execFileSync } from 'node:child_process';

const LIMIT = 100;
const args = process.argv.slice(2);
const range = args.find((arg) => arg !== '--staged' && !arg.startsWith('-'));
const useStaged = args.includes('--staged') || !range;

function git(gitArgs) {
  return execFileSync('git', gitArgs, { encoding: 'utf8' });
}

function parseNumstat(output) {
  let added = 0;
  let removed = 0;
  const binaries = [];

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const plus = parts[0];
    const minus = parts[1];
    const file = parts.slice(2).join('\t');
    if (plus === '-' || minus === '-') {
      binaries.push(file);
      continue;
    }
    added += Number(plus);
    removed += Number(minus);
  }

  return { added, removed, binaries, loc: added + removed };
}

function commitsInRange(revRange) {
  if (revRange.includes('..')) {
    return git(['rev-list', revRange]).trim().split('\n').filter(Boolean);
  }
  return git(['rev-list', '--root', revRange]).trim().split('\n').filter(Boolean);
}

function numstatForCommit(sha) {
  const parents = git(['rev-list', '--parents', '-n', '1', sha])
    .trim()
    .split(' ')
    .slice(1);
  if (parents.length === 0) {
    return git([
      'diff-tree',
      '--no-commit-id',
      '--numstat',
      '--root',
      '-r',
      sha,
    ]);
  }
  return git(['diff', '--numstat', `${parents[0]}...${sha}`]);
}

if (useStaged) {
  const stats = parseNumstat(git(['diff', '--cached', '--numstat']));
  if (stats.binaries.length > 0) {
    console.error('Arquivos binarios nao mensuraveis:', stats.binaries.join(', '));
  }
  console.log(`LOC staged: ${stats.loc} (add ${stats.added} + del ${stats.removed})`);
  if (stats.loc > LIMIT) {
    console.error(`Acima do teto de ${LIMIT} LOC. Justifique com LOC-Exception.`);
    process.exit(1);
  }
  process.exit(0);
}

let failed = false;
for (const sha of commitsInRange(range)) {
  const stats = parseNumstat(numstatForCommit(sha));
  const subject = git(['log', '-1', '--format=%s', sha]).trim();
  const body = git(['log', '-1', '--format=%b', sha]);
  const hasException = body.includes('LOC-Exception:');
  console.log(`${sha.slice(0, 7)} ${stats.loc} LOC ${subject}`);
  if (stats.loc > LIMIT && !hasException) {
    console.error(`  sem LOC-Exception e acima de ${LIMIT}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
