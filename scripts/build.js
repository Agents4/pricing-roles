import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, SENIORITY, WORKPLACES, categoryMeta, seniorityMeta, workplaceMeta } from "./lib/classify.js";
import { formatSalary } from "./lib/salary.js";
import { jobPostingJsonLd } from "./lib/schema.js";
import { escapeHtml } from "./lib/text.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const SITE = "https://pricingroles.com";

const data = JSON.parse(await readFile(join(root, "data", "jobs.json"), "utf8"));
const jobs = data.jobs;
const generatedLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(data.generatedAt));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(root, "site"), join(dist, "assets"), { recursive: true });

const pages = [];

await writePage("", page({
  title: "PricingRoles — Pricing, monetization, and revenue strategy jobs",
  description: "Open pricing, monetization, deal desk, packaging, and revenue strategy roles. Every listing links to the company that posted it.",
  path: "",
  main: homeMain(),
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PricingRoles",
    url: `${SITE}/`,
    description: "A job board for pricing, monetization, and revenue strategy roles.",
  },
}));

await writePage("about/index.html", page({
  title: "About PricingRoles",
  description: "PricingRoles lists pricing, monetization, deal desk, packaging, and revenue strategy jobs from public company job boards.",
  path: "about/",
  main: aboutMain(),
}));

await writePage("post-a-job/index.html", page({
  title: "Post a pricing job",
  description: "Feature a pricing, monetization, or revenue strategy role on PricingRoles. Featured listings are $99 for 30 days.",
  path: "post-a-job/",
  main: postMain(),
}));

for (const category of CATEGORIES) {
  const matched = jobs.filter((job) => job.category === category.slug);
  await writePage(`category/${category.slug}/index.html`, page({
    title: `${category.name} jobs | PricingRoles`,
    description: category.intro,
    path: `category/${category.slug}/`,
    locked: { category: category.slug },
    main: landingMain({
      eyebrow: "Category",
      title: `${category.name} jobs`,
      lede: category.intro,
      jobs: matched,
      depth: 2,
    }),
  }));
}

for (const workplace of WORKPLACES) {
  const matched = jobs.filter((job) => job.workplace === workplace.slug);
  await writePage(`${workplace.slug}/index.html`, page({
    title: `${workplace.name} pricing jobs | PricingRoles`,
    description: workplace.intro,
    path: `${workplace.slug}/`,
    locked: { workplace: workplace.slug },
    main: landingMain({
      eyebrow: "Workplace",
      title: `${workplace.name} pricing jobs`,
      lede: workplace.intro,
      jobs: matched,
      depth: 1,
      hideWorkplace: true,
    }),
  }));
}

for (const job of jobs) {
  await writePage(`jobs/${job.slug}/index.html`, jobPage(job));
}

await writePage("404.html", page({
  title: "Page not found | PricingRoles",
  description: "That page is not on PricingRoles.",
  path: "404.html",
  main: `<section class="page"><h1>That page is not here.</h1><p class="lede">The role may have closed. The live list is on the homepage.</p><p><a class="button" href="${rel(1, "")}">Back to open roles</a></p></section>`,
  robots: "noindex",
}));

