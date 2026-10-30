import { classifyTitle } from "./classify.js";
import { buildJob } from "./jobs.js";
import { emptySalary, parseSalaryFromText } from "./salary.js";
import { htmlToText } from "./text.js";

export const WORKDAY_SEARCHES = ["pricing", "revenue management", "yield", "revenue manager"];
export const WORKDAY_PAGE_SIZE = 20;
export const WORKDAY_MAX_PAGES = 3;
export const WORKDAY_PAUSE_MS = 400;

const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const WD_RE = /^wd\d{1,3}$/;
const SITE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

function workdayParts(company) {
  const tenant = String(company?.tenant || "");
  const wd = String(company?.wd || "");
  const site = String(company?.site || "");
  if (!TENANT_RE.test(tenant) || !WD_RE.test(wd) || !SITE_RE.test(site)) {
    throw new Error(`Invalid Workday board config for ${company?.name || tenant || "company"}`);
  }
  return {
    origin: `https://${tenant}.${wd}.myworkdayjobs.com`,
    tenant,
    site,
  };
}

function safeJobPath(externalPath) {
  const path = String(externalPath || "");
  if (!path.startsWith("/job/") || path.includes("..") || path.includes("://") || path.includes("\\")) {
    throw new Error(`Unexpected Workday job path: ${path}`);
  }
  return path;
}

export function workdaySearchUrl(company) {
  const { origin, tenant, site } = workdayParts(company);
  return `${origin}/wday/cxs/${tenant}/${encodeURIComponent(site)}/jobs`;
}

export function workdayDetailUrl(company, externalPath) {
  const { origin, tenant, site } = workdayParts(company);
  return `${origin}/wday/cxs/${tenant}/${encodeURIComponent(site)}${safeJobPath(externalPath)}`;
}

export function workdayApplyUrl(company, externalPath) {
  const { origin, site } = workdayParts(company);
  return `${origin}/${encodeURIComponent(site)}${safeJobPath(externalPath)}`;
}

export function workdaySearchBody(searchText, offset, limit = WORKDAY_PAGE_SIZE) {
  return {
    appliedFacets: {},
    limit,
    offset,
    searchText,
  };
}

export function workdayProbeBody() {
  return workdaySearchBody(WORKDAY_SEARCHES[0], 0, 1);
}

export function workdayLooksLive(status, prefix) {
  if (status !== 200) return false;
  const text = String(prefix || "").trim();
  return text.startsWith("{") && (/"jobPostings"\s*:/.test(text) || /"total"\s*:/.test(text));
}

export function normalizeWorkdayPosting(row) {
  const title = String(row?.title || "").replace(/\s+/g, " ").trim();
  const externalPath = String(row?.externalPath || "");
  if (!title || !externalPath.startsWith("/job/")) return null;
  const bullet = Array.isArray(row?.bulletFields) ? row.bulletFields.find(Boolean) : "";
  return {
    title,
    externalPath,
    location: String(row?.locationsText || "").replace(/\s+/g, " ").trim(),
    postedOn: String(row?.postedOn || ""),
    sourceId: String(bullet || externalPath),
  };
}

export function parseWorkdaySearch(payload) {
  const rows = Array.isArray(payload?.jobPostings) ? payload.jobPostings : [];
  const postings = rows.map((row) => normalizeWorkdayPosting(row)).filter(Boolean);
  const total = Number(payload?.total);
  return { total: Number.isFinite(total) ? total : postings.length, postings };
}

export function parseWorkdayPostedAt(postedOn, startDate, now = Date.now()) {
  const date = String(startDate || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const text = String(postedOn || "").trim();
  if (/^posted today$/i.test(text)) return new Date(now).toISOString();
  if (/^posted yesterday$/i.test(text)) return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const days = text.match(/^posted\s+(\d+)\s+days?\s+ago$/i);
  if (!days) return null;
  const n = Number(days[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
}

export function workdayJobInput(company, posting, detail, now = Date.now()) {
  const info = detail?.jobPostingInfo || {};
  const country = info.country?.descriptor ? String(info.country.descriptor).replace(/\s+/g, " ").trim() : "";
  let location = String(info.location || posting.location || "").replace(/\s+/g, " ").trim();
  if (country && !location.toLowerCase().includes(country.toLowerCase())) {
    location = location ? `${location}, ${country}` : country;
  }
  return {
    company,
    ats: "workday",
    sourceId: String(info.jobPostingId || info.jobReqId || posting.sourceId || posting.externalPath),
    title: String(info.title || posting.title || "").replace(/\s+/g, " ").trim(),
    location,
    postedAt: parseWorkdayPostedAt(info.postedOn || posting.postedOn, info.startDate, now),
    applyUrl: String(info.externalUrl || workdayApplyUrl(company, posting.externalPath)),
    description: String(info.jobDescription || ""),
  };
}

export async function ingestWorkday(company, nowMs, { fetchJson, sleep, mapPool }) {
  const url = workdaySearchUrl(company);
  const seen = new Map();
  let requests = 0;

  for (const searchText of WORKDAY_SEARCHES) {
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    for (let page = 0; page < WORKDAY_MAX_PAGES && offset < total; page += 1) {
      await sleep(WORKDAY_PAUSE_MS);
      requests += 1;
      const data = await fetchJson(url, {
        method: "POST",
        body: workdaySearchBody(searchText, offset),
        timeoutMs: 30000,
        retries: 4,
      });
      const parsed = parseWorkdaySearch(data);
      total = parsed.total;
      if (parsed.postings.length === 0) break;
      for (const posting of parsed.postings) {
        if (!seen.has(posting.externalPath)) seen.set(posting.externalPath, posting);
      }
      offset += WORKDAY_PAGE_SIZE;
    }
  }

  const matches = [...seen.values()].filter((posting) => classifyTitle(posting.title));
  const details = await mapPool(matches, 2, async (posting) => {
    await sleep(WORKDAY_PAUSE_MS);
    requests += 1;
    try {
      const detail = await fetchJson(workdayDetailUrl(company, posting.externalPath), { timeoutMs: 30000, retries: 4 });
      return { posting, detail };
    } catch {
      return { posting, detail: null };
    }
  });

  const jobs = [];
  for (const { posting, detail } of details) {
    const input = workdayJobInput(company, posting, detail, nowMs);
    input.description = htmlToText(input.description);
    input.salary = parseSalaryFromText(input.description) || emptySalary();
    const job = buildJob(input, nowMs);
    if (job) jobs.push(job);
  }

  return { company, scanned: seen.size, matched: matches.length, jobs, requests };
}
