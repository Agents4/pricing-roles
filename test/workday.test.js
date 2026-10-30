import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { boardLooksLive, boardUrl } from "../scripts/lib/http.js";
import {
  WORKDAY_MAX_PAGES,
  WORKDAY_SEARCHES,
  ingestWorkday,
  parseWorkdayPostedAt,
  parseWorkdaySearch,
  workdayApplyUrl,
  workdayDetailUrl,
  workdayJobInput,
  workdayLooksLive,
  workdaySearchUrl,
} from "../scripts/lib/workday.js";

const company = {
  name: "Example Hotels",
  ats: "workday",
  token: "example",
  tenant: "example",
  wd: "wd5",
  site: "External",
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

test("workday board urls use tenant, wd host, and site", () => {
  assert.equal(
    workdaySearchUrl(company),
    "https://example.wd5.myworkdayjobs.com/wday/cxs/example/External/jobs",
  );
  assert.equal(boardUrl(company), workdaySearchUrl(company));
  assert.equal(
    workdayDetailUrl(company, "/job/FieldRemote/Senior-Director--Pricing-Analytics_R22384-1"),
    "https://example.wd5.myworkdayjobs.com/wday/cxs/example/External/job/FieldRemote/Senior-Director--Pricing-Analytics_R22384-1",
  );
  assert.equal(
    workdayApplyUrl(company, "/job/FieldRemote/Senior-Director--Pricing-Analytics_R22384-1"),
    "https://example.wd5.myworkdayjobs.com/External/job/FieldRemote/Senior-Director--Pricing-Analytics_R22384-1",
  );
  assert.throws(() => workdaySearchUrl({ ...company, site: "../admin" }), /Invalid Workday/);
  assert.throws(() => workdayDetailUrl(company, "https://evil.example/job"), /Unexpected Workday/);
});

test("workday search fixture keeps public posting fields", async () => {
  const payload = JSON.parse(await readFile(new URL("./fixtures/workday-search.json", import.meta.url), "utf8"));
  const parsed = parseWorkdaySearch(payload);
  assert.equal(parsed.total, 25);
  assert.equal(parsed.postings.length, 2);
  assert.equal(parsed.postings[0].title, "Senior Director, Pricing Analytics");
  assert.equal(parsed.postings[0].sourceId, "R22384");
  assert.equal(parsed.postings[0].location, "Field/Remote");
});

test("workday dates prefer startDate and ignore open-ended relative dates", () => {
  assert.equal(parseWorkdayPostedAt("Posted 7 Days Ago", "2026-10-23", now), "2026-10-23T00:00:00.000Z");
  assert.equal(parseWorkdayPostedAt("Posted Today", "", now), new Date(now).toISOString());
  assert.equal(parseWorkdayPostedAt("Posted Yesterday", "", now), "2026-10-29T00:00:00.000Z");
  assert.equal(parseWorkdayPostedAt("Posted 3 Days Ago", "", now), "2026-10-27T00:00:00.000Z");
  assert.equal(parseWorkdayPostedAt("Posted 30+ Days Ago", "", now), null);
});

test("workday detail fixture becomes a classified job", async () => {
  const search = JSON.parse(await readFile(new URL("./fixtures/workday-search.json", import.meta.url), "utf8"));
  const detail = JSON.parse(await readFile(new URL("./fixtures/workday-detail.json", import.meta.url), "utf8"));
  const posting = parseWorkdaySearch(search).postings[0];
  const input = workdayJobInput(company, posting, detail, now);
  assert.equal(input.postedAt, "2026-10-23T00:00:00.000Z");
  assert.equal(input.location, "Field/Remote, United States of America");
  assert.equal(input.sourceId, "Senior-Director--Pricing-Analytics_R22384-1");
  assert.match(input.description, /180,000/);

  const jobs = await ingestWorkday(company, now, {
    sleep: async () => {},
    mapPool,
    fetchJson: async (url, options = {}) => {
      if (options.method === "POST") {
        if (options.body.searchText === "pricing" && options.body.offset === 0) return search;
        if (options.body.searchText === "pricing" && options.body.offset === 20) {
          return {
            total: 25,
            jobPostings: [
              search.jobPostings[0],
              {
                title: "Director, Revenue Management",
                externalPath: "/job/Chicago/Director-Revenue-Management_R55",
                locationsText: "Chicago, IL",
                postedOn: "Posted 30+ Days Ago",
                bulletFields: ["R55"],
              },
            ],
          };
        }
        return { total: 0, jobPostings: [] };
      }
      if (url.endsWith("_R55")) {
        return {
          jobPostingInfo: {
            title: "Director, Revenue Management",
            jobDescription: "<p>Owns hotel revenue management.</p>",
            location: "Chicago, IL",
            startDate: "2026-09-15",
            externalUrl: "https://example.wd5.myworkdayjobs.com/External/job/Chicago/Director-Revenue-Management_R55",
            jobPostingId: "Director-Revenue-Management_R55",
          },
        };
      }
      return detail;
    },
  });

  assert.equal(jobs.scanned, 3);
  assert.equal(jobs.matched, 2);
  assert.equal(jobs.jobs.length, 2);
  assert.equal(jobs.jobs[0].title, "Senior Director, Pricing Analytics");
  assert.equal(jobs.jobs[0].category, "pricing-director");
  assert.equal(jobs.jobs[0].workplace, "remote");
  assert.equal(jobs.jobs[0].salaryText, "$180,000–$240,000");
  assert.equal(jobs.jobs[1].title, "Director, Revenue Management");
  assert.equal(jobs.jobs[1].category, "revenue-management");
  assert.equal(jobs.requests, WORKDAY_SEARCHES.length + 1 + 2);
});

test("workday ingest caps pages per search", async () => {
  let calls = 0;
  const result = await ingestWorkday(company, now, {
    sleep: async () => {},
    mapPool,
    fetchJson: async () => {
      calls += 1;
      const postings = Array.from({ length: 20 }, (_, index) => ({
        title: `Ramp Agent ${calls}-${index}`,
        externalPath: `/job/Dallas/Ramp-Agent_${calls}-${index}`,
        locationsText: "Dallas, TX",
        postedOn: "Posted Today",
        bulletFields: [`R${calls}${index}`],
      }));
      return { total: 500, jobPostings: postings };
    },
  });
  assert.equal(calls, WORKDAY_SEARCHES.length * WORKDAY_MAX_PAGES);
  assert.equal(result.scanned, calls * 20);
  assert.equal(result.matched, 0);
  assert.equal(result.jobs.length, 0);
});

test("a live workday prefix is a job search payload", () => {
  const prefix = '{"total":1,"jobPostings":[{"title":"Pricing Analyst"}]}';
  assert.equal(workdayLooksLive(200, prefix), true);
  assert.equal(boardLooksLive(company, 200, prefix), true);
  assert.equal(boardLooksLive(company, 200, "<html>"), false);
  assert.equal(boardLooksLive(company, 429, prefix), false);
});
