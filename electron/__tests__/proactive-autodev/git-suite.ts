import { describe, expect, it } from 'vitest';

function isProtectedBranch(branch: string): boolean {
  return branch === 'main' || branch === 'master';
}

function generateWorkBranch(description: string): string {
  const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  return `autodev/${slug}`;
}

function hasMergeConflicts(content: string): boolean {
  return /^<{7}\s/m.test(content) || /^>{7}\s/m.test(content) || /^={7}$/m.test(content);
}

describe('AutoDev Git', () => {
  it('AD-017: identifies main as a protected branch', () => {
    expect(isProtectedBranch('main')).toBe(true);
    expect(isProtectedBranch('master')).toBe(true);
  });

  it('AD-018: does not protect feature branches', () => {
    expect(isProtectedBranch('autodev/fix-memory')).toBe(false);
    expect(isProtectedBranch('feature/new-thing')).toBe(false);
  });

  it('AD-019: generates work branches with autodev/ prefix', () => {
    expect(generateWorkBranch('Fix Memory Service Leak')).toBe('autodev/fix-memory-service-leak');
  });

  it('AD-020: detects merge conflict markers in file content', () => {
    const conflicted = `some code\n<<<<<<< HEAD\nour changes\n=======\ntheir changes\n>>>>>>> branch\nmore code`;
    expect(hasMergeConflicts(conflicted)).toBe(true);
    expect(hasMergeConflicts('some normal code')).toBe(false);
  });
});
