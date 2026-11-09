// Creates or updates the one PR comment that contains `marker`, so reruns edit
// it instead of adding another. Called from actions/github-script:
//   const { upsertPrComment } = await import(`${process.env.GITHUB_WORKSPACE}/.github/scripts/upsert-pr-comment.js`);
//   await upsertPrComment({ github, context }, "<!-- marker -->", body);
export async function upsertPrComment({ github, context }, marker, body) {
	const issue = {
		owner: context.repo.owner,
		repo: context.repo.repo,
		issue_number: context.issue.number,
	};
	const fullBody = `${marker}\n${body}`;
	// listComments returns one page of 30; a busy PR has more.
	const comments = await github.paginate(github.rest.issues.listComments, {
		...issue,
		per_page: 100,
	});
	const existing = comments.find((c) => c.body?.includes(marker));
	if (existing) {
		await github.rest.issues.updateComment({
			owner: issue.owner,
			repo: issue.repo,
			comment_id: existing.id,
			body: fullBody,
		});
	} else {
		await github.rest.issues.createComment({ ...issue, body: fullBody });
	}
}
