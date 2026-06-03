import type { AuditResult, CategoryResult } from '../types.js';

export function sumCategoryScores(categories: CategoryResult[]): number {
  const total = categories.reduce((sum, cat) => sum + cat.score, 0);
  return Math.min(100, total);
}

export function buildMissingAndRecommendations(
  categories: CategoryResult[],
  repoPath: string,
): { missing: string[]; recommendations: string[] } {
  const missing: string[] = [];
  const recommendations: string[] = [];

  const add = (item: string, rec?: string) => {
    if (!missing.includes(item)) missing.push(item);
    if (rec && !recommendations.includes(rec)) recommendations.push(rec);
  };

  for (const cat of categories) {
    for (const f of cat.findings) {
      if (f.status === 'fail') {
        if (f.message.includes('AGENTS.md')) {
          add(
            'AGENTS.md',
            'Add AGENTS.md with project overview, commands, and agent boundaries',
          );
        }
        if (
          f.message.includes('ARCHITECTURE') ||
          f.message.includes('architecture doc')
        ) {
          add(
            'docs/ARCHITECTURE.md',
            'Add docs/ARCHITECTURE.md describing system boundaries',
          );
        }
        if (f.message.includes('.env.example')) {
          add(
            '.env.example',
            'Add .env.example listing required environment variables',
          );
        }
        if (f.message.includes('README')) {
          add('README.md', 'Add README.md with setup and project overview');
        }
        if (f.message.includes('QA prompt')) {
          add('reusable QA prompt', 'Add docs/prompts/QA_AUDIT_PROMPT.md');
        }
        if (f.message.includes('test')) {
          add(
            'test script or test files',
            'Add tests and a package.json test script',
          );
        }
      }
    }
  }

  const agentCat = categories.find((c) => c.id === 'agent-instructions');
  if (agentCat && agentCat.score < 20) {
    if (!missing.includes('AGENTS.md')) {
      add('AGENTS.md', 'Add AGENTS.md');
    }
  }

  const archCat = categories.find((c) => c.id === 'architecture');
  if (archCat && archCat.score < 10) {
    if (!missing.some((m) => m.includes('ARCHITECTURE'))) {
      add('docs/ARCHITECTURE.md', 'Add docs/ARCHITECTURE.md');
    }
  }

  const promptCat = categories.find((c) => c.id === 'prompt-assets');
  if (promptCat && promptCat.score < 5) {
    add(
      'docs/prompts/',
      'Add docs/prompts/ with QA_AUDIT_PROMPT.md and task templates',
    );
  }

  const workflowCat = categories.find((c) => c.id === 'workflow');
  if (workflowCat) {
    const testFail = workflowCat.findings.some((f) =>
      f.message.includes('Missing test script'),
    );
    if (testFail) {
      add('package.json test script', 'Add a test script to package.json');
    }
    const tcWarn = workflowCat.findings.some((f) =>
      f.message.includes('Missing typecheck script'),
    );
    if (tcWarn) {
      add('typecheck script', 'Add typecheck script for agent validation');
    }
  }

  if (recommendations.length === 0 && missing.length > 0) {
    missing.slice(0, 5).forEach((m, i) => {
      recommendations.push(`${i + 1}. Address: ${m}`);
    });
  }

  void repoPath;
  return { missing, recommendations };
}

export function finalizeAuditResult(
  repoPath: string,
  categories: CategoryResult[],
): AuditResult {
  const score = sumCategoryScores(categories);
  const { missing, recommendations } = buildMissingAndRecommendations(
    categories,
    repoPath,
  );

  return {
    repoPath,
    score,
    categories,
    missing,
    recommendations,
  };
}
