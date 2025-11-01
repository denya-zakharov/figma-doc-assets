import fs from "fs";
import fetch from "node-fetch";
import path from "path";

// Figma token & file key
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = "HM8wnNHO2pgqZLhrUlHdq1"; // replace
const FRAME_PREFIX = "#doc";

// GitHub Pages URL
const GITHUB_PAGES_BASE = "https://denya-zakharov.github.io/figma-doc-assets/images/";

const headers = { "X-Figma-Token": FIGMA_TOKEN };

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  return await res.json();
}

// Walk recursively to find frames
function walk(node, frames) {
  if (!node) return;
  const name = node.name?.trim();
  if (name?.startsWith(FRAME_PREFIX)) frames.push(node);
  if (Array.isArray(node.children)) node.children.forEach(n => walk(n, frames));
}

// Get frames with #doc prefix
async function getDocFrames() {
  const data = await fetchJson(`https://api.figma.com/v1/files/${FILE_KEY}`);
  const frames = [];
  if (data?.document?.children) {
    data.document.children.forEach(page => walk(page, frames));
  }
  return frames;
}

// Get signed image URLs from Figma
async function getImageUrls(frameIds) {
  const url = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${frameIds.join(",")}&format=png`;
  const data = await fetchJson(url);
  return data.images;
}

// Download an image
async function downloadImage(url, filepath) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
}

async function exportImages() {
  const frames = await getDocFrames();
  if (!frames.length) return console.log("⚠️ No #doc frames found");

  const ids = frames.map(f => f.id);
  const urls = await getImageUrls(ids);

  const outDir = path.join(process.cwd(), "images");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  let snippet = "";
  for (const f of frames) {
    const url = urls[f.id];
    const name = f.name.trim().replace(FRAME_PREFIX, "").trim().replace(/\s+/g, "_");
    const filename = `${name}.png`;
    const filepath = path.join(outDir, filename);

    await downloadImage(url, filepath);
    console.log(`✅ Saved ${filename}`);

    // Markdown snippet pointing to GitHub Pages
    snippet += `![${name}](${GITHUB_PAGES_BASE}${filename})\n`;
  }

  fs.writeFileSync("snippet.md", snippet);
  console.log("✅ Markdown snippet saved to snippet.md");
}

exportImages().catch(console.error);
