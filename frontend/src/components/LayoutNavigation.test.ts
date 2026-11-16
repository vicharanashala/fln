import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Layout navigation role-based menu items', () => {
  const layoutPath = path.resolve(__dirname, 'Layout.tsx');
  const layoutSource = fs.readFileSync(layoutPath, 'utf-8');

  it('BLOCK_ADMIN does not include Question Bank menu item', () => {
    const blockAdminBlock = layoutSource.match(/case UserRole\.BLOCK_ADMIN:([\s\S]*?)break;/)?.[1] ?? '';
    expect(blockAdminBlock).not.toContain("view: 'question_bank'");
  });

  it('DISTRICT_ADMIN does not include Question Bank menu item', () => {
    const districtAdminBlock = layoutSource.match(/case UserRole\.DISTRICT_ADMIN:([\s\S]*?)break;/)?.[1] ?? '';
    expect(districtAdminBlock).not.toContain("view: 'question_bank'");
  });

  it('ADMIN (state admin) does not include Question Bank menu item', () => {
    const adminBlock = layoutSource.match(/case UserRole\.ADMIN:([\s\S]*?)break;/)?.[1] ?? '';
    expect(adminBlock).not.toContain("view: 'question_bank'");
  });

  it('SUPERADMIN preserves Question Bank menu item', () => {
    const superadminBlock = layoutSource.match(/case UserRole\.SUPERADMIN:([\s\S]*?)break;/)?.[1] ?? '';
    expect(superadminBlock).toContain("view: 'question_bank'");
  });
});
