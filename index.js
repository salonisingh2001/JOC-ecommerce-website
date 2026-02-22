require("dotenv").config();
const { fetchRepoData } = require("./githubService");
const { generateReport } = require("./openaiService");
const { sendEmail } = require("./emailService");

async function run() {
  const data = await fetchRepoData("salonisingh2001", "JOC-ecommerce-website");

  const report = await generateReport(data);

  await sendEmail(report);
   console.log("Report sent successfully");
}

run();
