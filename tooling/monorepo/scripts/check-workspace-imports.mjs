import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const DEFAULT_ROOTS = ["apps", "packages", "tooling"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const IGNORED_DIRS = new Set([
  ".cache",
  ".git",
  ".next",
  ".turbo",
  "build",
  "dist",
  "node_modules",
]);

const FORBIDDEN_EDGES = new Map([
  ["@norish/auth", new Set(["@norish/trpc", "@norish/queue"])],
  ["@norish/config", new Set(["@norish/db", "@norish/auth", "@norish/queue", "@norish/trpc"])],
  ["@norish/db", new Set(["@norish/auth", "@norish/queue", "@norish/trpc"])],
  ["@norish/db-schema", new Set(["@norish/db", "@norish/auth", "@norish/queue", "@norish/trpc"])],
  ["@norish/queue", new Set(["@norish/trpc"])],
  ["@norish/shared", new Set(["@norish/auth", "@norish/db", "@norish/queue", "@norish/trpc"])],
]);

/**
 * Where a workspace's runtime imports are held to its `dependencies`: the
 * image installs no devDependencies, so a value import of one breaks only in
 * production, and only on its code path. Next bundles everything in apps/web
 * but its custom server at build time, so only `server/` is held to it there.
 */
const RUNTIME_ROOTS = new Map([["@norish/web", "server"]]);
/** Workspaces bundled whole by their framework; nothing of theirs runs from node_modules. */
const BUNDLED_WORKSPACES = new Set(["@norish/landing"]);
const BUILTINS = new Set(builtinModules);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listPackageDirs(rootDir) {
  const dirs = [];

  for (const root of DEFAULT_ROOTS) {
    const absoluteRoot = join(rootDir, root);

    if (!existsSync(absoluteRoot)) continue;

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      const candidate = join(absoluteRoot, entry.name);

      if (entry.isDirectory() && existsSync(join(candidate, "package.json"))) {
        dirs.push(candidate);
      }
    }
  }

  return dirs;
}

function packageNameFromImport(specifier) {
  const match = specifier.match(/^(@norish\/[^/"']+)/);

  return match?.[1] ?? null;
}

function declaredWorkspaceDeps(manifest) {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
}

function walkSourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      walkSourceFiles(path, files);
      continue;
    }

    const dotIndex = entry.name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? entry.name.slice(dotIndex) : "";

    if (SOURCE_EXTENSIONS.has(extension)) {
      files.push(path);
    }
  }

  return files;
}

