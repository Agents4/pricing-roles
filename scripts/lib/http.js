const USER_AGENT = "PricingRoles/1.0 (+https://pricingroles.com)";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(url, { timeoutMs = 45000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { accept: "application/json", "user-agent": USER_AGENT },
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
  return false;
}
