const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const webDir = path.join(root, "www");
const files = ["index.html", "budget.html", "profile.html", "script.js", "style.css"];

fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(webDir, file));
}

fs.copyFileSync(
  path.join(root, "node_modules", "chart.js", "dist", "chart.umd.min.js"),
  path.join(webDir, "chart.umd.min.js")
);

fs.mkdirSync(path.join(webDir, "resources"), { recursive: true });
fs.copyFileSync(
  path.join(root, "resources", "mybudgetplann-logo.png"),
  path.join(webDir, "resources", "mybudgetplann-logo.png")
);

console.log(`Copied ${files.length + 2} offline web files to www/`);