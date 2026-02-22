const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function loadPrompt() {
  return fs.readFileSync(
    path.join(__dirname, "prompts/daily-report.txt"),
    "utf-8"
  );
}

async function generateReport(data) {
  const prompt = loadPrompt();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(data) }
    ]
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = { generateReport };

