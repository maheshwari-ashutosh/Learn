#!/usr/bin/env node

/**
 * Auto-generates the Guides table in README.md by scanning each
 * sub-folder for an HTML entry point and extracting its <title>.
 *
 * Usage:  node scripts/update-readme.mjs
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const README = join(ROOT, "README.md");
const BASE_URL = "https://maheshwari-ashutosh.github.io/Learn";

// Folders to always skip
const SKIP = new Set([
  "node_modules",
  ".git",
  ".github",
  ".githooks",
  "scripts",
]);

async function discoverGuides() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const guides = [];

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith(".") ||
      SKIP.has(entry.name)
    )
      continue;

    const dir = join(ROOT, entry.name);

    // Find the HTML entry point
    const htmlFile = await findHtmlEntry(dir, entry.name);
    if (!htmlFile) continue;

    // Extract <title> from the HTML
    const html = await readFile(join(dir, htmlFile), "utf-8");
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();

    // Derive a short topic from the title (text before the em dash, if any)
    const topic = title.includes("—") ? title.split("—")[0].trim() : title;

    guides.push({ folder: entry.name, title, topic, htmlFile });
  }

  // Sort alphabetically by title
  guides.sort((a, b) => a.title.localeCompare(b.title));
  return guides;
}

async function findHtmlEntry(dir, folderName) {
  // Prefer index.html, then <folder-name>.html, then first .html in root
  for (const candidate of ["index.html", `${folderName}.html`]) {
    try {
      await stat(join(dir, candidate));
      return candidate;
    } catch {
      // try next
    }
  }

  // Fallback: first .html file in the directory root
  const files = await readdir(dir);
  const html = files.find((f) => f.endsWith(".html"));
  return html || null;
}

function buildTable(guides) {
  const rows = guides.map((g, i) => {
    const url = `${BASE_URL}/${g.folder}/${g.htmlFile}`;
    return `| ${i + 1} | [${g.title}](${url}) | ${g.topic} |`;
  });

  return [`| # | Guide | Topic |`, `|---|-------|-------|`, ...rows].join("\n");
}

async function run() {
  const guides = await discoverGuides();
  const table = buildTable(guides);

  const readme = await readFile(README, "utf-8");

  // Replace everything between <!-- GUIDES:START --> and <!-- GUIDES:END -->
  const startTag = "<!-- GUIDES:START -->";
  const endTag = "<!-- GUIDES:END -->";

  if (!readme.includes(startTag) || !readme.includes(endTag)) {
    console.error(
      `README.md is missing the ${startTag} / ${endTag} markers.\nPlease add them around the guides table.`,
    );
    process.exit(1);
  }

  const before = readme.slice(0, readme.indexOf(startTag) + startTag.length);
  const after = readme.slice(readme.indexOf(endTag));

  const updated = `${before}\n${table}\n${after}`;

  if (updated === readme) {
    console.log("README.md is already up to date.");
    return false;
  }

  await writeFile(README, updated, "utf-8");
  console.log(`README.md updated with ${guides.length} guides.`);
  return true;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
