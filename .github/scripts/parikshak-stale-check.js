// Parikshak — stale-PR auto-close check.
//
// This is a separate scheduled job from pr-gate-check.js, and it is the
// ONE place Parikshak takes a destructive action: everything in
// pr-gate-check.js stays comment-only. See
// ~/Desktop/PR_REVIEW_AUTOMATION_SOP.md §3 for the policy this implements.
//
// Tracks two specific staleness clocks per open PR, each with a clean,
// structured GitHub signal to key off:
//   - an unresolved merge conflict with the base branch
//   - a "changes requested" review with no new commits pushed since
// At 24h it posts one warning comment; at 48h (if still active) it posts
// a closing comment and closes the PR. Draft PRs are exempt.
//
// Deliberately NOT included: auto-closing because "a maintainer raised a
// code-quality concern in a comment" (also mentioned in the SOP) -- a
// freeform comment has no reliable structured signal to key a clock off
// safely, so that stays a human call, made through an explicit review
// (CHANGES_REQUESTED) instead.
//
// Shared byte-for-byte between vicharanashala/fln and vicharanashala/tenali.

const STATE_MARKER = '<!-- parikshak:staleness:';
const STATE_MARKER_END = ' -->';
const WARN_AFTER_MS = 24 * 60 * 60 * 1000;
const CLOSE_AFTER_MS = 48 * 60 * 60 * 1000;

const CLOCKS = [
  {
    key: 'conflict',
    warnText: 'This PR has had an unresolved merge conflict with the base branch for over 24 hours.',
    closeReason: 'it has had an unresolved merge conflict with the base branch for over 48 hours',
  },
  {
    key: 'review',
    warnText: 'This PR has had requested changes open with no new commits addressing them, for over 24 hours.',
    closeReason: 'it has had requested changes open with no new commits addressing them for over 48 hours',
  },
];

