import type { AuditResult } from '../types.js';

function scoreColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return '#22c55e';
  if (pct >= 0.5) return '#f59e0b';
  return '#ef4444';
}

function totalColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function statusIcon(status: string): string {
  if (status === 'pass') return '✅';
  if (status === 'warn') return '⚠️';
  return '❌';
}

function statusClass(status: string): string {
  if (status === 'pass') return 'pass';
  if (status === 'warn') return 'warn';
  return 'fail';
}

export function formatHtmlReport(result: AuditResult): string {
  const timestamp = new Date().toISOString();
  const color = totalColor(result.score);

  const categoryRows = result.categories
    .map((cat) => {
      const col = scoreColor(cat.score, cat.maxScore);
      return `<tr>
        <td>${escHtml(cat.label)}</td>
        <td style="color:${col};font-weight:600">${cat.score}</td>
        <td>${cat.maxScore}</td>
        <td>
          <div class="bar-bg"><div class="bar-fill" style="width:${Math.round((cat.score / cat.maxScore) * 100)}%;background:${col}"></div></div>
        </td>
      </tr>`;
    })
    .join('\n');

  const categorySections = result.categories
    .map((cat) => {
      const findings = cat.findings
        .map((f) => {
          const files = f.files?.length
            ? `<div class="finding-files">${f.files.map((x) => `<code>${escHtml(x)}</code>`).join(' ')}</div>`
            : '';
          return `<div class="finding ${statusClass(f.status)}">
            <span class="finding-icon">${statusIcon(f.status)}</span>
            <span class="finding-msg">${escHtml(f.message)}</span>
            ${files}
          </div>`;
        })
        .join('\n');
      const col = scoreColor(cat.score, cat.maxScore);
      return `<section class="category">
        <h3>${escHtml(cat.label)} <span class="cat-score" style="color:${col}">${cat.score}/${cat.maxScore}</span></h3>
        ${findings}
      </section>`;
    })
    .join('\n');

  const missingHtml =
    result.missing.length === 0
      ? '<p class="none">None flagged.</p>'
      : result.missing.map((m) => `<li>${escHtml(m)}</li>`).join('\n');

  const recsHtml =
    result.recommendations.length === 0
      ? '<p class="none">No specific recommendations.</p>'
      : result.recommendations
          .map((r, i) => `<li>${i + 1}. ${escHtml(r.replace(/^\d+\.\s*/, ''))}</li>`)
          .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Readiness Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem;line-height:1.6}
    .container{max-width:900px;margin:0 auto}
    h1{font-size:1.75rem;font-weight:700;margin-bottom:.25rem}
    h2{font-size:1.25rem;font-weight:600;margin:2rem 0 1rem;border-bottom:1px solid #334155;padding-bottom:.5rem}
    h3{font-size:1rem;font-weight:600;margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem}
    .meta{color:#94a3b8;font-size:.875rem;margin-bottom:2rem}
    .score-badge{display:inline-flex;align-items:center;gap:.5rem;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:.75rem 1.5rem;margin-bottom:2rem}
    .score-num{font-size:3rem;font-weight:800;color:${color}}
    .score-label{color:#94a3b8;font-size:.875rem}
    table{width:100%;border-collapse:collapse;font-size:.9rem}
    th,td{text-align:left;padding:.6rem .75rem;border-bottom:1px solid #1e293b}
    th{color:#94a3b8;font-weight:500;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em}
    .bar-bg{background:#1e293b;border-radius:4px;height:8px;width:120px}
    .bar-fill{height:8px;border-radius:4px;transition:width .3s}
    .category{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:1.25rem;margin-bottom:1rem}
    .cat-score{font-weight:700;margin-left:.5rem}
    .finding{display:flex;align-items:flex-start;gap:.5rem;padding:.4rem 0;font-size:.875rem;border-bottom:1px solid #0f172a;flex-wrap:wrap}
    .finding:last-child{border-bottom:none}
    .finding-icon{flex-shrink:0}
    .finding-msg{flex:1}
    .finding-files{width:100%;padding-left:1.5rem;font-size:.8rem;color:#94a3b8}
    .finding-files code{background:#0f172a;padding:.1rem .3rem;border-radius:3px;font-family:monospace}
    .find.pass .finding-msg{color:#86efac}
    ul,ol{padding-left:1.5rem}
    li{margin:.25rem 0;font-size:.9rem}
    .none{color:#64748b;font-style:italic}
    code{font-family:monospace;background:#1e293b;padding:.1rem .3rem;border-radius:3px;font-size:.85em}
    footer{margin-top:3rem;color:#475569;font-size:.8rem;text-align:center}
  </style>
</head>
<body>
<div class="container">
  <h1>Agent Readiness Report</h1>
  <p class="meta">Repository: <code>${escHtml(result.repoPath)}</code> &nbsp;·&nbsp; Generated: ${escHtml(timestamp)}</p>

  <div class="score-badge">
    <div>
      <div class="score-num">${result.score}</div>
      <div class="score-label">/ 100 overall score</div>
    </div>
  </div>

  <h2>Category scores</h2>
  <table>
    <thead><tr><th>Category</th><th>Score</th><th>Max</th><th>Progress</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <h2>Findings by category</h2>
  ${categorySections}

  <h2>Missing items</h2>
  ${result.missing.length > 0 ? `<ul>${missingHtml}</ul>` : missingHtml}

  <h2>Recommended next actions</h2>
  ${result.recommendations.length > 0 ? `<ol>${recsHtml}</ol>` : recsHtml}

  <footer>Generated by <strong>ark</strong> (agent-readiness-kit)</footer>
</div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
