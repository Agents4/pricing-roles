import { classifyTitle } from "./classify.js";
import { buildJob } from "./jobs.js";
import { emptySalary, parseSalaryFromText } from "./salary.js";
import { htmlToText } from "./text.js";

export const ORACLE_SEARCHES = ["pricing", "revenue management", "yield", "revenue manager", "revenue strategy"];
export const ORACLE_PAGE_SIZE = 25;
export const ORACLE_MAX_PAGES = 3;
export const ORACLE_PAUSE_MS = 500;

const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+oraclecloud\.com$/;
const SITE_RE = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const ID_RE = /^\d{1,20}$/;
const PAY_PROMPT_RE = /pay|salary|wage|compensation|remuneration/i;

function oracleParts(company) {
  const host = String(company?.host || "").trim().toLowerCase();
  const site = String(company?.site || "").trim();
  if (!HOST_RE.test(host) || host.includes("..") || !SITE_RE.test(site)) {
    throw new Error(`Invalid Oracle Cloud HCM board config for ${company?.name || host || "company"}`);
  }
  return { origin: `https://${host}`, site };
}

function safeJobId(id) {
  const jobId = String(id || "").trim();
  if (!ID_RE.test(jobId)) throw new Error(`Unexpected Oracle requisition id: ${jobId}`);
  return jobId;
}

function assertKeyword(keyword) {
  if (!ORACLE_SEARCHES.includes(keyword)) throw new Error("Unexpected Oracle search keyword");
}

function assertPage(offset, limit) {
  if (!Number.isInteger(offset) || offset < 0 || offset > ORACLE_PAGE_SIZE * ORACLE_MAX_PAGES) {
    throw new Error("Unexpected Oracle search offset");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > ORACLE_PAGE_SIZE) {
    throw new Error("Unexpected Oracle search limit");
  }
}

