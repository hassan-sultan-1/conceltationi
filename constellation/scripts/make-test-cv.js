// Dev-only script: generates a sample CV PDF for testing /api/parse-cv.
// Writes a minimal, uncompressed PDF by hand (no dependencies) so the
// fixture is deterministic and parseable everywhere.
const fs = require("fs");

const lines = [
  "Ayesha Khan",
  "Final-year Computer Science student, Karachi",
  "",
  "EXPERIENCE",
  "Software Engineering Intern - TechCo (Summer 2025)",
  "Built dashboards with React and TypeScript, wrote SQL queries for reporting.",
  "",
  "PROJECTS",
  "FYP: Sentiment analysis of Urdu tweets using Python, pandas and machine learning.",
  "Designed the project UI in Figma.",
  "",
  "SKILLS",
  "Python, JavaScript, React, SQL, Data Analysis, Figma, Communication, Teamwork",
  "",
  "INTERESTS",
  "Artificial intelligence, photography, volunteering at education nonprofits, cricket",
];

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
let content = "BT\n/F1 11 Tf\n50 740 Td\n14 TL\n";
for (const line of lines) content += `(${esc(line)}) Tj\nT*\n`;
content += "ET";

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefStart = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

fs.writeFileSync("test-cv.pdf", pdf, "binary");
console.log("wrote test-cv.pdf,", Buffer.byteLength(pdf), "bytes");
