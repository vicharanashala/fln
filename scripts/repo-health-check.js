#!/usr/bin/env node
// Daily repo-health check (invoked by .github/workflows/repo-health-check.yml).
// Reports: lint status (tsc --noEmit, both workspaces) + CHANGELOG.md staleness
// relative to the latest commit on main. Writes a markdown summary to stdout
// and exits non-zero if anything needs attention, so the workflow can decide
// whether to open/update a tracking issue.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

let problems = [];
let notes = [];

// --- Lint check ---
let lintOk = true;
let lintOutput = '';
try {
  execSync('npm run lint --silent', { encoding: 'utf8', stdio: 'pipe' });
} catch (err) {
  lintOk = false;
  lintOutput = (err.stdout || '') + (err.stderr || '');
}
if (!lintOk) {
  problems.push('**`npm run lint` (tsc --noEmit) is failing.** New type errors have been introduced since the last known-clean baseline.');
  notes.push('```\n' + lintOutput.split('\n').slice(0, 40).join('\n') + '\n```');
}

// --- CHANGELOG staleness check ---
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');
const dateMatch = changelog.match(/^## (\d{4}-\d{2}-\d{2})/m);
const latestChangelogDate = dateMatch ? new Date(dateMatch[1]) : null;

const latestCommitDate = new Date(sh('git log -1 --date=short --pretty=%ad'));
const STALE_THRESHOLD_DAYS = 5;

if (!latestChangelogDate) {
  problems.push('**Could not find a dated `## YYYY-MM-DD` heading at the top of CHANGELOG.md.** Format may have drifted.');
} else {
  const gapDays = Math.round((latestCommitDate - latestChangelogDate) / (1000 * 60 * 60 * 24));
  if (gapDays > STALE_THRESHOLD_DAYS) {
    // Count merged PRs since the changelog's last dated entry to give a concrete number, not just a day count.
    let mergedSince = 'unknown';
    try {
      mergedSince = sh(`git log --oneline --merges --since="${dateMatch[1]}" | wc -l`).trim();
    } catch (e) { /* best-effort */ }
    problems.push(`**CHANGELOG.md is ${gapDays} days stale.** Latest dated entry is ${dateMatch[1]}, but the most recent commit is from ${sh('git log -1 --date=short --pretty=%ad')} (${mergedSince} merge commits since). Regenerate/update the changelog.`);
  } else {
    notes.push(`CHANGELOG.md is current (last entry ${dateMatch[1]}, ${gapDays} day(s) behind the latest commit).`);
  }
}

// --- Output ---
const ok = problems.length === 0;
console.log(`# Repo Health Check — ${new Date().toISOString().slice(0, 10)}\n`);
console.log(ok ? 'All checks passed.\n' : 'Issues found:\n');
for (const p of problems) console.log(`- ${p}`);
if (notes.length) {
  console.log('\n<details><summary>Details</summary>\n');
  for (const n of notes) console.log(n);
  console.log('\n</details>');
}

process.exit(ok ? 0 : 1);
