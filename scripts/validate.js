import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { CATEGORIES, WORKPLACES, classifyTitle, isFresh } from "./lib/classify.js";
import { escapeHtml } from "./lib/text.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const companies = JSON.parse(await readFile(join(root, "data", "companies.json"), "utf8")).companies;
const data = JSON.parse(await readFile(join(root, "data", "jobs.json"), "utf8"));
const jobs = data.jobs;
const now = Date.parse(data.generatedAt);

assert.ok(companies.length >= 150, `expected at least 150 companies, found ${companies.length}`);
assert.ok(jobs.length > 0, "expected at least one current pricing job");
assert.equal(data.jobCount, jobs.length);

const slugs = new Set();
for (const job of jobs) {
  assert.equal(classifyTitle(job.title)?.category, job.category, job.title);
  assert.equal(classifyTitle(job.title)?.seniority, job.seniority, job.title);
  assert.equal(isFresh(job.postedAt, now), true, job.title);
  assert.match(job.applyUrl, /^https?:\/\//);
  assert.ok(!slugs.has(job.slug), `duplicate slug ${job.slug}`);
  slugs.add(job.slug);
}

const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
assert.match(sitemap, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
assert.match(sitemap, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
assert.match(sitemap, /<\/urlset>\s*$/);
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(locs).size, locs.length, "duplicate sitemap urls");
assert.ok(locs.includes("https://pricingroles.com/"));
for (const loc of locs) {
  assert.match(loc, /^https:\/\/pricingroles\.com\//);
  const path = loc.replace("https://pricingroles.com/", "");
  const file = path === "" ? join(dist, "index.html") : join(dist, path, "index.html");
  await access(file);
}

const robots = await readFile(join(dist, "robots.txt"), "utf8");
assert.match(robots, /Sitemap: https:\/\/pricingroles\.com\/sitemap\.xml/);
const cname = (await readFile(join(dist, "CNAME"), "utf8")).trim();
assert.equal(cname, "pricingroles.com");

for (const category of CATEGORIES) {
  assert.ok(locs.includes(`https://pricingroles.com/category/${category.slug}/`));
}
for (const workplace of WORKPLACES) {
  assert.ok(locs.includes(`https://pricingroles.com/${workplace.slug}/`));
}

const home = await readFile(join(dist, "index.html"), "utf8");
assert.match(home, /Pricing roles, without the noise/);
assert.doesNotMatch(home, /Agents\s*4/i);
assert.match(home, new RegExp(escapeRegExp(jobs[0].title)));

const about = await readFile(join(dist, "about", "index.html"), "utf8");
assert.doesNotMatch(about, /Agents\s*4/i);
const post = await readFile(join(dist, "post-a-job", "index.html"), "utf8");
assert.match(post, /\$99/);
assert.match(post, /TODO: payments and the listing queue are not connected/);
assert.match(about + post + home, /<script async src="https:\/\/subscribe-forms\.beehiiv\.com\/v3\/loader\.js" data-beehiiv-form="cb38888b-7a0f-4b11-ad14-97c92b62b7a4"><\/script>/);
assert.doesNotMatch(about + post + home, /#newsletter|newsletter-email|TODO: Beehiiv/);

let checked = 0;
for (const job of jobs) {
  const html = await readFile(join(dist, "jobs", job.slug, "index.html"), "utf8");
  const json = extractJobPosting(html);
  assert.equal(json["@type"], "JobPosting");
  assert.equal(json.title, job.title);
  assert.ok(json.description && json.description.length > 20);
  assert.match(json.datePosted, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(json.validThrough, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(json.validThrough >= json.datePosted);
  assert.equal(json.hiringOrganization["@type"], "Organization");
  assert.equal(json.hiringOrganization.name, job.company);
  assert.equal(json.jobLocation["@type"], "Place");
  assert.ok(json.jobLocation.address.addressLocality);
  if (job.workplace === "remote") assert.equal(json.jobLocationType, "TELECOMMUTE");
  if (job.salaryText) {
    assert.equal(json.baseSalary["@type"], "MonetaryAmount");
    assert.ok(json.baseSalary.value.minValue != null);
    assert.ok(json.baseSalary.value.maxValue != null);
  }
  assert.equal(json.url, `https://pricingroles.com/jobs/${job.slug}/`);
  assert.match(html, new RegExp(`href="${escapeRegExp(escapeHtml(job.applyUrl))}"`));
  checked += 1;
}

console.log(`Validated ${companies.length} companies, ${checked} job pages, and ${locs.length} sitemap URLs.`);

function extractJobPosting(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "missing JSON-LD");
  const data = JSON.parse(match[1]);
  const graph = data["@graph"] || [data];
  const posting = graph.find((node) => node["@type"] === "JobPosting");
  assert.ok(posting, "missing JobPosting");
  return posting;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
