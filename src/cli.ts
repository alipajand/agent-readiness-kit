#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import pc from 'picocolors';
import { auditRepo, auditCategory, ALL_CHECK_IDS } from './audit/auditRepo.js';
import { formatTerminalReport } from './report/terminalReport.js';
import { formatAuditJson } from './report/jsonReport.js';
import { formatMarkdownReport } from './report/markdownReport.js';
import { formatHtmlReport } from './report/htmlReport.js';
import { formatJunitReport } from './report/junitReport.js';
import { formatSarifReport } from './report/sarifReport.js';
import { formatBadgeSvg } from './report/badgeReport.js';
import { computeDiff, formatDiffReport } from './report/diffReport.js';
import { runInit } from './generate/initFiles.js';
import { generateCursor } from './generate/cursorFiles.js';
import { generateCodex } from './generate/codexFiles.js';
import { generateClaude } from './generate/claudeFiles.js';
import { generateCopilot } from './generate/copilotFiles.js';
import { generateGithub } from './generate/githubFiles.js';
import { generateVscode } from './generate/vscodeFiles.js';
import { fixRepo } from './generate/fixRepo.js';
import { appendHistory, loadHistory, getScoreDelta } from './audit/history.js';
import type { WriteResult, AuditJson } from './types.js';
import {
  loadArkrc,
  resolveAuditRunOptions,
  resolveInitOptions,
  resolveGenerateOptions,
} from './config/loadArkrc.js';
import { handleArkrcError } from './config/handleArkrcError.js';

function resolveRepo(cwd?: string): string {
  return path.resolve(cwd ?? process.cwd());
}

async function loadArkrcForRepo(repoArg: string) {
  try {
    return await loadArkrc(resolveRepo(repoArg));
  } catch (err) {
    handleArkrcError(err);
  }
}

function printWriteResults(repoPath: string, results: WriteResult[]): void {
  for (const r of results) {
    const rel = path.relative(repoPath, r.path);
    if (r.status === 'created') {
      console.log(pc.green(`Created: ${rel}`));
    } else if (r.status === 'overwritten') {
      console.log(pc.yellow(`Overwritten: ${rel}`));
    } else {
      console.log(pc.dim(`Skipped (exists): ${rel}`));
    }
  }
}

const program = new Command();

program
  .name('ark')
  .description('Audit and improve repository readiness for AI coding agents')
  .version('0.1.0');

// ── audit ──────────────────────────────────────────────────────────────────
program
  .command('audit')
  .description('Audit repository agent readiness')
  .option('--json', 'Output machine-readable JSON')
  .option('--junit', 'Output JUnit XML')
  .option('--sarif', 'Output SARIF JSON')
  .option('--no-history', 'Skip writing to .ark-history.json')
  .option(
    '-o, --output <path>',
    'Write report file (.md, .html; relative: under audited repo; absolute: as given)',
  )
  .argument('[repoPath]', 'Repository path', '.')
  .action(
    async (
      repoPath: string,
      opts: {
        json?: boolean;
        junit?: boolean;
        sarif?: boolean;
        output?: string;
        history?: boolean;
      },
    ) => {
      const arkrc = await loadArkrcForRepo(repoPath);
      const run = resolveAuditRunOptions(repoPath, opts, arkrc);
      const resolved = resolveRepo(run.repoPathArg);
      const result = await auditRepo(resolved);

      // Score history
      let delta: number | null = null;
      if (opts.history !== false) {
        const prev = await loadHistory(resolved);
        delta = getScoreDelta(prev, result.score);
        await appendHistory(resolved, result);
      }

      // File output
      if (run.output) {
        const outPath = path.isAbsolute(run.output)
          ? run.output
          : path.join(resolved, run.output);
        await mkdir(path.dirname(outPath), { recursive: true });

        let content: string;
        if (outPath.endsWith('.html')) {
          content = formatHtmlReport(result);
        } else {
          content = formatMarkdownReport(result);
        }
        await writeFile(outPath, content, 'utf8');
        console.error(pc.green(`Report written: ${outPath}`));
      }

      if (run.json) {
        console.log(formatAuditJson(result));
      } else if (opts.junit) {
        console.log(formatJunitReport(result));
      } else if (opts.sarif) {
        console.log(formatSarifReport(result));
      } else {
        if (run.output) console.log('');
        console.log(formatTerminalReport(result, delta));
      }
    },
  );

// ── check ──────────────────────────────────────────────────────────────────
program
  .command('check')
  .description(`Run a single audit category. Available: ${ALL_CHECK_IDS.join(', ')}`)
  .option('--json', 'Output machine-readable JSON')
  .argument('<category>', 'Category ID to run')
  .argument('[repoPath]', 'Repository path', '.')
  .action(
    async (category: string, repoPath: string, opts: { json?: boolean }) => {
      const resolved = resolveRepo(repoPath);
      const cat = await auditCategory(resolved, category);
      if (!cat) {
        console.error(
          pc.red(`Unknown category: ${category}`),
        );
        console.error(`Available: ${ALL_CHECK_IDS.join(', ')}`);
        process.exit(1);
      }
      if (opts.json) {
        console.log(JSON.stringify(cat, null, 2));
        return;
      }
      console.log(
        pc.bold(`${cat.label}: ${pc.cyan(`${cat.score}/${cat.maxScore}`)}`),
      );
      for (const f of cat.findings) {
        const icon =
          f.status === 'pass'
            ? pc.green('✓')
            : f.status === 'warn'
              ? pc.yellow('⚠')
              : pc.red('✗');
        console.log(`  ${icon} ${f.message}`);
        if (f.files?.length) {
          console.log(`    ${pc.dim(f.files.join(', '))}`);
        }
      }
    },
  );

