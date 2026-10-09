import { escapePath } from 'tinyglobby';
import path from 'node:path';
import { findFiles } from '../fs/findFiles.js';
import { readTextFile } from '../fs/readTextFile.js';
import { readJsonFile } from '../fs/writeFileSafe.js';
import { findInRepo } from './ecosystems.js';

/**
 * Line-based readers for project files the audit inspects. They recognize
 * the common layouts of each format; they are not full parsers.
 */

/**
 * Map each TOML table header (`[a.b]` or `[[a.b]]`) to the keys set in it.
 * Keys before the first header belong to the table named `''`.
 */
export function tomlTables(content: string): Map<string, string[]> {
  const tables = new Map<string, string[]>([['', []]]);
  let current = '';
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const header = /^\[\[?([^\]]*)\]\]?$/.exec(line);
    if (header) {
      current = header[1]
        .trim()
        .replace(/["']/g, '')
        .split('.')
        .map((part) => part.trim())
        .join('.');
      if (!tables.has(current)) tables.set(current, []);
      continue;
    }
    const key = /^("[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)\s*=/.exec(line);
    if (key) tables.get(current)?.push(key[1].replace(/["']/g, ''));
  }
  return tables;
}

/** True when a table equal to `name`, or nested under it, exists. */
export function hasTomlTable(
  tables: Map<string, string[]>,
  name: string,
): boolean {
  for (const table of tables.keys()) {
    if (table === name || table.startsWith(`${name}.`)) return true;
  }
  return false;
}

/** INI section names (`[name]`), as used by setup.cfg, tox.ini, and pytest.ini. */
export function iniSections(content: string): string[] {
  const sections: string[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const match = /^\s*\[([^\]]+)\]\s*$/.exec(raw);
    if (match) sections.push(match[1].trim());
  }
  return sections;
}

/** Explicit target names in a Makefile. Pattern rules and special targets are skipped. */
export function makefileTargets(content: string): string[] {
  const targets: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('\t') || line.trimStart().startsWith('#')) continue;
    const match = /^([^\s:=#][^:=#]*)::?(?!=)/.exec(line);
    if (!match) continue;
    for (const name of match[1].trim().split(/[ \t]+/)) {
      if (/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(name)) targets.push(name);
    }
  }
  return unique(targets);
}

const JUST_KEYWORDS = new Set(['set', 'alias', 'export', 'import', 'mod']);

/** Recipe names in a justfile. */
export function justfileRecipes(content: string): string[] {
  const recipes: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = /^@?([A-Za-z_][A-Za-z0-9_-]*)(?:\s[^:]*)?:(?!=)/.exec(line);
    if (match && !JUST_KEYWORDS.has(match[1])) recipes.push(match[1]);
  }
  return unique(recipes);
}

/** Task names under the top-level `tasks:` key of a Taskfile. */
export function taskfileTasks(content: string): string[] {
  const tasks: string[] = [];
  let inTasks = false;
  let indent: number | null = null;
  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (/^tasks:\s*$/.test(line)) {
      inTasks = true;
      continue;
    }
    if (!inTasks) continue;
    const lead = line.length - line.trimStart().length;
    if (lead === 0) break;
    indent ??= lead;
    if (lead !== indent) continue;
    const match = /^\s+["']?([A-Za-z0-9_:.-]+)["']?:/.exec(line);
    if (match) tasks.push(match[1]);
  }
  return unique(tasks);
}

/** Task names from poe, pdm, hatch, and taskipy tables in pyproject.toml. */
export function pyprojectTasks(tables: Map<string, string[]>): string[] {
  const tasks: string[] = [];
  for (const [table, keys] of tables) {
    if (
      table === 'tool.poe.tasks' ||
      table === 'tool.pdm.scripts' ||
      table === 'tool.taskipy.tasks' ||
      /^tool\.hatch\.envs\.[^.]+\.scripts$/.test(table)
    ) {
      tasks.push(...keys.map((k) => k.split('.')[0]));
    }
    const nested = /^tool\.(?:poe\.tasks|pdm\.scripts)\.([^.]+)$/.exec(table);
    if (nested) tasks.push(nested[1]);
  }
  return unique(tasks.filter((t) => t !== '_' && !t.startsWith('_')));
}

/** tox environments: the default `[testenv]` runs tests; `[testenv:x]` adds `x`. */
export function toxEnvironments(content: string): string[] {
  const envs: string[] = [];
  for (const section of iniSections(content)) {
    if (section === 'testenv') envs.push('test');
    const named = /^testenv:(.+)$/.exec(section);
    if (named) envs.push(named[1].trim());
  }
  return unique(envs);
}

/** Session names decorated with `@nox.session` in a noxfile. */
export function noxSessions(content: string): string[] {
  const sessions: string[] = [];
  let pending = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('@nox.session')) {
      pending = true;
    } else if (pending && line.startsWith('@')) {
      continue;
    } else if (pending) {
      const def = /^def[ \t]+(\w+)[ \t]*\(/.exec(line);
      if (def) sessions.push(def[1]);
      pending = false;
    }
  }
  return unique(sessions);
}

export type TaskSource = {
  /** File the commands come from, e.g. `Makefile` or `package.json`. */
  source: string;
  names: string[];
};

type PackageJson = { scripts?: Record<string, unknown> };

const TASK_NAME = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

/** Upper bound on nested package.json files read when there is no root one. */
const MAX_NESTED_PACKAGE_FILES = 20;

/** Bounds on the automation files read for tool invocations. */
const MAX_AUTOMATION_FILES = 100;
const MAX_AUTOMATION_BYTES = 4 * 1024 * 1024;

/** True for a package.json task source, at the root or nested. */
export function isPackageJsonSource(source: string): boolean {
  return source === 'package.json' || source.endsWith('/package.json');
}

/**
 * Commands defined at the repository root, per task runner. `package.json`
 * comes first so Node.js repositories report the same way as before.
 *
 * When there is no root `package.json`, the scripts of nested ones (such as
 * `frontend/package.json` beside a Python API) are read instead, listed under
 * their own path.
 */
export async function readTaskSources(
  repoPath: string,
  nodeManifests: readonly string[] = [],
): Promise<TaskSource[]> {
  const sources: TaskSource[] = [];
  const add = (source: string, names: string[]) => {
    // Names from file contents can reach report messages; keep plain ones.
    const safe = isPackageJsonSource(source)
      ? names
      : names.filter((n) => TASK_NAME.test(n));
    if (safe.length > 0) sources.push({ source, names: safe });
  };

  const rootPkg = await readRoot(repoPath, 'package.json');
  const packageFiles =
    rootPkg !== null
      ? ['package.json']
      : nodeManifests
          .filter((m) => m.endsWith('/package.json'))
          .slice(0, MAX_NESTED_PACKAGE_FILES);
  for (const rel of packageFiles) {
    const pkg =
      rel === 'package.json'
        ? parseJson<PackageJson>(rootPkg)
        : await readJsonFile<PackageJson>(path.join(repoPath, rel));
    const scripts = pkg?.scripts;
    if (scripts && typeof scripts === 'object' && !Array.isArray(scripts)) {
      add(
        rel,
        Object.keys(scripts).filter((k) => Boolean(scripts[k])),
      );
    }
  }

  for (const name of ['Makefile', 'makefile', 'GNUmakefile']) {
    const content = await readRoot(repoPath, name);
    if (content !== null) {
      add(name, makefileTargets(content));
      break;
    }
  }
  for (const name of ['justfile', 'Justfile', '.justfile']) {
    const content = await readRoot(repoPath, name);
    if (content !== null) {
      add(name, justfileRecipes(content));
      break;
    }
  }
  for (const name of [
    'Taskfile.yml',
    'Taskfile.yaml',
    'taskfile.yml',
    'taskfile.yaml',
  ]) {
    const content = await readRoot(repoPath, name);
    if (content !== null) {
      add(name, taskfileTasks(content));
      break;
    }
  }
  const pyproject = await readRoot(repoPath, 'pyproject.toml');
  if (pyproject !== null) {
    add('pyproject.toml', pyprojectTasks(tomlTables(pyproject)));
  }
  const tox = await readRoot(repoPath, 'tox.ini');
  if (tox !== null) add('tox.ini', toxEnvironments(tox));
  const nox = await readRoot(repoPath, 'noxfile.py');
  if (nox !== null) add('noxfile.py', noxSessions(nox));

  return sources;
}

/**
 * Concatenated text of files that run tools: task runners, pre-commit, CI
 * workflows, and tox/nox. Used to find tool invocations such as `gofmt` or
 * `cargo clippy` that need no config file of their own.
 */
export async function readAutomationText(repoPath: string): Promise<string> {
  const files = await findInRepo(repoPath, [
    'Makefile',
    'makefile',
    'GNUmakefile',
    'justfile',
    'Justfile',
    '.justfile',
    'Taskfile.{yml,yaml}',
    'taskfile.{yml,yaml}',
    '.pre-commit-config.{yml,yaml}',
    'lefthook.{yml,yaml}',
    '.github/workflows/*.{yml,yaml}',
    '.gitlab-ci.yml',
    'tox.ini',
    'noxfile.py',
    'pyproject.toml',
  ]);
  const parts: string[] = [];
  let bytes = 0;
  for (const rel of files.slice(0, MAX_AUTOMATION_FILES)) {
    const content = await readTextFile(path.join(repoPath, rel));
    if (content === null) continue;
    bytes += content.length;
    if (bytes > MAX_AUTOMATION_BYTES) break;
    parts.push(content);
  }
  return parts.join('\n');
}

/**
 * Read a file at the repository root. Goes through `findFiles`, so a symlink
 * is read only when it points at a regular file inside the repository.
 */
export async function readRoot(
  repoPath: string,
  rel: string,
): Promise<string | null> {
  const [file] = await findFiles(repoPath, escapePath(rel));
  return file ? readTextFile(file) : null;
}

/** Parse a JSON file at the repository root, read through `readRoot`. */
export async function readRootJson<T>(
  repoPath: string,
  rel: string,
): Promise<T | null> {
  return parseJson<T>(await readRoot(repoPath, rel));
}

function parseJson<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * True when `rel` is a regular file inside the repository. Unlike
 * `fileExists`, a symlink to a file outside the repository does not count.
 */
export async function repoFileExists(
  repoPath: string,
  rel: string,
): Promise<boolean> {
  return (await findFiles(repoPath, escapePath(rel))).length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
