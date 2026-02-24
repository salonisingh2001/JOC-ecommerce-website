const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config();

const {
  GITHUB_TOKEN,
  REPO_OWNER,
  REPO_NAME,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_TO
} = process.env;

const github = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json"
  }
});

const now = new Date();
const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

async function getPRStatusSummary() {
  const openPRs = await github.get(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=open&per_page=100`
  );

  const closedPRs = await github.get(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&per_page=100`
  );

  const merged = closedPRs.data.filter(
    pr => pr.merged_at && new Date(pr.merged_at) > oneDayAgo
  );

  const closed = closedPRs.data.filter(
    pr => !pr.merged_at && new Date(pr.closed_at) > oneDayAgo
  );

  return {
    open: openPRs.data,
    merged,
    closed
  };
}

async function getAbandonedPRs() {
  const response = await github.get(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=open&per_page=100`
  );

  return response.data.filter(
    pr => new Date(pr.updated_at) < oneDayAgo
  );
}

async function getAbandonedBranches() {
  const branches = await github.get(
    `/repos/${REPO_OWNER}/${REPO_NAME}/branches?per_page=100`
  );

  const abandoned = [];

  for (const branch of branches.data) {
    const commit = await github.get(
      `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${branch.commit.sha}`
    );

    const commitDate = new Date(commit.data.commit.author.date);

    if (commitDate < twoDaysAgo) {
      abandoned.push({
        name: branch.name,
        lastCommit: commitDate.toISOString()
      });
    }
  }

  return abandoned;
}

async function getPRCountByAuthor() {
  const response = await github.get(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=all&per_page=100`
  );

  const recentPRs = response.data.filter(
    pr => new Date(pr.created_at) > sevenDaysAgo
  );

  const count = {};

  recentPRs.forEach(pr => {
    const author = pr.user.login;
    count[author] = (count[author] || 0) + 1;
  });

  return count;
}

function generateHTMLReport(data) {
  return `
    <h2>Daily GitHub PR Report</h2>
    <p><strong>Open PRs:</strong> ${data.summary.open.length}</p>
    <p><strong>Merged (Last 24h):</strong> ${data.summary.merged.length}</p>
    <p><strong>Closed (Last 24h):</strong> ${data.summary.closed.length}</p>
    <p><strong>Abandoned PRs:</strong> ${data.abandonedPRs.length}</p>
    <p><strong>Abandoned Branches:</strong> ${data.abandonedBranches.length}</p>
  `;
}

async function sendEmail(html) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: EMAIL_USER,
    to: EMAIL_TO.split(","),
    subject: "Daily GitHub PR Report",
    html
  });
}

async function main() {
  try {
    const summary = await getPRStatusSummary();
    const abandonedPRs = await getAbandonedPRs();
    const abandonedBranches = await getAbandonedBranches();
    const prCount = await getPRCountByAuthor();

    const html = generateHTMLReport({
      summary,
      abandonedPRs,
      abandonedBranches,
      prCount
    });

    await sendEmail(html);

    console.log("Report sent successfully");
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

main();

