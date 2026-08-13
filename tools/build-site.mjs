// Assemble the deployable site. There is no bundler and nothing to compile --
// "building" here means copying the files a browser actually needs, so the
// published site does not carry the tests, the tooling, or the setting bible.
import { cp, mkdir, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, process.argv[2] ?? '_site');
const INCLUDE = ['index.html', 'src'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of INCLUDE) {
  await cp(join(ROOT, entry), join(OUT, entry), { recursive: true });
}

// Pages serves the artifact as-is, but .nojekyll costs nothing and removes a
// whole class of "why is my underscore directory missing" surprises.
await writeFile(join(OUT, '.nojekyll'), '');

const walk = async (dir) => {
  let files = 0;
  let bytes = 0;
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) {
      const sub = await walk(path);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += info.size;
    }
  }
  return { files, bytes };
};

const { files, bytes } = await walk(OUT);
console.log(`built ${OUT} — ${files} files, ${(bytes / 1024).toFixed(1)} kB`);
