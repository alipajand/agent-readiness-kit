#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import pc from 'picocolors';
import { auditRepo } from './audit/auditRepo.js';
import { formatTerminalReport } from './report/terminalReport.js';
import { formatAuditJson } from './report/jsonReport.js';
import { formatMarkdownReport } from './report/markdownReport.js';
import { runInit } from './generate/initFiles.js';
import { generateCursor } from './generate/cursorFiles.js';
import { generateCodex } from './generate/codexFiles.js';
import { generateClaude } from './generate/claudeFiles.js';
import type { WriteResult } from './types.js';
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

program
  .command('audit')
  .description('Audit repository agent readiness')
  .option('--json', 'Output machine-readable JSON')
  .option('-o, --output <path>', 'Write Markdown report to file')
  .argument('[repoPath]', 'Repository path', '.')
  .action(async (repoPath: string, opts: { json?: boolean; output?: string }) => {
    const arkrc = await loadArkrcForRepo(repoPath);
    const run = resolveAuditRunOptions(repoPath, opts, arkrc);
    const resolved = resolveRepo(run.repoPathArg);
    const result = await auditRepo(resolved);

    if (run.output) {
      const outPath = path.isAbsolute(run.output)
        ? run.output
        : path.join(resolved, run.output);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, formatMarkdownReport(result), 'utf8');
      console.log(pc.green(`Report written: ${outPath}`));
    }

    if (run.json) {
      console.log(formatAuditJson(result));
    } else if (!run.output) {
      console.log(formatTerminalReport(result));
    } else if (!run.json) {
      console.log('');
      console.log(formatTerminalReport(result));
    }
  });

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

const generate = program.command('generate').description('Generate tool-specific agent files');

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

program.parse();
