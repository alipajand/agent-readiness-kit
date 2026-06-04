import path from 'node:path';
import { checkAgentInstructions } from './checks/agentInstructions.js';
import { checkArchitecture } from './checks/architecture.js';
import { checkWorkflow } from './checks/workflow.js';
import { checkTesting } from './checks/testing.js';
import { checkSafety } from './checks/safety.js';
import { checkNavigability } from './checks/navigability.js';
import { checkPromptAssets } from './checks/promptAssets.js';
import { checkDependencies } from './checks/dependencies.js';
import { checkCodeStyle } from './checks/codeStyle.js';
import { checkDocumentation } from './checks/documentation.js';
import { checkGitHygiene } from './checks/gitHygiene.js';
import { checkContainerization } from './checks/containerization.js';
import { checkIdeConfig } from './checks/ideConfig.js';
import { finalizeAuditResult } from './scoring.js';
import type { AuditResult, CategoryResult } from '../types.js';

export const ALL_CHECK_IDS = [
  'agent-instructions',
  'architecture',
  'workflow',
  'testing',
  'safety',
  'navigability',
  'prompt-assets',
  'dependencies',
  'code-style',
  'documentation',
  'git-hygiene',
  'containerization',
  'ide-config',
] as const;

export type CheckId = (typeof ALL_CHECK_IDS)[number];

const CHECK_MAP: Record<CheckId, (repoPath: string) => Promise<CategoryResult>> = {
  'agent-instructions': checkAgentInstructions,
  'architecture': checkArchitecture,
  'workflow': checkWorkflow,
  'testing': checkTesting,
  'safety': checkSafety,
  'navigability': checkNavigability,
  'prompt-assets': checkPromptAssets,
  'dependencies': checkDependencies,
  'code-style': checkCodeStyle,
  'documentation': checkDocumentation,
  'git-hygiene': checkGitHygiene,
  'containerization': checkContainerization,
  'ide-config': checkIdeConfig,
};

export async function auditRepo(repoPath: string): Promise<AuditResult> {
  const resolved = path.resolve(repoPath);

  const categories = await Promise.all(
    ALL_CHECK_IDS.map((id) => CHECK_MAP[id](resolved)),
  );

  return finalizeAuditResult(resolved, categories);
}

export async function auditCategory(
  repoPath: string,
  categoryId: string,
): Promise<CategoryResult | null> {
  const resolved = path.resolve(repoPath);
  const fn = CHECK_MAP[categoryId as CheckId];
  if (!fn) return null;
  return fn(resolved);
}