function collectImports(file) {
  const source = readFileSync(file, "utf8");
  const imports = new Set();
  const importPattern =
    /(?:import\s+(?:type\s+)?[\s\S]*?\s+from\s+["']|export\s+(?:type\s+)?[\s\S]*?\s+from\s+["']|import\s*\(\s*["'])(@norish\/[^"']+)/g;

  for (const match of source.matchAll(importPattern)) {
    const packageName = packageNameFromImport(match[1]);

    if (packageName) imports.add(packageName);
  }

  return imports;
}

/** Tests and config files run at build or test time only, where devDependencies are installed. */
function isBuildTimeFile(file) {
  const name = file.split(sep).at(-1);

  return (
    file.split(sep).includes("__tests__") ||
    /\.(test|spec)\.[cm]?tsx?$/.test(name) ||
    /\.config\.[cm]?tsx?$/.test(name) ||
    name.endsWith(".d.ts")
  );
}

/** The package a bare specifier names, or null for a relative, aliased or built-in one. */
function packageOf(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@/") || specifier.startsWith("~/")) return null;
  if (specifier.startsWith("node:") || BUILTINS.has(specifier.split("/")[0])) return null;

  const parts = specifier.split("/");

  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function isTypeOnlyClause(clause) {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;

  const bindings = clause.namedBindings;

  return (
    !clause.name &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

function isTypeOnlyExport(node) {
  if (node.isTypeOnly) return true;

  const clause = node.exportClause;

  return (
    clause !== undefined &&
    ts.isNamedExports(clause) &&
    clause.elements.length > 0 &&
    clause.elements.every((element) => element.isTypeOnly)
  );
}

/** The packages a file imports a value from (or imports for its side effects). */
function collectValueImports(file) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
  const packages = new Set();
  const add = (specifier) => {
    const name = packageOf(specifier);

    if (name) packages.add(name);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyClause(node.importClause)) add(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier) && !isTypeOnlyExport(node)) {
        add(node.moduleSpecifier.text);
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);

  return packages;
}

/** Runtime imports of a package the workspace lists only as a devDependency, or not at all. */
function checkRuntimeDependencies(rootDir, packageDir, manifest) {
  if (BUNDLED_WORKSPACES.has(manifest.name)) return [];

  const runtime = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  const devOnly = new Set(Object.keys(manifest.devDependencies ?? {}));
  const runtimeRoot = RUNTIME_ROOTS.get(manifest.name);
  const sourceRoot = runtimeRoot
    ? join(packageDir, runtimeRoot)
    : existsSync(join(packageDir, "src"))
      ? join(packageDir, "src")
      : packageDir;
  const issues = [];

  if (!existsSync(sourceRoot)) return issues;

  for (const file of walkSourceFiles(sourceRoot)) {
    if (isBuildTimeFile(relative(packageDir, file))) continue;

    for (const imported of collectValueImports(file)) {
      if (imported === manifest.name || runtime.has(imported)) continue;

      const location = relative(rootDir, file);

      issues.push(
        devOnly.has(imported)
          ? `${location}: imports ${imported} at run time, but lists it only as a devDependency`
          : `${location}: imports ${imported}, which its package.json does not list`
      );
    }
  }

  return issues;
}

function checkPackage(rootDir, packageDir, workspacePackages) {
  const manifestPath = join(packageDir, "package.json");
  const manifest = readJson(manifestPath);
  const packageName = manifest.name;
  const declaredDeps = declaredWorkspaceDeps(manifest);
  const forbiddenDeps = FORBIDDEN_EDGES.get(packageName) ?? new Set();
  const issues = [];
  const sourceRoot = join(packageDir, "src");
  const searchRoot = existsSync(sourceRoot) ? sourceRoot : packageDir;

  for (const file of walkSourceFiles(searchRoot)) {
    for (const importedPackage of collectImports(file)) {
      if (importedPackage === packageName) continue;
      if (!workspacePackages.has(importedPackage)) continue;

      const location = relative(rootDir, file);

      if (!declaredDeps.has(importedPackage)) {
        issues.push(`${location}: imports undeclared workspace package ${importedPackage}`);
      }

      if (forbiddenDeps.has(importedPackage)) {
        issues.push(`${location}: forbidden dependency ${packageName} -> ${importedPackage}`);
      }
    }
  }

  return [...issues, ...checkRuntimeDependencies(rootDir, packageDir, manifest)];
}

/** The directories pnpm-workspace.yaml leaves out of the workspace, such as `apps/docs`. */
function excludedWorkspaceDirs(rootDir) {
  const manifest = readFileSync(join(rootDir, "pnpm-workspace.yaml"), "utf8");

  return new Set(
    [...manifest.matchAll(/^\s*-\s*["']?!([^"'\s]+)["']?\s*$/gm)].map((match) =>
      resolve(rootDir, match[1])
    )
  );
}

export function runWorkspaceImportCheck({ cwd = process.cwd(), logger = console } = {}) {
  const rootDir = resolve(cwd);
  const excluded = excludedWorkspaceDirs(rootDir);
  const packageDirs = listPackageDirs(rootDir).filter(
    (dir) => statSync(dir).isDirectory() && !excluded.has(dir)
  );
  const workspacePackages = new Set(
    packageDirs.map((dir) => readJson(join(dir, "package.json")).name)
  );
  const issues = packageDirs.flatMap((dir) => checkPackage(rootDir, dir, workspacePackages));

  if (issues.length > 0) {
    logger.error(`Found ${issues.length} workspace import issue${issues.length === 1 ? "" : "s"}.`);
    for (const issue of issues) {
      logger.error(`- ${issue}`);
    }

    return 1;
  }

  logger.log("No workspace import issues found.");
  return 0;
}

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath === scriptPath) {
  process.exit(runWorkspaceImportCheck());
}
