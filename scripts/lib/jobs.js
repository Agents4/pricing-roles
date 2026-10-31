import { classifyTitle, isFresh, normalizeTitle } from "./classify.js";
import { emptySalary } from "./salary.js";
import { slugify } from "./text.js";
import { workplaceFromSignals } from "./workplace.js";

export function buildJob(input, now = Date.now()) {
  const title = normalizeTitle(input.title);
  const classification = classifyTitle(title, input.description);
  if (!classification) return null;
  if (!input.postedAt || !isFresh(input.postedAt, now)) return null;
  const applyUrl = String(input.applyUrl || "").trim();
  if (!/^https?:\/\//i.test(applyUrl)) return null;

  const salary = input.salary?.salaryText ? input.salary : emptySalary();
  const location = String(input.location || "").replace(/\s+/g, " ").trim();
  const workplace = input.workplace || workplaceFromSignals({
    location,
    title,
    workplaceType: input.workplaceType,
    isRemote: input.isRemote,
  });
  const posted = new Date(input.postedAt);
  if (Number.isNaN(posted.getTime())) return null;

  return {
    id: `${input.ats}:${input.company.token}:${input.sourceId}`,
    slug: "",
    title,
    company: input.company.name,
    companyToken: input.company.token,
    ats: input.ats,
    sector: input.company.sector || "",
    location: location || "Unspecified",
    workplace,
    salaryMin: salary.salaryMin ?? null,
    salaryMax: salary.salaryMax ?? null,
    salaryCurrency: salary.salaryCurrency ?? null,
    salaryInterval: salary.salaryInterval ?? null,
    salaryText: salary.salaryText ?? null,
    postedAt: posted.toISOString(),
    applyUrl,
    category: classification.category,
    seniority: classification.seniority,
    description: String(input.description || "").trim(),
  };
}

export function dedupeJobs(jobs) {
  const sorted = jobs
    .slice()
    .sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)) || a.id.localeCompare(b.id));
  const seenUrl = new Set();
  const seenKey = new Set();
  const kept = [];
  for (const job of sorted) {
    const url = job.applyUrl.trim().toLowerCase();
    const key = [job.company, job.title, job.location, job.workplace]
      .map((part) => String(part).toLowerCase().replace(/\s+/g, " ").trim())
      .join("|");
    if (seenUrl.has(url) || seenKey.has(key)) continue;
    seenUrl.add(url);
    seenKey.add(key);
    kept.push(job);
  }
  return kept;
}

function clipSlug(value, max) {
  const slug = slugify(value);
  if (slug.length <= max) return slug;
  const cut = slug.lastIndexOf("-", max);
  return (cut > 12 ? slug.slice(0, cut) : slug.slice(0, max)).replace(/-+$/, "");
}

export function assignSlugs(jobs) {
  const used = new Set();
  for (const job of jobs) {
    const source = String(job.id.split(":").pop() || job.id);
    const base = [clipSlug(job.title, 52), clipSlug(job.company, 24), clipSlug(source, 28)]
      .filter(Boolean)
      .join("-");
    let slug = base || slugify(source) || "role";
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    job.slug = slug;
  }
  return jobs;
}
