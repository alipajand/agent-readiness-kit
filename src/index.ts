export { VERSION } from './version.js';
export { auditRepo, auditCategory, ALL_CHECK_IDS } from './audit/auditRepo.js';
export type { CheckId } from './audit/auditRepo.js';
export {
  appendHistory,
  getScoreDelta,
  HistoryWriteError,
  loadHistory,
} from './audit/history.js';
export type { AuditHistory, HistoryEntry } from './audit/history.js';
export { ArkrcError, loadArkrc } from './config/loadArkrc.js';
export type { ArkRc } from './config/schema.js';
export { OutputPathError, resolveOutputPath } from './fs/resolveOutputPath.js';
export { writeFileSafe } from './fs/writeFileSafe.js';
export { formatAuditJson, toAuditJson } from './report/jsonReport.js';
export { formatMarkdownReport } from './report/markdownReport.js';
export { formatHtmlReport } from './report/htmlReport.js';
export { formatJunitReport } from './report/junitReport.js';
export { formatSarifReport } from './report/sarifReport.js';
export { formatBadgeSvg } from './report/badgeReport.js';
export { formatTerminalReport } from './report/terminalReport.js';
export { computeDiff, formatDiffReport } from './report/diffReport.js';
export type { DiffResult } from './report/diffReport.js';
export { runInit } from './generate/initFiles.js';
export { fixRepo } from './generate/fixRepo.js';
export type {
  AuditJson,
  AuditResult,
  CategoryResult,
  Finding,
  FindingStatus,
  WriteResult,
} from './types.js';
