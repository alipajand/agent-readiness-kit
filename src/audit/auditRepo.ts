import path from 'node:path';
import { checkAgentInstructions } from './checks/agentInstructions.js';
import { checkArchitecture } from './checks/architecture.js';
import { checkWorkflow } from './checks/workflow.js';
import { checkTesting } from './checks/testing.js';
import { checkSafety } from './checks/safety.js';
import { checkNavigability } from './checks/navigability.js';
import { checkPromptAssets } from './checks/promptAssets.js';
import { finalizeAuditResult } from './scoring.js';
import type { AuditResult } from '../types.js';

export async function auditRepo(repoPath: string): Promise<AuditResult> {
  const resolved = path.resolve(repoPath);

  const categories = await Promise.all([
    checkAgentInstructions(resolved),
    checkArchitecture(resolved),
    checkWorkflow(resolved),
    checkTesting(resolved),
    checkSafety(resolved),
    checkNavigability(resolved),
    checkPromptAssets(resolved),
  ]);

  return finalizeAuditResult(resolved, categories);
}