function collapse(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function oracleWorkplaceType(type, code) {
  const blob = `${type || ""} ${code || ""}`.toLowerCase().replace(/[\s_-]+/g, "");
  if (blob.includes("hybrid")) return "hybrid";
  if (blob.includes("remote")) return "remote";
  if (blob.includes("onsite")) return "onsite";
  return "";
}

export function oracleLocation(row) {
  const names = [];
  const push = (value) => {
    const name = collapse(value);
    if (!name) return;
    if (names.some((existing) => existing.toLowerCase() === name.toLowerCase())) return;
    names.push(name);
  };
  push(row?.PrimaryLocation);
  const extra = Array.isArray(row?.secondaryLocations) ? row.secondaryLocations : [];
  for (const loc of extra) push(loc?.Name);
  return names.join("; ");
}

export function oracleSearchUrl(company, keyword, offset = 0, limit = ORACLE_PAGE_SIZE) {
  const { origin, site } = oracleParts(company);
  assertKeyword(keyword);
  assertPage(offset, limit);
  const finder = `findReqs;siteNumber=${site},keyword="${keyword}",limit=${limit},offset=${offset}`;
  const url = new URL(`${origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`);
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("expand", "requisitionList.secondaryLocations");
  url.searchParams.set("finder", finder);
  return url.href;
}

export function oracleProbeUrl(company) {
  return oracleSearchUrl(company, ORACLE_SEARCHES[0], 0, 1);
}

export function oracleDetailUrl(company, id) {
  const { origin, site } = oracleParts(company);
  const jobId = safeJobId(id);
  const finder = `ById;Id="${jobId}",siteNumber=${site}`;
  const url = new URL(`${origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`);
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("expand", "all");
  url.searchParams.set("finder", finder);
  return url.href;
}

export function oracleApplyUrl(company, id) {
  const { origin, site } = oracleParts(company);
  const jobId = safeJobId(id);
  return `${origin}/hcmUI/CandidateExperience/en/sites/${encodeURIComponent(site)}/job/${encodeURIComponent(jobId)}`;
}

export function oracleLooksLive(status, prefix) {
  if (status !== 200) return false;
  const text = String(prefix || "").trim();
  return text.startsWith("{") && (/"requisitionList"\s*:/.test(text) || /"TotalJobsCount"\s*:/.test(text));
}

export function normalizeOraclePosting(row) {
  const title = collapse(row?.Title);
  const id = String(row?.Id || "").trim();
  if (!title || !ID_RE.test(id)) return null;
  return {
    id,
    title,
    location: oracleLocation(row),
    postedOn: String(row?.PostedDate || ""),
    workplaceType: oracleWorkplaceType(row?.WorkplaceType, row?.WorkplaceTypeCode),
  };
}

export function parseOracleSearch(payload) {
  const item = Array.isArray(payload?.items) ? payload.items[0] : null;
  const rows = Array.isArray(item?.requisitionList) ? item.requisitionList : [];
  const postings = rows.map((row) => normalizeOraclePosting(row)).filter(Boolean);
  const total = Number(item?.TotalJobsCount);
  return { total: Number.isFinite(total) ? total : postings.length, count: rows.length, postings };
}

export function parseOraclePostedAt(postedOn, startDate) {
  const start = String(startDate || "").trim();
  if (start) {
    const parsed = Date.parse(start);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const date = String(postedOn || "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function oraclePayText(detail) {
  const fields = Array.isArray(detail?.requisitionFlexFields) ? detail.requisitionFlexFields : [];
  const lines = [];
  for (const field of fields) {
    const prompt = collapse(field?.Prompt || field?.SegmentCode);
    const value = collapse(field?.Value);
    if (!prompt || !value || !PAY_PROMPT_RE.test(prompt)) continue;
    lines.push(`${prompt}: ${value}`);
  }
  return lines.join("\n");
}

function oracleDescriptionHtml(detail) {
  const parts = [
    detail?.ExternalDescriptionStr,
    detail?.ExternalResponsibilitiesStr,
    detail?.ExternalQualificationsStr,
  ].filter(Boolean);
  if (!parts.length && detail?.ShortDescriptionStr) parts.push(detail.ShortDescriptionStr);
  return parts.join("\n");
}

export function oracleJobInput(company, posting, detail) {
  const info = detail && typeof detail === "object" ? detail : {};
  const detailLocations = Array.isArray(info.secondaryLocations) ? info.secondaryLocations : [];
  const hasDetailLocation = Boolean(collapse(info.PrimaryLocation) || detailLocations.some((loc) => collapse(loc?.Name)));
  return {
    company,
    ats: "oracle",
    sourceId: String(info.Id || posting.id),
    title: collapse(info.Title || posting.title),
    location: hasDetailLocation ? oracleLocation(info) : posting.location,
    workplaceType: oracleWorkplaceType(info.WorkplaceType, info.WorkplaceTypeCode) || posting.workplaceType || "",
    postedAt: parseOraclePostedAt(posting.postedOn, info.ExternalPostedStartDate),
    applyUrl: oracleApplyUrl(company, info.Id || posting.id),
    description: oracleDescriptionHtml(info),
    payText: oraclePayText(info),
  };
}

export async function ingestOracle(company, nowMs, { fetchJson, sleep, mapPool }) {
  const seen = new Map();
  let requests = 0;

  for (const keyword of ORACLE_SEARCHES) {
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    for (let page = 0; page < ORACLE_MAX_PAGES && offset < total; page += 1) {
      await sleep(ORACLE_PAUSE_MS);
      requests += 1;
      const data = await fetchJson(oracleSearchUrl(company, keyword, offset), {
        timeoutMs: 30000,
        retries: 4,
      });
      const parsed = parseOracleSearch(data);
      total = parsed.total;
      if (parsed.count === 0) break;
      for (const posting of parsed.postings) {
        if (!seen.has(posting.id)) seen.set(posting.id, posting);
      }
      offset += ORACLE_PAGE_SIZE;
    }
  }

  const matches = [...seen.values()].filter((posting) => classifyTitle(posting.title));
  const details = await mapPool(matches, 2, async (posting) => {
    await sleep(ORACLE_PAUSE_MS);
    requests += 1;
    try {
      const payload = await fetchJson(oracleDetailUrl(company, posting.id), { timeoutMs: 30000, retries: 4 });
      const detail = Array.isArray(payload?.items) ? payload.items[0] : null;
      return { posting, detail: detail || null };
    } catch {
      return { posting, detail: null };
    }
  });

  const jobs = [];
  for (const { posting, detail } of details) {
    const input = oracleJobInput(company, posting, detail);
    const salarySource = htmlToText(input.description, 12000);
    const payText = input.payText;
    input.description = htmlToText(input.description);
    delete input.payText;
    input.salary = parseSalaryFromText([salarySource, payText].filter(Boolean).join("\n")) || emptySalary();
    const job = buildJob(input, nowMs);
    if (job) jobs.push(job);
  }

  return { company, scanned: seen.size, matched: matches.length, jobs, requests };
}
