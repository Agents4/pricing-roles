import { readFile, writeFile } from "node:fs/promises";
import { boardUrl, fetchJson, mapPool } from "./lib/http.js";
import { buildJob, assignSlugs, dedupeJobs } from "./lib/jobs.js";
import { classifyTitle } from "./lib/classify.js";
import { htmlToText } from "./lib/text.js";
import {
  emptySalary,
  parseSalaryFromText,
  salaryFromAshby,
  salaryFromGreenhouse,
  salaryFromLever,
} from "./lib/salary.js";

const companiesPath = new URL("../data/companies.json", import.meta.url);
const jobsPath = new URL("../data/jobs.json", import.meta.url);
const { companies } = JSON.parse(await readFile(companiesPath, "utf8"));
const now = Date.now();

const results = await mapPool(companies, 6, (company) => ingestCompany(company, now));

const jobs = [];
const errors = [];
for (const result of results) {
  if (result.error) {
    errors.push(result);
    continue;
  }
  jobs.push(...result.jobs);
}

const unique = assignSlugs(dedupeJobs(jobs));
const companiesWithRoles = new Set(unique.map((job) => job.company)).size;
const payload = {
  generatedAt: new Date(now).toISOString(),
  companiesTracked: companies.length,
  companiesReached: companies.length - errors.length,
  companiesWithRoles,
  jobCount: unique.length,
  jobs: unique,
};

await writeFile(jobsPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Wrote ${unique.length} jobs from ${companiesWithRoles} companies. Boards reached ${payload.companiesReached}/${companies.length}.`,
);

if (payload.companiesReached === 0 || unique.length === 0) {
  process.exit(1);
}

async function ingestCompany(company, nowMs) {
  try {
    let result;
    if (company.ats === "greenhouse") result = await ingestGreenhouse(company, nowMs);
    else if (company.ats === "lever") result = await ingestLever(company, nowMs);
    else if (company.ats === "ashby") result = await ingestAshby(company, nowMs);
    else result = { company, error: `Unknown ATS ${company.ats}`, jobs: [] };
    if (result.error) {
      console.error(`FAIL ${company.name} (${company.ats}:${company.token}): ${result.error}`);
    } else {
      console.log(`ok ${company.name}: scanned ${result.scanned}, title matches ${result.matched}, kept ${result.jobs.length}`);
    }
    return result;
  } catch (error) {
    console.error(`FAIL ${company.name} (${company.ats}:${company.token}): ${error.message}`);
    return { company, error: error.message, jobs: [] };
  }
}

async function ingestGreenhouse(company, nowMs) {
  const list = await fetchJson(boardUrl(company), { timeoutMs: 60000 });
  const postings = Array.isArray(list?.jobs) ? list.jobs : [];
  const matches = postings.filter((posting) => posting?.id && posting.title && classifyTitle(posting.title));
  const details = await mapPool(matches, 4, async (posting) => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.token)}/jobs/${posting.id}?pay_transparency=true`;
    try {
      return await fetchJson(url, { timeoutMs: 30000 });
    } catch {
      return posting;
    }
  });
  const jobs = [];
  for (const posting of details) {
    const description = htmlToText(posting.content || "");
    const salary = salaryFromGreenhouse(posting.pay_input_ranges) || parseSalaryFromText(description) || emptySalary();
    const job = buildJob({
      company,
      ats: "greenhouse",
      sourceId: posting.id,
      title: posting.title,
      location: posting.location?.name || "",
      postedAt: posting.first_published || posting.updated_at || null,
      applyUrl: posting.absolute_url,
      description,
      salary,
    }, nowMs);
    if (job) jobs.push(job);
  }
  return { company, scanned: postings.length, matched: matches.length, jobs };
}

async function ingestLever(company, nowMs) {
  const list = await fetchJson(boardUrl(company), { timeoutMs: 60000 });
  const postings = Array.isArray(list) ? list : [];
  const jobs = [];
  let matched = 0;
  for (const posting of postings) {
    if (!posting?.text || !classifyTitle(posting.text)) continue;
    matched += 1;
    const description = (posting.descriptionPlain || htmlToText(posting.description || "")).slice(0, 5000);
    const created = posting.createdAt == null
      ? null
      : new Date(posting.createdAt < 1e12 ? posting.createdAt * 1000 : posting.createdAt).toISOString();
    const job = buildJob({
      company,
      ats: "lever",
      sourceId: posting.id,
      title: posting.text,
      location: posting.categories?.location || (posting.categories?.allLocations || []).join("; "),
      workplaceType: posting.workplaceType,
      postedAt: created,
      applyUrl: posting.hostedUrl || posting.applyUrl,
      description,
      salary: salaryFromLever(posting) || emptySalary(),
    }, nowMs);
    if (job) jobs.push(job);
  }
  return { company, scanned: postings.length, matched, jobs };
}

async function ingestAshby(company, nowMs) {
  const list = await fetchJson(boardUrl(company), { timeoutMs: 60000 });
  const postings = Array.isArray(list?.jobs) ? list.jobs : [];
  const jobs = [];
  let matched = 0;
  for (const posting of postings) {
    if (posting?.isListed === false) continue;
    if (!posting?.title || !classifyTitle(posting.title)) continue;
    matched += 1;
    const description = (posting.descriptionPlain || htmlToText(posting.descriptionHtml || "")).slice(0, 5000);
    const job = buildJob({
      company,
      ats: "ashby",
      sourceId: posting.id,
      title: posting.title,
      location: posting.location || "",
      workplaceType: posting.workplaceType,
      isRemote: posting.isRemote === true,
      postedAt: posting.publishedAt || null,
      applyUrl: posting.jobUrl || posting.applyUrl,
      description,
      salary: salaryFromAshby(posting.compensation) || emptySalary(),
    }, nowMs);
    if (job) jobs.push(job);
  }
  return { company, scanned: postings.length, matched, jobs };
}
