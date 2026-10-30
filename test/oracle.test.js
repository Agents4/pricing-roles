import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { boardLooksLive, boardUrl } from "../scripts/lib/http.js";
import {
  ORACLE_MAX_PAGES,
  ORACLE_PAGE_SIZE,
  ORACLE_SEARCHES,
  ingestOracle,
  oracleApplyUrl,
  oracleDetailUrl,
  oracleJobInput,
  oracleLooksLive,
  oracleSearchUrl,
  parseOraclePostedAt,
  parseOracleSearch,
} from "../scripts/lib/oracle.js";

const company = {
  name: "Example Hotels",
  ats: "oracle",
  token: "example",
  host: "ejwl.fa.us2.oraclecloud.com",
  site: "CX",
  sector: "travel",
};

const now = Date.parse("2026-10-30T00:00:00.000Z");

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

test("oracle board urls use the public candidate-experience finders", () => {
  const search = new URL(oracleSearchUrl(company, "revenue manager", 0, 25));
  assert.equal(search.origin, "https://ejwl.fa.us2.oraclecloud.com");
  assert.equal(search.pathname, "/hcmRestApi/resources/latest/recruitingCEJobRequisitions");
  assert.equal(search.searchParams.get("onlyData"), "true");
  assert.equal(search.searchParams.get("expand"), "requisitionList.secondaryLocations");
  assert.equal(
    search.searchParams.get("finder"),
    'findReqs;siteNumber=CX,keyword="revenue manager",limit=25,offset=0',
  );
  assert.equal(boardUrl(company), oracleSearchUrl(company, "pricing", 0, 1));

  const detail = new URL(oracleDetailUrl(company, "26142051"));
  assert.equal(detail.pathname, "/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails");
  assert.equal(detail.searchParams.get("onlyData"), "true");
  assert.equal(detail.searchParams.get("expand"), "all");
  assert.equal(detail.searchParams.get("finder"), 'ById;Id="26142051",siteNumber=CX');
  assert.equal(
    oracleApplyUrl(company, "26142051"),
    "https://ejwl.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/26142051",
  );

  assert.equal(
    new URL(oracleSearchUrl({ ...company, host: "FA-EVAX-SAASFAPROD1.FA.OCS.ORACLECLOUD.COM", site: "CX_1001" }, "yield", 25, 25)).searchParams.get("finder"),
    'findReqs;siteNumber=CX_1001,keyword="yield",limit=25,offset=25',
  );
  assert.throws(() => oracleSearchUrl({ ...company, host: "jobs.example.com" }), /Invalid Oracle/);
  assert.throws(() => oracleSearchUrl({ ...company, host: "ejwl.fa.us2.oraclecloud.com.evil.example" }), /Invalid Oracle/);
  assert.throws(() => oracleSearchUrl({ ...company, site: "CX,limit=1" }), /Invalid Oracle/);
  assert.throws(() => oracleSearchUrl(company, 'pricing",siteNumber=ZZ'), /Unexpected Oracle search/);
  assert.throws(() => oracleDetailUrl(company, '26142051",siteNumber=ZZ'), /Unexpected Oracle requisition/);
});

test("oracle search fixture keeps public posting fields", async () => {
  const payload = JSON.parse(await readFile(new URL("./fixtures/oracle-search.json", import.meta.url), "utf8"));
  const parsed = parseOracleSearch(payload);
  assert.equal(parsed.total, 30);
  assert.equal(parsed.count, 2);
  assert.equal(parsed.postings.length, 2);
  assert.equal(parsed.postings[0].title, "Senior Director, Pricing Analytics");
  assert.equal(parsed.postings[0].id, "26142051");
  assert.equal(parsed.postings[0].location, "Bethesda, MD, United States; Austin, TX, United States");
  assert.equal(parsed.postings[0].workplaceType, "hybrid");
  assert.equal(parsed.postings[1].workplaceType, "onsite");
});

test("oracle dates prefer the detail start date and keep list dates", () => {
  assert.equal(
    parseOraclePostedAt("2026-08-01", "2026-10-23T15:04:00+00:00"),
    "2026-10-23T15:04:00.000Z",
  );
  assert.equal(parseOraclePostedAt("2026-10-23", ""), "2026-10-23T00:00:00.000Z");
  assert.equal(parseOraclePostedAt("Posted 7 Days Ago", ""), null);
});

