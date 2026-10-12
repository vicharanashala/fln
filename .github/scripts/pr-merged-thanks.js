// Posts one short thank-you comment on a merged PR. Idempotent (one marked
// comment per PR). Says only what it can know: who authored the PR, its
// number, and which issues the merge closed. Review details stay manual.
const MARKER = '<!-- parikshak:thanks -->';

module.exports = async function run({ github, context, core }) {
  const { owner, repo } = context.repo;
  const isDispatch = context.eventName === 'workflow_dispatch';
  const number = isDispatch
    ? Number(context.payload.inputs.pr_number)
    : context.payload.pull_request.number;
  const dryRun = isDispatch && String(context.payload.inputs.dry_run) !== 'false';

  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });

  if (!pr.merged) return core.info(`#${number} is not merged, skipping.`);
  if (pr.user.type === 'Bot' || pr.user.login.endsWith('[bot]')) {
    return core.info(`#${number} was opened by a bot, skipping.`);
  }
  // A maintainer merging their own PR does not need a thank-you.
  if (pr.merged_by && pr.merged_by.login === pr.user.login) {
    return core.info(`#${number} was merged by its author, skipping.`);
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner, repo, issue_number: number, per_page: 100,
  });
  if (comments.some(c => c.body && c.body.includes(MARKER))) {
    return core.info(`#${number} already has a thank-you comment, skipping.`);
  }

  // Issues this merge closes (from the PR's own "Closes #N" links).
  const res = await github.graphql(
    `query($owner:String!,$repo:String!,$number:Int!){
       repository(owner:$owner,name:$repo){
         pullRequest(number:$number){ closingIssuesReferences(first:10){ nodes{ number } } }
       }
     }`,
    { owner, repo, number },
  );
  const closed = res.repository.pullRequest.closingIssuesReferences.nodes.map(n => `#${n.number}`);
  const closedLine = closed.length
    ? ` It closes ${closed.join(', ')}.`
    : '';

  const body = [
    MARKER,
    `Hi @${pr.user.login} 👋 thank you so much for your contribution 🌟 PR #${number} has been merged 🎉${closedLine}`,
    '',
    'We really appreciate your effort and your patience with the review 💛 We hope you will pick up another issue soon, and we are always glad to help.',
    '',
    'Best regards,',
    'Team Vicharanashala',
  ].join('\n');

  if (dryRun) {
    core.info(`DRY RUN, would post on #${number}:\n\n${body}`);
    return;
  }
  await github.rest.issues.createComment({ owner, repo, issue_number: number, body });
  core.info(`Posted thank-you on #${number}.`);
};
