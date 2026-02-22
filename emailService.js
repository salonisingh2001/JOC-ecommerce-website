const nodemailer = require("nodemailer");

async function sendEmail(report) {
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
    subject: "Daily GitHub Report",
    text: JSON.stringify(report, null, 2)
  });
}

module.exports = { sendEmail };