test("oracle detail fixture becomes a classified job", async () => {
  const search = JSON.parse(await readFile(new URL("./fixtures/oracle-search.json", import.meta.url), "utf8"));
  const detail = JSON.parse(await readFile(new URL("./fixtures/oracle-detail.json", import.meta.url), "utf8"));
  const posting = parseOracleSearch(search).postings[0];
  const input = oracleJobInput(company, posting, detail.items[0]);
  assert.equal(input.postedAt, "2026-10-23T15:04:00.000Z");
  assert.equal(input.location, "Bethesda, MD, United States; Austin, TX, United States");
  assert.equal(input.sourceId, "26142051");
  assert.equal(input.workplaceType, "hybrid");
  assert.match(input.description, /180,000/);
  assert.match(input.payText, /\$19\.00 per hour/);

  const detailUrls = [];
  const jobs = await ingestOracle(company, now, {
    sleep: async () => {},
    mapPool,
    fetchJson: async (url) => {
      const finder = new URL(url).searchParams.get("finder") || "";
      if (url.includes("recruitingCEJobRequisitionDetails")) {
        detailUrls.push(finder);
        if (finder.includes('"55"')) {
          return {
            items: [{
              Id: "55",
              Title: "Director, Revenue Management",
              ExternalPostedStartDate: "2026-10-01T12:00:00+00:00",
              ExternalDescriptionStr: "<p>Owns hotel revenue management.</p>",
              PrimaryLocation: "Chicago, IL, United States",
              WorkplaceType: "On-site",
              WorkplaceTypeCode: "ORA_ON_SITE",
              requisitionFlexFields: [{ Prompt: "Pay Range", Value: "$95,000 - $110,000 per year" }],
            }],
          };
        }
        if (finder.includes('"77"')) {
          return {
            items: [{
              Id: "77",
              Title: "Revenue Manager",
              ExternalPostedStartDate: "2026-01-02T00:00:00+00:00",
              ExternalDescriptionStr: "<p>Hotel revenue manager.</p>",
              PrimaryLocation: "Dubai, United Arab Emirates",
            }],
          };
        }
        return detail;
      }
      if (finder.includes('keyword="pricing"') && finder.includes("offset=0")) return search;
      if (finder.includes('keyword="pricing"') && finder.includes("offset=25")) {
        return {
          items: [{
            TotalJobsCount: 30,
            requisitionList: [
              search.items[0].requisitionList[0],
              {
                Id: "55",
                Title: "Director, Revenue Management",
                PostedDate: "2026-08-01",
                PrimaryLocation: "Chicago, IL, United States",
                WorkplaceTypeCode: "ORA_ON_SITE",
                secondaryLocations: [],
              },
              {
                Id: "77",
                Title: "Revenue Manager",
                PostedDate: "2026-01-02",
                PrimaryLocation: "Dubai, United Arab Emirates",
                secondaryLocations: [],
              },
            ],
          }],
        };
      }
      return { items: [{ TotalJobsCount: 0, requisitionList: [] }] };
    },
  });

  assert.deepEqual(detailUrls, [
    'ById;Id="26142051",siteNumber=CX',
    'ById;Id="55",siteNumber=CX',
    'ById;Id="77",siteNumber=CX',
  ]);
  assert.equal(jobs.scanned, 4);
  assert.equal(jobs.matched, 3);
  assert.equal(jobs.jobs.length, 2);
  assert.equal(jobs.jobs[0].title, "Senior Director, Pricing Analytics");
  assert.equal(jobs.jobs[0].category, "pricing-director");
  assert.equal(jobs.jobs[0].workplace, "hybrid");
  assert.equal(jobs.jobs[0].location, "Bethesda, MD, United States; Austin, TX, United States");
  assert.equal(jobs.jobs[0].salaryText, "$180,000–$240,000");
  assert.equal(jobs.jobs[0].applyUrl, oracleApplyUrl(company, "26142051"));
  assert.equal(jobs.jobs[1].title, "Director, Revenue Management");
  assert.equal(jobs.jobs[1].category, "revenue-management");
  assert.equal(jobs.jobs[1].workplace, "onsite");
  assert.equal(jobs.jobs[1].salaryText, "$95,000–$110,000");
  assert.match(jobs.jobs[0].description, /Owns price architecture/);
  assert.equal(jobs.requests, 2 + (ORACLE_SEARCHES.length - 1) + 3);
});

test("oracle ingest caps pages per keyword and skips non-matching titles", async () => {
  let calls = 0;
  let detailCalls = 0;
  const result = await ingestOracle(company, now, {
    sleep: async () => {},
    mapPool,
    fetchJson: async (url) => {
      if (url.includes("recruitingCEJobRequisitionDetails")) {
        detailCalls += 1;
        return { items: [] };
      }
      calls += 1;
      const postings = Array.from({ length: ORACLE_PAGE_SIZE }, (_, index) => ({
        Id: String(calls * 100 + index),
        Title: `Ramp Agent ${calls}-${index}`,
        PostedDate: "2026-10-30",
        PrimaryLocation: "Dallas, TX, United States",
        secondaryLocations: [],
      }));
      return { items: [{ TotalJobsCount: 500, requisitionList: postings }] };
    },
  });
  assert.equal(calls, ORACLE_SEARCHES.length * ORACLE_MAX_PAGES);
  assert.equal(detailCalls, 0);
  assert.equal(result.scanned, calls * ORACLE_PAGE_SIZE);
  assert.equal(result.matched, 0);
  assert.equal(result.jobs.length, 0);
});

test("a live oracle prefix is a candidate-experience search payload", () => {
  const prefix = '{"items":[{"Keyword":"pricing","TotalJobsCount":1,"requisitionList":[]}';
  assert.equal(oracleLooksLive(200, prefix), true);
  assert.equal(boardLooksLive(company, 200, prefix), true);
  assert.equal(boardLooksLive(company, 200, "<html>Access Denied"), false);
  assert.equal(boardLooksLive(company, 403, prefix), false);
});