await writeFile(join(dist, "sitemap.xml"), sitemap(pages));
await writeFile(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
await writeFile(join(dist, "CNAME"), "pricingroles.com\n");

console.log(`Built ${pages.length} pages and ${jobs.length} job profiles in dist/`);

async function writePage(relativePath, html) {
  const file = relativePath === "" ? join(dist, "index.html") : join(dist, relativePath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  const publicPath = relativePath === "" ? "" : relativePath.replace(/index\.html$/, "");
  if (!relativePath.endsWith("404.html")) pages.push(publicPath);
}

function page({ title, description, path, main, jsonLd, locked = {}, robots = "index,follow" }) {
  const depth = !path || path === "404.html" ? 0 : path.split("/").filter(Boolean).length;
  const canonical = path ? `${SITE}/${path}` : `${SITE}/`;
  const json = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:site_name" content="PricingRoles">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#0e6b4d">
  <link rel="icon" href="${rel(depth, "assets/favicon.svg")}" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,650&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${rel(depth, "assets/styles.css")}">
  ${json}
</head>
<body data-category="${escapeHtml(locked.category || "")}" data-workplace="${escapeHtml(locked.workplace || "")}">
  <a class="skip" href="#content">Skip to content</a>
  ${header(depth, path)}
  <main id="content">${main}</main>
  ${footer(depth)}
  <script src="${rel(depth, "assets/app.js")}"></script>
</body>
</html>
`;
}

function header(depth, path) {
  const current = (href) => (path === href ? ` aria-current="page"` : "");
  return `<header class="wrap header">
    <a class="brand" href="${rel(depth, "")}">
      <span class="brand-mark" aria-hidden="true"><span></span></span>
      PricingRoles
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="${rel(depth, "")}"${current("")}>Roles</a>
      <a href="${rel(depth, "remote/")}"${current("remote/")}>Remote</a>
      <a href="${rel(depth, "about/")}"${current("about/")}>About</a>
      <a href="${rel(depth, "post-a-job/")}"${current("post-a-job/")}>Post a job</a>
    </nav>
  </header>`;
}

function footer(depth) {
  const cats = CATEGORIES.map((category) => `<a href="${rel(depth, `category/${category.slug}/`)}">${escapeHtml(category.name)}</a>`).join("");
  return `<footer class="footer">
    <div class="wrap footer-grid">
      <div>
        <strong class="brand">PricingRoles</strong>
        <p>Pricing, monetization, deal desk, packaging, and revenue strategy roles, linked back to the company that posted them.</p>
        <p class="fine">Listings refreshed ${escapeHtml(generatedLabel)}.</p>
      </div>
      <nav class="footer-links" aria-label="Categories">${cats}</nav>
      <div>
        <h2>New pricing roles, weekly</h2>
        <p>A short list of roles that opened this week. No essays.</p>
        <form data-todo-form action="#newsletter">
          <label for="newsletter-email">Email</label>
          <div class="newsletter">
            <input id="newsletter-email" name="email" type="email" required placeholder="you@company.com" autocomplete="email">
            <button type="submit">Get the list</button>
          </div>
          <p class="note" data-todo-status hidden>TODO: connect this signup to Beehiiv.</p>
        </form>
        <p class="fine">TODO: Beehiiv is not connected. Submitting does not add you to a list.</p>
      </div>
    </div>
  </footer>`;
}

function homeMain() {
  return `<section class="wrap hero">
    <p class="eyebrow">For pricing people</p>
    <h1>Pricing roles, without the noise.</h1>
    <p class="lede">Analyst through VP. Monetization, deal desk, packaging, and revenue strategy. Each role links straight to the company posting.</p>
    <ul class="stats">
      <li>${jobs.length} open ${jobs.length === 1 ? "role" : "roles"}</li>
      <li>${data.companiesWithRoles} companies hiring</li>
      <li>${data.companiesTracked} companies tracked</li>
      <li>Updated ${escapeHtml(generatedLabel)}</li>
    </ul>
  </section>
  <section class="wrap">${filtersHtml(0)}${toolbar(jobs.length)}${jobList(jobs, 0)}</section>`;
}

function landingMain({ eyebrow, title, lede, jobs: matched, depth, hideWorkplace = false }) {
  return `<section class="wrap hero">
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(lede)}</p>
  </section>
  <section class="wrap">${filtersHtml(depth, { hideWorkplace })}${toolbar(matched.length)}${jobList(matched, depth)}</section>`;
}

function aboutMain() {
  return `<section class="wrap page">
    <p class="eyebrow">About</p>
    <h1>A board for people who price.</h1>
    <div class="prose">
      <p>PricingRoles lists open roles in pricing, monetization, deal desk, packaging, and revenue strategy. The audience is pricing professionals, from analysts to heads of pricing.</p>
      <p>Roles are read from public Greenhouse, Lever, and Ashby job boards. PricingRoles does not log in, and it does not repost a private careers site. The apply link goes to the company’s own posting.</p>
      <p>Titles are filtered. Retail pricing clerks and generic sales roles that only mention revenue are left out. Postings older than 60 days are dropped. A company is tracked when it is a software, AI, fintech, or marketplace business that hires this kind of work.</p>
      <p>Paid featured listings are separate from that feed. They are described on the post a job page and are not switched on yet.</p>
    </div>
  </section>`;
}

function postMain() {
  return `<section class="wrap page split">
    <div>
      <p class="eyebrow">For employers</p>
      <h1>Post a pricing role.</h1>
      <p class="price">$99 <span>for 30 days</span></p>
      <p class="lede">A featured listing on PricingRoles, in addition to whatever your own job board already does.</p>
      <ul class="checklist">
        <li>Shown on the homepage and the matching category page.</li>
        <li>Included in the weekly new-roles note once that list is connected.</li>
        <li>Links to your own application page. PricingRoles does not collect candidates.</li>
      </ul>
    </div>
    <form class="panel form-grid" data-todo-form action="#post-a-job">
      <p class="note">TODO: payments and the listing queue are not connected. This form does not submit anywhere.</p>
      <div>
        <label for="company">Company</label>
        <input id="company" name="company" required autocomplete="organization">
      </div>
      <div>
        <label for="role">Role title</label>
        <input id="role" name="title" required>
      </div>
      <div class="form-row">
        <div>
          <label for="job-location">Job location</label>
          <input id="job-location" name="location" required>
        </div>
        <div>
          <label for="job-workplace">Workplace</label>
          <select id="job-workplace" name="workplace">
            <option>Remote</option>
            <option>Hybrid</option>
            <option>Onsite</option>
          </select>
        </div>
      </div>
      <div>
        <label for="apply">Link to the role</label>
        <input id="apply" name="applyUrl" type="url" required placeholder="https://">
      </div>
      <div>
        <label for="email">Work email</label>
        <input id="email" name="email" type="email" required autocomplete="email">
      </div>
      <div>
        <label for="comp">Salary range, if you want it shown</label>
        <input id="comp" name="salary" placeholder="$150,000–$180,000">
      </div>
      <div>
        <label for="notes">Notes</label>
        <textarea id="notes" name="notes"></textarea>
      </div>
      <button type="submit">Continue to checkout</button>
      <p class="note" data-todo-status hidden>TODO: payments and the listing queue are not connected yet.</p>
    </form>
  </section>`;
}

function jobPage(job) {
  const category = categoryMeta(job.category);
  const seniority = seniorityMeta(job.seniority);
  const workplace = workplaceMeta(job.workplace);
  const salary = formatSalary(job);
  const related = jobs.filter((other) => other.category === job.category && other.id !== job.id).slice(0, 4);
  const description = job.description
    ? job.description.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("\n")
    : `<p>${escapeHtml(job.title)} at ${escapeHtml(job.company)}. The public posting did not include a description beyond the title.</p>`;
  const canonical = `${SITE}/jobs/${job.slug}/`;
  const main = `<article class="wrap job-hero">
    <p class="crumbs"><a href="../..">Roles</a> / <a href="../../category/${job.category}/">${escapeHtml(category?.name || "Pricing")}</a></p>
    <h1>${escapeHtml(job.title)}</h1>
    <p class="lede">${escapeHtml(job.company)}</p>
    <div class="chips">
      <span>${escapeHtml(seniority?.name || "")}</span>
      <span>${escapeHtml(workplace?.name || "Workplace not listed")}</span>
      <span>${escapeHtml(job.location)}</span>
      <span>Posted ${escapeHtml(formatDate(job.postedAt))}</span>
    </div>
  </article>
  <div class="wrap job-layout">
    <div class="prose">${description}
      <h2>More ${escapeHtml(category?.name || "pricing")} roles</h2>
      <div class="related">${related.length ? related.map((other) => `<a href="../${other.slug}/"><strong>${escapeHtml(other.title)}</strong><br>${escapeHtml(other.company)}</a>`).join("") : "<p>No other open roles in this category right now.</p>"}</div>
    </div>
    <aside class="apply-card">
      ${salary ? `<p class="salary-lg">${escapeHtml(salary)}</p>` : `<p>Salary not listed on the company posting.</p>`}
      <p>${escapeHtml(job.location)} · ${escapeHtml(workplace?.name || "Workplace not listed")}</p>
      <a class="button" href="${escapeHtml(job.applyUrl)}" rel="noopener noreferrer">Apply at ${escapeHtml(job.company)}</a>
      <p class="fine">Opens the company’s posting.</p>
    </aside>
  </div>`;
  return page({
    title: `${job.title} at ${job.company} | PricingRoles`,
    description: `${job.title} at ${job.company}. ${job.location}. ${category?.name || "Pricing"} role on PricingRoles.`,
    path: `jobs/${job.slug}/`,
    main,
    jsonLd: jobPostingJsonLd(job, canonical, Date.parse(data.generatedAt)),
  });
}

function filtersHtml(depth, { hideWorkplace = false } = {}) {
  const categories = CATEGORIES.filter((category) => jobs.some((job) => job.category === category.slug));
  const levels = SENIORITY.filter((level) => jobs.some((job) => job.seniority === level.slug));
  const places = WORKPLACES.filter((place) => jobs.some((job) => job.workplace === place.slug));
  if (jobs.some((job) => job.workplace === "unknown")) places.push({ slug: "unknown", name: "Not listed" });
  return `<form class="panel filters" id="filters">
    <div>
      <label for="q">Search</label>
      <input id="q" name="q" type="search" placeholder="Title, company, or location" autocomplete="off">
    </div>
    ${depth === 0 ? selectHtml("category", "Category", categories) : ""}
    ${selectHtml("seniority", "Seniority", levels)}
    ${hideWorkplace ? "" : selectHtml("workplace", "Workplace", places)}
    <div>
      <label for="salary">Salary</label>
      <label class="salary-toggle"><input id="salary" name="salary" type="checkbox"> Has salary</label>
    </div>
  </form>`;
}

function selectHtml(id, label, options) {
  const opts = options.map((option) => `<option value="${escapeHtml(option.slug)}">${escapeHtml(option.name)}</option>`).join("");
  return `<div><label for="${id}">${label}</label><select id="${id}" name="${id}"><option value="">Any</option>${opts}</select></div>`;
}

function toolbar(total) {
  return `<div class="toolbar"><p><strong id="result-count">${total}</strong> showing</p><p class="fine">Sorted by newest posting.</p></div>`;
}

function jobList(list, depth) {
  if (!list.length) {
    return `<p class="empty" id="empty">No open roles in this view right now. <a href="${rel(depth, "")}">See every role</a>.</p>`;
  }
  return `<div class="jobs">${list.map((job) => jobCard(job, depth)).join("\n")}</div><p class="empty" id="empty" hidden>No roles match those filters.</p>`;
}

function jobCard(job, depth) {
  const category = categoryMeta(job.category);
  const seniority = seniorityMeta(job.seniority);
  const workplace = workplaceMeta(job.workplace);
  const salary = formatSalary(job, { compact: true });
  const search = escapeHtml(`${job.title} ${job.company} ${job.location} ${category?.name || ""} ${seniority?.name || ""}`.toLowerCase());
  return `<a class="job" href="${rel(depth, `jobs/${job.slug}/`)}" data-job data-category="${escapeHtml(job.category)}" data-seniority="${escapeHtml(job.seniority)}" data-workplace="${escapeHtml(job.workplace)}" data-salary="${job.salaryText ? "1" : "0"}" data-search="${search}">
    <div>
      <div class="job-title">${escapeHtml(job.title)}</div>
      <div class="job-meta">${escapeHtml(job.company)} · ${escapeHtml(job.location)} · ${escapeHtml(workplace?.name || "Workplace not listed")} · ${escapeHtml(formatDate(job.postedAt))}</div>
      <div class="chips"><span>${escapeHtml(category?.name || "Pricing")}</span><span>${escapeHtml(seniority?.name || "")}</span></div>
    </div>
    <div class="job-salary">${salary ? escapeHtml(salary) : ""}</div>
  </a>`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

function rel(depth, path) {
  if (!path) return depth === 0 ? "./" : "../".repeat(depth);
  return `${"../".repeat(depth)}${path}`;
}

function sitemap(paths) {
  const lastmod = String(data.generatedAt).slice(0, 10);
  const urls = paths.map((path) => {
    const loc = path ? `${SITE}/${path}` : `${SITE}/`;
    return `  <url><loc>${escapeHtml(loc)}</loc><lastmod>${lastmod}</lastmod></url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
