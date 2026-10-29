const SYMBOL = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  CAD: "CA$",
  AUD: "A$",
};

const SALARY_RE = /(?:(?<cur>USD|EUR|GBP|CAD|AUD|US\$|CA\$|A\$|\$|£|€)\s*)(?<min>\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)(?<mink>\s?[kK])?(?:\s*(?:-|–|—|to|through)\s*(?:(?<cur2>USD|EUR|GBP|CAD|AUD|US\$|CA\$|A\$|\$|£|€)\s*)?(?<max>\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)(?<maxk>\s?[kK])?)?/gi;

export function emptySalary() {
  return {
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryInterval: null,
    salaryText: null,
  };
}

function currencyCode(token) {
  if (!token) return null;
  const value = token.toUpperCase().replace(/\s/g, "");
  if (value === "$" || value === "US$" || value === "USD") return "USD";
  if (value === "£" || value === "GBP") return "GBP";
  if (value === "€" || value === "EUR") return "EUR";
  if (value === "CA$" || value === "CAD") return "CAD";
  if (value === "A$" || value === "AUD") return "AUD";
  return null;
}

function parseAmount(raw, kSuffix) {
  if (!raw) return null;
  const compact = String(raw).replace(/\s/g, "");
  if (kSuffix) {
    const amount = Number(compact.replace(/,/g, ""));
    return Number.isFinite(amount) ? amount * 1000 : null;
  }
  if (/^\d{1,3}(,\d{3})+$/.test(compact)) return Number(compact.replace(/,/g, ""));
  if (/^\d{1,3}(\.\d{3})+$/.test(compact)) return Number(compact.replace(/\./g, ""));
  const amount = Number(compact.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function intervalFromContext(context) {
  const text = context.toLowerCase();
  if (/\b(hour|hr|hourly)\b/.test(text)) return "hour";
  if (/\b(month|monthly|\/mo)\b/.test(text)) return "month";
  if (/\b(year|yearly|annual|annum|\/yr)\b/.test(text)) return "year";
  return null;
}

export function plausibleSalary(min, max, interval) {
  const low = min ?? max;
  const high = max ?? min;
  if (low == null || high == null) return false;
  if (high < low) return false;
  if (interval === "hour") return low >= 12 && high <= 500;
  if (interval === "month") return low >= 1500 && high <= 80000;
  return low >= 30000 && high <= 1500000;
}

export function makeSalary(min, max, currency = "USD", interval = "year") {
  let low = min == null ? null : Number(min);
  let high = max == null ? null : Number(max);
  if (low != null && high != null && high < low) [low, high] = [high, low];
  if (low == null && high == null) return null;
  if (!plausibleSalary(low, high, interval)) return null;
  const record = {
    salaryMin: low,
    salaryMax: high,
    salaryCurrency: currency || "USD",
    salaryInterval: interval || "year",
    salaryText: null,
  };
  record.salaryText = formatSalary(record);
  return record;
}

export function formatSalary(record, { compact = false } = {}) {
  if (!record || (record.salaryMin == null && record.salaryMax == null)) return null;
  const currency = record.salaryCurrency || "USD";
  const symbol = SYMBOL[currency] || `${currency} `;
  const num = (amount) => {
    if (compact && record.salaryInterval !== "hour" && amount >= 10000) {
      const thousands = amount / 1000;
      const body = thousands >= 100 || Number.isInteger(thousands)
        ? String(Math.round(thousands))
        : thousands.toFixed(1).replace(/\.0$/, "");
      return `${symbol}${body}k`;
    }
    return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
  };
  const min = record.salaryMin;
  const max = record.salaryMax;
  let text;
  if (min != null && max != null && Math.round(min) !== Math.round(max)) text = `${num(min)}–${num(max)}`;
  else text = num(min ?? max);
  if (record.salaryInterval === "hour") text += "/hr";
  if (record.salaryInterval === "month") text += "/mo";
  return text;
}

function inferInterval(min, max, explicit, kSuffix) {
  if (explicit) return explicit;
  if (kSuffix) return "year";
  const high = Math.max(min ?? 0, max ?? 0);
  if (high >= 20000) return "year";
  return null;
}

export function parseSalaryFromText(text) {
  if (!text) return null;
  const found = [];
  const source = String(text).slice(0, 12000);
  for (const match of source.matchAll(SALARY_RE)) {
    const min = parseAmount(match.groups.min, match.groups.mink);
    const max = parseAmount(match.groups.max, match.groups.maxk);
    if (min == null && max == null) continue;
    const currency = currencyCode(match.groups.cur) || currencyCode(match.groups.cur2) || "USD";
    const start = Math.max(0, match.index - 40);
    const end = Math.min(source.length, match.index + match[0].length + 48);
    const explicit = intervalFromContext(source.slice(start, end));
    const interval = inferInterval(min, max, explicit, Boolean(match.groups.mink || match.groups.maxk));
    if (!interval) continue;
    const record = makeSalary(min, max, currency, interval);
    if (record) found.push(record);
  }
  return pickSalary(found);
}

export function salaryFromGreenhouse(ranges) {
  if (!Array.isArray(ranges)) return null;
  const found = [];
  for (const range of ranges) {
    const min = range?.min_cents == null ? null : range.min_cents / 100;
    const max = range?.max_cents == null ? null : range.max_cents / 100;
    const blob = `${range?.title || ""} ${range?.blurb || ""}`;
    let interval = "year";
    if (/hour/i.test(blob)) interval = "hour";
    else if (/month/i.test(blob)) interval = "month";
    const record = makeSalary(min, max, (range?.currency_type || "USD").toUpperCase(), interval);
    if (record) found.push(record);
  }
  return pickSalary(found);
}

export function salaryFromAshby(compensation) {
  if (!compensation || typeof compensation !== "object") return null;
  const components = [];
  for (const tier of compensation.compensationTiers || []) {
    for (const component of tier.components || []) components.push(component);
  }
  for (const component of compensation.summaryComponents || []) components.push(component);
  const found = [];
  for (const component of components) {
    const type = String(component.compensationType || "");
    if (!/salary/i.test(type)) continue;
    const intervalToken = String(component.interval || "").toUpperCase();
    const interval = intervalToken.includes("HOUR")
      ? "hour"
      : intervalToken.includes("MONTH")
        ? "month"
        : "year";
    const record = makeSalary(
      component.minValue,
      component.maxValue,
      component.currencyCode || "USD",
      interval,
    );
    if (record) found.push(record);
  }
  return pickSalary(found)
    || parseSalaryFromText(compensation.scrapeableCompensationSalarySummary)
    || parseSalaryFromText(compensation.compensationTierSummary);
}

export function salaryFromLever(posting) {
  const range = posting?.salaryRange;
  if (range && (range.min != null || range.max != null)) {
    const token = String(range.interval || "");
    const interval = /hour/i.test(token) ? "hour" : /month/i.test(token) ? "month" : "year";
    const record = makeSalary(range.min, range.max, range.currency || "USD", interval);
    if (record) return record;
  }
  return parseSalaryFromText(posting?.salaryDescriptionPlain)
    || parseSalaryFromText(posting?.descriptionPlain);
}

function pickSalary(records) {
  if (!records.length) return null;
  const rank = { year: 3, month: 2, hour: 1 };
  return records
    .slice()
    .sort((a, b) => (rank[b.salaryInterval] - rank[a.salaryInterval]) || ((b.salaryMax || 0) - (a.salaryMax || 0)))[0];
}

export function hasSalary(record) {
  return Boolean(record?.salaryText);
}
