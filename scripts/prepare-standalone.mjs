import { cp, mkdir, rm } from "node:fs/promises";
import { access, constants } from "node:fs";
import { promisify } from "node:util";

const canAccess = promisify(access);
const root = process.cwd();
const standalone = `${root}/.next/standalone`;

await canAccess(`${standalone}/server.js`, constants.R_OK).catch(() => {
  throw new Error("Standalone build не знайдено. Спочатку виконайте `pnpm build`.");
});

await mkdir(`${standalone}/.next/static`, { recursive: true });
await mkdir(`${standalone}/.next/cache`, { recursive: true });
await cp(`${root}/.next/static`, `${standalone}/.next/static`, { recursive: true });
await rm(`${standalone}/public`, { recursive: true, force: true });
await cp(`${root}/public`, `${standalone}/public`, { recursive: true });

console.log("Standalone bundle підготовлено до запуску через systemd.");