function parseState(body) {
  const start = body.indexOf(STATE_MARKER);
  if (start === -1) return {};
  const end = body.indexOf(STATE_MARKER_END, start);
  if (end === -1) return {};
  try {
    return JSON.parse(body.slice(start + STATE_MARKER.length, end));
  } catch {
    return {};
  }
}

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const now = Date.now();

  const prs = await github.paginate(github.rest.pulls.list, { owner, repo, state: 'open', per_page: 100 });
  core.info(`Parikshak stale check: scanning ${prs.length} open PR(s) in ${owner}/${repo}.`);

  let skippedDrafts = 0;
  let closedCount = 0;
  let warnedCount = 0;

  const CLOCK_LABELS = {
    conflict: 'Unresolved merge conflict with the base branch',
    review: 'CHANGES_REQUESTED review with no new commits since',
  };

  for (const prSummary of prs) {
    if (prSummary.draft) {
      skippedDrafts++;
      core.info(`PR #${prSummary.number}: skipped (draft).`);
      continue; // drafts are exempt by design
    }

    const prNumber = prSummary.number;
    core.startGroup(`Parikshak stale check — PR #${prNumber}: ${prSummary.title}`);

    let { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });

    // `mergeable` is null until GitHub finishes computing it -- and fetching a
    // PR that hasn't been touched in a while is exactly what kicks that
    // computation off, so the FIRST read after a lull is very often null.
    // One retry resolves it in practice; if it's still null, treat it as
    // genuinely unknown rather than silently reading that as "no conflict".
    if (pr.mergeable === null) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data: refetched } = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });
      pr = refetched;
    }

    const reviews = await github.paginate(github.rest.pulls.listReviews, { owner, repo, pull_number: prNumber, per_page: 100 });
    const latestDecisive = [...reviews].reverse().find((r) => r.state === 'CHANGES_REQUESTED' || r.state === 'APPROVED');
    const reviewActive = !!latestDecisive && latestDecisive.state === 'CHANGES_REQUESTED' && latestDecisive.commit_id === pr.head.sha;

    // conflict is true/false/null (null = still unknown after the retry --
    // leave that clock's state alone this run rather than guessing).
    const active = { conflict: pr.mergeable === null ? null : pr.mergeable === false, review: reviewActive };
    core.info(`Check 1/2 — ${CLOCK_LABELS.conflict}: ${active.conflict === null ? 'UNKNOWN (GitHub has not computed mergeability yet)' : active.conflict ? 'CURRENTLY ACTIVE' : 'clear'} (mergeable=${pr.mergeable}).`);
    core.info(
      `Check 2/2 — ${CLOCK_LABELS.review}: ${active.review ? 'CURRENTLY ACTIVE' : 'clear'}` +
      (latestDecisive ? ` (latest decisive review: ${latestDecisive.state} at commit ${latestDecisive.commit_id.slice(0, 7)}, PR head is now ${pr.head.sha.slice(0, 7)}).` : ' (no CHANGES_REQUESTED/APPROVED review found).')
    );

    const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: prNumber, per_page: 100 });
    const stateComment = comments.find((c) => c.body && c.body.includes(STATE_MARKER));
    const state = stateComment ? parseState(stateComment.body) : {};

    const warnings = [];
    const closeReasons = [];

    for (const clock of CLOCKS) {
      const sinceKey = `${clock.key}Since`;
      const warnedKey = `${clock.key}WarnedAt`;
      const label = CLOCK_LABELS[clock.key];
      const clockActive = active[clock.key];

      if (clockActive === null) {
        // Genuinely unknown this run (e.g. mergeable still computing) --
        // don't advance the clock, but don't clear it either.
        core.info(`  -> "${label}" clock left untouched (status unknown this run).`);
        continue;
      }

      if (!clockActive) {
        if (state[sinceKey]) core.info(`  -> "${label}" clock cleared (condition resolved since last run).`);
        delete state[sinceKey];
        delete state[warnedKey];
        continue;
      }

      if (!state[sinceKey]) {
        state[sinceKey] = now; // clock starts this run
        core.info(`  -> "${label}" clock started now.`);
        continue;
      }

      const elapsed = now - state[sinceKey];
      const hoursElapsed = (elapsed / (60 * 60 * 1000)).toFixed(1);
      if (elapsed >= CLOSE_AFTER_MS) {
        closeReasons.push(clock.closeReason);
        core.info(`  -> "${label}" clock at ${hoursElapsed}h — CLOSE THRESHOLD REACHED (48h).`);
      } else if (elapsed >= WARN_AFTER_MS && !state[warnedKey]) {
        state[warnedKey] = now;
        warnings.push(clock.warnText);
        core.info(`  -> "${label}" clock at ${hoursElapsed}h — WARN THRESHOLD REACHED (24h).`);
      } else {
        core.info(`  -> "${label}" clock at ${hoursElapsed}h (warn at 24h, close at 48h).`);
      }
    }

    if (warnings.length > 0) {
      warnedCount++;
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body:
          `⏳ ${warnings.join(' ')} If this isn't resolved within another 24 hours, this PR will be automatically closed — ` +
          `you're welcome to reopen once it's addressed, or resubmit fresh referencing the same issue.`,
      });
    }

    if (closeReasons.length > 0) {
      closedCount++;
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body:
          `🔒 **Closing this PR automatically**: ${closeReasons.join(' and ')}. ` +
          `This isn't a judgment on the work — it's the 48-hour rule from the PR SOP, applied the same way to every PR. ` +
          `Fix the issue above and open a fresh PR referencing the same \`Closes #N\` whenever you're ready.`,
      });
      await github.rest.pulls.update({ owner, repo, pull_number: prNumber, state: 'closed' });
    }

    const hasState = Object.keys(state).length > 0;
    const stateBody = `${STATE_MARKER}${JSON.stringify(state)}${STATE_MARKER_END}`;
    if (stateComment) {
      await github.rest.issues.updateComment({ owner, repo, comment_id: stateComment.id, body: stateBody });
    } else if (hasState) {
      await github.rest.issues.createComment({ owner, repo, issue_number: prNumber, body: stateBody });
    }

    core.info(
      `Result: ${warnings.length ? 'WARNED' : ''}${closeReasons.length ? (warnings.length ? ' + CLOSED' : 'CLOSED') : ''}` +
      (warnings.length || closeReasons.length ? '' : 'no action needed')
    );
    core.endGroup();
  }

  core.info(
    `Parikshak stale check summary for ${owner}/${repo}: ${prs.length} open PR(s) total, ` +
    `${skippedDrafts} draft(s) skipped, ${prs.length - skippedDrafts} checked, ${warnedCount} warned, ${closedCount} closed.`
  );
};
