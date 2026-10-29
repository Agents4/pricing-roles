import { readFile } from "node:fs/promises";
import { boardLooksLive, boardUrl, fetchPrefix, mapPool } from "./lib/http.js";

const data = JSON.parse(await readFile(new URL("../data/companies.json", import.meta.url), "utf8"));
const companies = data.companies;

const results = await mapPool(companies, 12, async (company) => {
  const url = boardUrl(company);
  try {
    const { status, prefix } = await fetchPrefix(url);
    const ok = boardLooksLive(company, status, prefix);
    return { company, ok, status, prefix: prefix.slice(0, 80) };
  } catch (error) {
    return { company, ok: false, status: 0, prefix: error.message };
  }
});

const failed = results.filter((result) => !result.ok);
for (const result of failed) {
  console.error(`FAIL ${result.company.ats} ${result.company.token} (${result.company.name}) status=${result.status} ${result.prefix.replace(/\s+/g, " ")}`);
}
console.log(`Verified ${results.length - failed.length}/${results.length} boards`);
if (failed.length) process.exit(1);
