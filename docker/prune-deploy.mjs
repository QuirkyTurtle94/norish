// Removes the store folders of a `pnpm deploy` that nothing at run time can
// load. The walk starts at the deploy's top-level links and follows each
// package's dependencies, optional dependencies and required peers. It never
// follows an optional peer: pnpm fills one whenever the workspace has it
// (Playwright for Next, drizzle-kit for Better Auth), but the package runs
// without it. A folder removed before the walk counts as absent, so its own
// dependencies go with it unless something else reaches them.
// Usage: node prune-deploy.mjs <deploy>/node_modules
import { existsSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join, sep } from "node:path";

const root = process.argv[2];
const store = join(root, ".pnpm");
const reached = new Set();
const queue = [];

function visit(link) {
  if (!existsSync(link)) return;
  const dir = realpathSync(link);

  if (!dir.startsWith(store + sep) || reached.has(dir)) return;
  reached.add(dir);
  queue.push(dir);
}

for (const entry of readdirSync(root)) {
  if (entry.startsWith(".")) continue;
  const names = entry.startsWith("@")
    ? readdirSync(join(root, entry)).map((n) => `${entry}/${n}`)
    : [entry];

  for (const name of names) visit(join(root, name));
}

while (queue.length > 0) {
  const dir = queue.shift();
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const optionalPeers = Object.entries(manifest.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta.optional)
    .map(([name]) => name);
  const names = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}).filter((name) => !optionalPeers.includes(name)),
  ];
  // A package's dependencies are linked beside it in its store folder.
  const siblings = dir.slice(
    0,
    dir.lastIndexOf(`${sep}node_modules${sep}`) + "/node_modules".length
  );

  for (const name of names) visit(join(siblings, name));
}

const kept = new Set([...reached].map((dir) => dir.slice(store.length + 1).split(sep)[0]));
const removed = readdirSync(store).filter(
  (folder) => folder !== "node_modules" && folder !== "lock.yaml" && !kept.has(folder)
);

for (const folder of removed) rmSync(join(store, folder), { recursive: true, force: true });
console.log(`prune-deploy: removed ${removed.length} store folders: ${removed.join(" ")}`);
