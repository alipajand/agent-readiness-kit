export type FindingStatus = 'pass' | 'warn' | 'fail';

export type Finding = {
  status: FindingStatus;
  message: string;
  files?: string[];
};

export type CategoryResult = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  findings: Finding[];
};

export type AuditResult = {
  repoPath: string;
  score: number;
  categories: CategoryResult[];
  missing: string[];
  recommendations: string[];
};

export type AuditJson = {
  repoPath: string;
  score: number;
  categories: Array<{
    id: string;
    label: string;
    score: number;
    maxScore: number;
    findings: Array<{
      status: FindingStatus;
      message: string;
      files?: string[];
    }>;
  }>;
  missing: string[];
  recommendations: string[];
};

export type WriteResult = {
  path: string;
  /**
   * `refused` means the target was a symlink (with `force`) or would have
   * landed outside the repository; nothing was written.
   */
  status: 'created' | 'skipped' | 'overwritten' | 'refused';
  reason?: 'symlink' | 'outside-repo';
};
