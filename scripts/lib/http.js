import { request as httpsRequest } from "node:https";
import { oracleLooksLive, oracleProbeUrl } from "./oracle.js";
import { workdayLooksLive, workdaySearchUrl } from "./workday.js";

const USER_AGENT = "PricingRoles/1.0 (+https://pricingroles.com)";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWorkdayUrl(url) {
  try {
    return new URL(url).hostname.endsWith(".myworkdayjobs.com");
  } catch {
    return false;
  }
}

function httpsJson(url, { method, body, signal, headers }, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = body == null ? null : Buffer.from(body);
    const { "content-length": _contentLength, ...restHeaders } = headers || {};
    const req = httpsRequest({
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method,
      headers: {
        ...restHeaders,
        ...(payload ? { "content-length": String(payload.length) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const status = res.statusCode || 0;
        const location = res.headers.location;
        const next = Array.isArray(location) ? location[0] : location;
        if (next && status >= 300 && status < 400 && redirectsLeft > 0) {
          const redirectUrl = new URL(next, url).href;
          const sameMethod = status === 307 || status === 308;
          httpsJson(redirectUrl, {
            method: sameMethod ? method : "GET",
            body: sameMethod ? body : undefined,
            signal,
            headers,
          }, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        const raw = Buffer.concat(chunks);
        resolve({
          status,
          ok: status >= 200 && status < 300,
          headers: {
            get(name) {
              const value = res.headers[String(name).toLowerCase()];
              if (Array.isArray(value)) return value[0] ?? null;
              return value ?? null;
            },
          },
          async json() {
            return JSON.parse(raw.toString("utf8"));
          },
          async arrayBuffer() {
            return raw;
          },
        });
      });
    });
    const abort = () => req.destroy(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
    req.on("error", reject);
    req.on("close", () => {
      if (signal) signal.removeEventListener("abort", abort);
    });
    if (payload) req.end(payload);
    else req.end();
  });
}

export async function fetchJson(url, { timeoutMs = 45000, retries = 2, method = "GET", body } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const payload = body == null ? undefined : JSON.stringify(body);
      const headers = {
        accept: "application/json",
        "user-agent": USER_AGENT,
        ...(payload != null ? { "content-type": "application/json" } : {}),
      };
      // Some Workday CXS tenants return HTTP 500 to Node's HTTP/2 fetch.
      // The same POST succeeds over HTTP/1.1.
      const res = isWorkdayUrl(url)
        ? await httpsJson(url, { method, body: payload, signal: ctrl.signal, headers })
        : await fetch(url, {
          method,
          body: payload,
          signal: ctrl.signal,
          redirect: "follow",
          headers,
        });
      if (res.status === 429 || res.status >= 500) {
        await res.arrayBuffer().catch(() => {});
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 800 * (attempt + 1);
        await sleep(Math.min(wait, 12000));
        continue;
      }
      if (!res.ok) {
        const error = new Error(`HTTP ${res.status} for ${url}`);
        error.status = res.status;
        throw error;
      }
      return await res.json();
    } catch (error) {
      if (error.status && error.status < 500) throw error;
      lastError = error;
      if (attempt === retries) break;
      await sleep(600 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/**
 * Read a short prefix and cancel the rest. Used to confirm a board token
 * responds without downloading an entire large job board.
 */
export async function fetchPrefix(url, { timeoutMs = 25000, bytes = 900 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { accept: "application/json", "user-agent": USER_AGENT },
    });
    const reader = res.body?.getReader();
    const chunks = [];
    let total = 0;
    if (reader) {
      while (total < bytes) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      await reader.cancel().catch(() => {});
    }
    const prefix = new TextDecoder().decode(concatBytes(chunks)).slice(0, bytes);
    return { status: res.status, prefix };
  } finally {
    clearTimeout(timer);
  }
}

function concatBytes(chunks) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export function boardUrl(company) {
  const token = encodeURIComponent(company.token);
  if (company.ats === "greenhouse") {
    return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`;
  }
  if (company.ats === "lever") {
    const host = company.region === "eu" ? "https://api.eu.lever.co" : "https://api.lever.co";
    return `${host}/v0/postings/${token}?mode=json`;
  }
  if (company.ats === "ashby") {
    return `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`;
  }
  if (company.ats === "workday") return workdaySearchUrl(company);
  if (company.ats === "oracle") return oracleProbeUrl(company);
  throw new Error(`Unknown ATS: ${company.ats}`);
}

export function boardLooksLive(company, status, prefix) {
  if (status !== 200) return false;
  const text = prefix.trim();
  if (company.ats === "lever") return text.startsWith("[");
  if (company.ats === "greenhouse") return text.startsWith("{") && /"jobs"\s*:/.test(text);
  if (company.ats === "ashby") {
    return text.startsWith("{") && (/"jobs"\s*:/.test(text) || /"apiVersion"\s*:/.test(text));
  }
  if (company.ats === "workday") return workdayLooksLive(status, text);
  if (company.ats === "oracle") return oracleLooksLive(status, text);
  return false;
}