// ── diff ───────────────────────────────────────────────────────────────────
program
  .command('diff')
  .description('Compare two audit JSON results and show score delta')
  .argument('<before>', 'Path to before audit JSON file')
  .argument('<after>', 'Path to after audit JSON file')
  .action(async (beforePath: string, afterPath: string) => {
    let before: AuditJson;
    let after: AuditJson;
    try {
      before = JSON.parse(await readFile(beforePath, 'utf8')) as AuditJson;
      after = JSON.parse(await readFile(afterPath, 'utf8')) as AuditJson;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`Failed to read audit JSON: ${msg}`));
      process.exit(1);
    }
    const diff = computeDiff(before, after);
    console.log(formatDiffReport(diff));
  });

// ── badge ──────────────────────────────────────────────────────────────────
program
  .command('badge')
  .description('Generate an SVG score badge')
  .option('-o, --output <path>', 'Write badge to file (default: stdout)')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { output?: string }) => {
    const resolved = resolveRepo(repoPath);
    const result = await auditRepo(resolved);
    const svg = formatBadgeSvg(result);
    if (opts.output) {
      const outPath = path.isAbsolute(opts.output)
        ? opts.output
        : path.join(resolved, opts.output);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, svg, 'utf8');
      console.error(pc.green(`Badge written: ${outPath}`));
    } else {
      console.log(svg);
    }
  });

// ── fix ────────────────────────────────────────────────────────────────────
program
  .command('fix')
  .description('Scaffold missing files identified by the audit')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const resolved = resolveRepo(repoPath);
    console.log(pc.dim('Running audit to determine missing items…'));
    const result = await auditRepo(resolved);

    const failCount = result.categories
      .flatMap((c) => c.findings)
      .filter((f) => f.status === 'fail').length;

    if (failCount === 0) {
      console.log(pc.green('No failing checks — nothing to fix.'));
      return;
    }

    console.log(pc.yellow(`Found ${failCount} failing check(s). Scaffolding missing files…`));
    console.log('');

    const results = await fixRepo(result, { repoPath: resolved, force: opts.force });
    printWriteResults(resolved, results);

    if (results.every((r) => r.status === 'skipped')) {
      console.log(
        pc.dim('\nAll target files already exist. Use --force to overwrite.'),
      );
    }
  });

// ── init ───────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Create starter agent-readiness files (skip existing)')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveInitOptions(repoPath, opts, arkrc);
    const results = await runInit({
      repoPath: resolveRepo(run.repoPathArg),
      force: run.force,
    });
    printWriteResults(resolveRepo(run.repoPathArg), results);
  });

// ── generate ───────────────────────────────────────────────────────────────
const generate = program
  .command('generate')
  .description('Generate tool-specific agent files');

generate
  .command('cursor')
  .description('Generate .cursor/rules/project.mdc')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveGenerateOptions(repoPath, opts, arkrc);
    const results = await generateCursor({
      repoPath: resolveRepo(run.repoPathArg),
      force: run.force,
    });
    printWriteResults(resolveRepo(run.repoPathArg), results);
  });

generate
  .command('codex')
  .description('Generate AGENTS.md and Codex prompt template')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveGenerateOptions(repoPath, opts, arkrc);
    const results = await generateCodex({
      repoPath: resolveRepo(run.repoPathArg),
      force: run.force,
    });
    printWriteResults(resolveRepo(run.repoPathArg), results);
  });

generate
  .command('claude')
  .description('Generate CLAUDE.md and Claude prompt template')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveGenerateOptions(repoPath, opts, arkrc);
    const results = await generateClaude({
      repoPath: resolveRepo(run.repoPathArg),
      force: run.force,
    });
    printWriteResults(resolveRepo(run.repoPathArg), results);
  });

generate
  .command('copilot')
  .description('Generate .github/copilot-instructions.md')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveGenerateOptions(repoPath, opts, arkrc);
    const results = await generateCopilot({
      repoPath: resolveRepo(run.repoPathArg),
      force: run.force,
    });
    printWriteResults(resolveRepo(run.repoPathArg), results);
  });

generate
  .command('github')
  .description('Generate .github/ structure (CI workflow, PR template, dependabot, issue templates)')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveGenerateOptions(repoPath, opts, arkrc);
    const results = await generateGithub({
      repoPath: resolveRepo(run.repoPathArg),
      force: run.force,
    });
    printWriteResults(resolveRepo(run.repoPathArg), results);
  });

generate
  .command('vscode')
  .description('Generate .vscode/ editor configuration (settings, extensions, launch)')
  .option('-f, --force', 'Overwrite existing files')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { force?: boolean }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveGenerateOptions(repoPath, opts, arkrc);
    const results = await generateVscode({
      repoPath: resolveRepo(run.repoPathArg),
      force: run.force,
    });
    printWriteResults(resolveRepo(run.repoPathArg), results);
  });

program.parse();
