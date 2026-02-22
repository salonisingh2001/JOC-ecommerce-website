const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

async function fetchRepoData(owner, repo) {
  const prs = await octokit.pulls.list({
    owner,
    repo,
    state: "all"
  });

  const branches = await octokit.repos.listBranches({
    owner,
    repo
  });

  return {
    pullRequests: prs.data,
    branches: branches.data,
    current_time: new Date().toISOString()
  };
}

module.exports = { fetchRepoData };

