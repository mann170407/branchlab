// Publishes the single-file build (dist/index.html) to the gh-pages branch of this
// repository's "origin" remote, which GitHub Pages serves at
// https://<user>.github.io/<repository>/. Run with: npm run deploy
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, 'dist', 'index.html');
if (!existsSync(built)) {
  console.error('deploy: dist/index.html is missing. Run "npm run build" first.');
  process.exit(1);
}

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const remote = git(['remote', 'get-url', 'origin'], root);

const out = join(root, '.deploy');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
copyFileSync(built, join(out, 'index.html'));
writeFileSync(join(out, '.nojekyll'), ''); // serve the file as-is

git(['init', '-q', '-b', 'gh-pages'], out);
git(['add', '-A'], out);
git(['commit', '-q', '-m', 'Deploy BranchLab'], out);
execFileSync('git', ['push', '--force', remote, 'gh-pages'], { cwd: out, stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });

const match = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
console.log(match ? `deploy: published to https://${match[1].toLowerCase()}.github.io/${match[2]}/` : 'deploy: pushed gh-pages');
