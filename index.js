require("dotenv").config();
const axios = require("axios");
const nodemailer = require("nodemailer");

const headers = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json"
};

const BASE_URL = `https://api.github.com/repos/${process.env.REPO_OWNER}/${process.env.REPO_NAME}`;

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/* =======================================================
   1️⃣ PR Status Summary (Open + Merged/Closed Last 24h)
======================================================= */
async function getPRStatusSummary() {
  const { data: openPRs } = await axios.get(
    `${BASE_URL}/pulls?state=open&per_page=100`,
    { headers }
  );

  const { data: closedPRs } = await axios.get(
    `${BASE_URL}/pulls?state=closed&per_page=100`,
    { headers }
  );

  const since = hoursAgo(24);

  const movedLastDay = closedPRs.filter(pr =>
    new Date(pr.updated_at) > since
  );

  const merged = movedLastDay.filter(pr => pr.merged_at !== null);
  const closed = movedLastDay.filter(pr => pr.merged_at === null);

  return {
    open: openPRs,
    merged,
    closed
  };
}

/* =======================================================
   2️⃣ Abandoned PRs (Open > 1 Day Inactive)
======================================================= */
async function getAbandonedPRs() {
  const { data } = await axios.get(
    `${BASE_URL}/pulls?state=open&per_page=100`,
    { headers }
  );

  const cutoff = daysAgo(1);

  return data.filter(pr =>
    new Date(pr.updated_at) < cutoff
  );
}

/* =======================================================
   3️⃣ Abandoned Branches (>2 Days No Commits)
======================================================= */
async function getAbandonedBranches() {
  const { data: branches } = await axios.get(
    `${BASE_URL}/branches?per_page=100`,
    { headers }
  );

  const cutoff = daysAgo(2);
  const abandoned = [];

  for (const branch of branches) {
    const { data: commitData } = await axios.get(
      branch.commit.url,
      { headers }
    );

    const commitDate = new Date(
      commitData.commit.committer.date
    );

    if (commitDate < cutoff) {
      abandoned.push({
        name: branch.name,
        lastCommit: commitDate
      });
    }
  }

  return abandoned;
}

/* =======================================================
   4️⃣ PR Count By Author (Last 7 Days)
======================================================= */
async function getPRCountByAuthor() {
  const { data } = await axios.get(
    `${BASE_URL}/pulls?state=all&per_page=100`,
    { headers }
  );

  const cutoff = daysAgo(7);
  const counts = {};

  data.forEach(pr => {
    if (new Date(pr.created_at) > cutoff) {
      const author = pr.user.login;
      counts[author] = (counts[author] || 0) + 1;
    }
  });

  return counts;
}

/* =======================================================
   5️⃣ Active Branch Per Environment
======================================================= */
async function getActiveBranchesByEnvironment() {
  const { data } = await axios.get(
    `${BASE_URL}/deployments`,
    { headers }
  );

  const environments = { Dev: null, QA: null, UAT: null };

  data.forEach(dep => {
    if (dep.environment === "Dev") environments.Dev = dep.ref;
    if (dep.environment === "QA") environments.QA = dep.ref;
    if (dep.environment === "UAT") environments.UAT = dep.ref;
  });

  return environments;
}

/* =======================================================
   📧 EMAIL FUNCTION
======================================================= */
async function sendEmailReport(htmlContent) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: "🚀 Daily GitHub PR Report",
    html: htmlContent
  });

  console.log("✅ Styled Email sent successfully");
}

/* =======================================================
   🚀 MAIN RUNNER
======================================================= */
async function runAgent() {
  try {
    const summary = await getPRStatusSummary();
    const abandonedPRs = await getAbandonedPRs();
    const abandonedBranches = await getAbandonedBranches();
    const prCounts = await getPRCountByAuthor();
    const envBranches = await getActiveBranchesByEnvironment();

    const tableStyle = `
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 20px;
      font-family: Arial, sans-serif;
    `;

    const thtdStyle = `
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    `;

    const thStyle = `
      ${thtdStyle}
      background-color: #1f2937;
      color: white;
    `;

    function generatePRTable(title, prs) {
      if (prs.length === 0) return `<h3>${title}</h3><p>None</p>`;

      return `
        <h3>${title}</h3>
        <table style="${tableStyle}">
          <tr>
            <th style="${thStyle}">PR #</th>
            <th style="${thStyle}">Title</th>
            <th style="${thStyle}">Author</th>
            <th style="${thStyle}">Source</th>
            <th style="${thStyle}">Target</th>
          </tr>
          ${prs.map(pr => `
            <tr>
              <td style="${thtdStyle}">#${pr.number}</td>
              <td style="${thtdStyle}">${pr.title}</td>
              <td style="${thtdStyle}">${pr.user.login}</td>
              <td style="${thtdStyle}">${pr.head.ref}</td>
              <td style="${thtdStyle}">${pr.base.ref}</td>
            </tr>
          `).join("")}
        </table>
      `;
    }

    function generateSimpleTable(title, items, columns) {
      if (items.length === 0) return `<h3>${title}</h3><p>None</p>`;

      return `
        <h3>${title}</h3>
        <table style="${tableStyle}">
          <tr>
            ${columns.map(col => `<th style="${thStyle}">${col}</th>`).join("")}
          </tr>
          ${items.map(item => `
            <tr>
              ${columns.map(col => `<td style="${thtdStyle}">${item[col]}</td>`).join("")}
            </tr>
          `).join("")}
        </table>
      `;
    }

    const htmlReport = `
      <div style="background:#f3f4f6;padding:20px">
        <div style="max-width:1000px;margin:auto;background:white;padding:20px;border-radius:10px">

          <h2 style="text-align:center;color:#111827">
            🚀 Daily GitHub Report
          </h2>

          ${generatePRTable("🟢 Open PRs", summary.open)}
          ${generatePRTable("✅ Merged (Last 24h)", summary.merged)}
          ${generatePRTable("❌ Closed Without Merge (Last 24h)", summary.closed)}

          ${generatePRTable("⚠️ Abandoned PRs (>1 day inactive)", abandonedPRs)}

          ${generateSimpleTable(
            "🌿 Abandoned Branches (>2 days)",
            abandonedBranches.map(b => ({
              name: b.name,
              lastCommit: b.lastCommit
            })),
            ["name", "lastCommit"]
          )}

          <h3>📊 PR Count By Author (Last 7 Days)</h3>
          <table style="${tableStyle}">
            <tr>
              <th style="${thStyle}">Author</th>
              <th style="${thStyle}">PR Count</th>
            </tr>
            ${Object.entries(prCounts).map(([author, count]) => `
              <tr>
                <td style="${thtdStyle}">${author}</td>
                <td style="${thtdStyle}">${count}</td>
              </tr>
            `).join("")}
          </table>

          <h3>🚀 Active Branch Per Environment</h3>
          <table style="${tableStyle}">
            <tr>
              <th style="${thStyle}">Environment</th>
              <th style="${thStyle}">Branch</th>
            </tr>
            ${Object.entries(envBranches).map(([env, branch]) => `
              <tr>
                <td style="${thtdStyle}">${env}</td>
                <td style="${thtdStyle}">${branch || "None"}</td>
              </tr>
            `).join("")}
          </table>

        </div>
      </div>
    `;

    await sendEmailReport(htmlReport);

  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

runAgent();