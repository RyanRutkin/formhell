import { promises as fs } from "node:fs";
import path from "node:path";

const SITE_ORIGIN = "https://ryanrutkin.github.io";
const BASE_PATH = "/formhell";
const ROOT = process.cwd();
const playgroundDir = path.join(ROOT, "playground");
const publicDir = path.join(playgroundDir, "public");
const sitemapPath = path.join(publicDir, "sitemap.xml");

async function collectHtmlRoutes(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const routes = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...(await collectHtmlRoutes(fullPath)));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) {
      continue;
    }

    const relative = path.relative(publicDir, fullPath).replace(/\\/g, "/");

    if (relative.toLowerCase() === "index.html") {
      routes.push("/");
      continue;
    }

    const withoutExtension = relative.replace(/\.html$/i, "");
    routes.push(`/${withoutExtension}`);
  }

  return routes;
}

function buildUrlSet(urls) {
  const urlEntries = urls
    .map((route) => {
      const normalizedRoute = route === "/" ? "" : route;
      const loc = `${SITE_ORIGIN}${BASE_PATH}${normalizedRoute}`;
      const priority = route === "/" ? "1.0" : "0.8";
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        "    <changefreq>weekly</changefreq>",
        `    <priority>${priority}</priority>`,
        "  </url>"
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    "</urlset>",
    ""
  ].join("\n");
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });

  const routesFromPublic = await collectHtmlRoutes(publicDir);
  const uniqueRoutes = Array.from(new Set(["/", "/playground", ...routesFromPublic])).sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });

  const sitemap = buildUrlSet(uniqueRoutes);
  await fs.writeFile(sitemapPath, sitemap, "utf8");

  console.log(`Generated sitemap at ${sitemapPath}`);
  console.log(`Included routes: ${uniqueRoutes.join(", ")}`);
}

main().catch((error) => {
  console.error("Failed to generate sitemap:", error);
  process.exitCode = 1;
});
