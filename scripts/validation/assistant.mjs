import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createEnvironment } from './environment.mjs';

const context = await createEnvironment();
let unavailable = false;
const stub = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const input = JSON.parse(body);
    assert.equal(input.stream, false);
    assert.equal(input.model, 'validation-only');
    assert.equal(req.url, '/api/chat');
    assert.ok(!body.includes('@demo.test'));
    res.writeHead(unavailable ? 503 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: { content: 'Resposta controlada para validar o adaptador.' } }));
  });
});
try {
  stub.listen(0, '127.0.0.1');
  await once(stub, 'listening');
  const address = stub.address();
  const env = { ...context.env, AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'validation-only',
    OLLAMA_BASE_URL: `http://127.0.0.1:${address.port}` };
  async function run() {
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      "const {answer}=await import('./apps/api/dist/modules/assistant/service.js'); const {closeDatabase}=await import('./apps/api/dist/db/pool.js'); console.log(JSON.stringify(await answer({message:'Qual o preco?',history:[]}))); await closeDatabase();"], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    const [code] = await once(child, 'exit');
    assert.equal(code, 0);
    return JSON.parse(output);
  }
  const normal = await run();
  assert.equal(normal.mode, 'ollama');
  assert.ok(normal.text.includes('Resposta controlada'));
  unavailable = true;
  const failed = await run();
  assert.equal(failed.mode, 'fallback');
  assert.ok(failed.text.includes('Modelo indisponível'));
  console.log('OK: protocolo Ollama e fallback em falha validados com adaptador controlado, sem modelo real.');
} finally {
  await new Promise((resolve) => stub.close(resolve));
  await context.cleanup();
}
