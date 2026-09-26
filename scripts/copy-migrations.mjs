import { cp, mkdir } from 'node:fs/promises';

const source = new URL('../apps/api/src/db/migrations/', import.meta.url);
const target = new URL('../apps/api/dist/db/migrations/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
