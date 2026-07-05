import fs from 'node:fs';
import path from 'node:path';

export function createRunLog(rootDir, label) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(rootDir, 'runs', `${stamp}-${label}`);
  fs.mkdirSync(dir, { recursive: true });
  const logPath = path.join(dir, 'run.log');

  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try { fs.appendFileSync(logPath, line + '\n'); } catch {}
  };

  let shotN = 0;
  const shot = async (page, name) => {
    try {
      const file = path.join(dir, `${String(++shotN).padStart(3, '0')}-${name}.png`);
      await page.screenshot({ path: file });
      log(`screenshot: ${path.basename(file)}`);
    } catch (e) {
      log(`screenshot failed (${name}): ${e.message}`);
    }
  };

  return { dir, log, shot };
}
