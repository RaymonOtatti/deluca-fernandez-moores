// Serves dist/ on a private port, runs tests/e2e against it, then stops the server.
import { spawn } from 'node:child_process';
import { serve } from './serve.mjs';

const PORT = 4323;
const server = await serve(PORT);
const run = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', '--test', 'tests/e2e/*.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_URL: `http://127.0.0.1:${PORT}/` },
});
run.on('exit', (code) => { server.close(); process.exit(code ?? 1); });
