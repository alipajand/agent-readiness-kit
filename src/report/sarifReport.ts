import type { AuditResult } from '../types.js';

type SarifLevel = 'error' | 'warning' | 'note';

function findingLevel(status: string): SarifLevel {
  if (status === 'fail') return 'error';
  if (status === 'warn') return 'warning';
  return 'note';
}

export function formatSarifReport(result: AuditResult): string {
  const rules = result.categories.map((cat) => ({
    id: cat.id,
    name: cat.label,
    shortDescription: { text: cat.label },
    fullDescription: {
      text: `${cat.label} audit category (${cat.score}/${cat.maxScore} points)`,
    },
    properties: {
      score: cat.score,
      maxScore: cat.maxScore,
    },
  }));

  const results = result.categories.flatMap((cat) =>
    cat.findings
      .filter((f) => f.status !== 'pass')
      .map((f) => ({
        ruleId: cat.id,
        level: findingLevel(f.status),
        message: { text: f.message },
        locations: (f.files ?? []).map((file) => ({
          physicalLocation: {
            artifactLocation: {
              uri: file,
              uriBaseId: '%SRCROOT%',
            },
          },
        })),
      })),
  );

  const sarif = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'ark',
            informationUri: 'https://github.com/ark-agent/agent-readiness-kit',
            version: '0.1.0',
            rules,
          },
        },
        results,
        properties: {
          repoPath: result.repoPath,
          score: result.score,
        },
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
