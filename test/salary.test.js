import assert from "node:assert/strict";
import test from "node:test";
import { formatSalary, parseSalaryFromText, salaryFromAshby, salaryFromGreenhouse } from "../scripts/lib/salary.js";
import { workplaceFromSignals } from "../scripts/lib/workplace.js";
import { dedupeJobs } from "../scripts/lib/jobs.js";

test("parses annual ranges and ignores bare small amounts", () => {
  const range = parseSalaryFromText("The range is $120,000 - $180,000 per year.");
  assert.equal(range.salaryMin, 120000);
  assert.equal(range.salaryMax, 180000);
  assert.equal(range.salaryCurrency, "USD");
  assert.equal(range.salaryInterval, "year");
  assert.equal(formatSalary(range, { compact: true }), "$120k–$180k");

  const compact = parseSalaryFromText("Compensation: $234K – $260K • Offers Equity");
  assert.equal(compact.salaryMin, 234000);
  assert.equal(compact.salaryMax, 260000);

  assert.equal(parseSalaryFromText("Plans start at $99."), null);
  assert.equal(parseSalaryFromText("Roadmap 2024-2026"), null);
});

test("parses hourly pay only when the posting says so", () => {
  const hourly = parseSalaryFromText("Pay is $45 - $55 per hour.");
  assert.equal(hourly.salaryInterval, "hour");
  assert.equal(hourly.salaryMin, 45);
  assert.equal(hourly.salaryMax, 55);
});

test("reads Greenhouse and Ashby structured pay", () => {
  const greenhouse = salaryFromGreenhouse([{ min_cents: 15000000, max_cents: 18000000, currency_type: "USD" }]);
  assert.equal(greenhouse.salaryMin, 150000);
  assert.equal(greenhouse.salaryMax, 180000);

  const ashby = salaryFromAshby({
    compensationTiers: [{
      components: [
        { compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 234000, maxValue: 260000 },
        { compensationType: "EquityCashValue", interval: "1 YEAR", currencyCode: "USD", minValue: null, maxValue: null },
      ],
    }],
  });
  assert.equal(ashby.salaryMin, 234000);
  assert.equal(ashby.salaryText.includes("234"), true);
});

test("workplace prefers an explicit hybrid signal", () => {
  assert.equal(workplaceFromSignals({ location: "San Francisco", workplaceType: "Hybrid", isRemote: true }), "hybrid");
  assert.equal(workplaceFromSignals({ location: "Remote - US" }), "remote");
  assert.equal(workplaceFromSignals({ location: "New York, NY" }), "onsite");
  assert.equal(workplaceFromSignals({ location: "" }), "unknown");
});

test("dedupes the same apply URL and the same role", () => {
  const older = job({ applyUrl: "https://example.com/a", postedAt: "2026-09-01T00:00:00Z" });
  const newer = job({ applyUrl: "https://example.com/a", postedAt: "2026-10-01T00:00:00Z", id: "b" });
  const twin = job({
    applyUrl: "https://example.com/b",
    postedAt: "2026-10-02T00:00:00Z",
    id: "c",
  });
  const other = job({
    applyUrl: "https://example.com/c",
    postedAt: "2026-10-03T00:00:00Z",
    id: "other",
    title: "Pricing Analyst",
  });
  const kept = dedupeJobs([older, newer, twin, other]);
  assert.deepEqual(kept.map((item) => item.id).sort(), ["c", "other"]);
});

function job(overrides) {
  return {
    id: "a",
    title: "Pricing Manager",
    company: "Example",
    location: "Remote",
    workplace: "remote",
    postedAt: "2026-10-01T00:00:00Z",
    applyUrl: "https://example.com/a",
    ...overrides,
  };
}
