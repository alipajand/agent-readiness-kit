import type { AuditResult, WriteResult } from '../types.js';
import { runInit } from './initFiles.js';
import { generateCopilot } from './copilotFiles.js';
import { generateGithub } from './githubFiles.js';

export type FixOptions = { force?: boolean; repoPath: string };

/**
 * Maps audit failure/warn messages to generate actions.
 * Returns a list of write results from scaffolding missing files.
 */
export async function fixRepo(
  auditResult: AuditResult,
  options: FixOptions,
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  const { repoPath, force } = options;
  const opts = { repoPath, force };

  const allFindings = auditResult.categories.flatMap((c) => c.findings);
  const fails = allFindings.filter((f) => f.status === 'fail');
  const messages = fails.map((f) => f.message.toLowerCase());

  const needs = (keyword: string) =>
    messages.some((m) => m.includes(keyword));

  // Always run init for core missing files (AGENTS.md, ARCHITECTURE.md, etc.)
  if (
    needs('agents.md') ||
    needs('architecture') ||
    needs('readme') ||
    needs('prompt')
  ) {
    const initResults = await runInit({ repoPath, force });
    results.push(...initResults);
  }

  // .github/copilot-instructions.md
  if (needs('copilot') || needs('agent instruction')) {
    const copilotResults = await generateCopilot(opts);
    results.push(...copilotResults);
  }

  // CI workflow / dependabot
  if (needs('ci workflow') || needs('dependabot') || needs('no ci')) {
    const githubResults = await generateGithub(opts);
    results.push(...githubResults);
  }

  // Deduplicate paths (keep first result per path)
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}
