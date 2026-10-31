# PricingRoles

PricingRoles is a static job board for pricing, monetization, deal desk, packaging, and revenue strategy roles. Listings are read from public Greenhouse, Lever, Ashby, Workday, and Oracle Cloud HCM job boards and link straight to the company’s own posting.

The site is meant to be served at [pricingroles.com](https://pricingroles.com). Nothing in this repository assumes that DNS is already pointed here.

## Refresh the data and rebuild

One command fetches current postings and writes the site to `dist/`:

```bash
npm run refresh
```

That runs, in order:

```bash
npm run ingest   # data/companies.json -> data/jobs.json
npm run build    # data/jobs.json -> dist/
```

Other commands:

```bash
npm test            # title filters, salary parsing, dedupe
npm run validate    # JSON-LD, sitemap, robots, and CNAME after a build
npm run verify-boards
```

`verify-boards` checks that every company token still answers its public board API. A board that disappears later is skipped during ingest and reported in the log. It does not fail the daily job unless every board fails or no pricing roles are left.

## Where the jobs come from

Company board tokens live in `data/companies.json`. Each entry is a public board:

| ATS | Endpoint |
| --- | --- |
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs`, then `https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}?pay_transparency=true` for each title match (posting content, publish date, and pay range) |
| Lever | `https://api.lever.co/v0/postings/{company}?mode=json` (EU boards use `api.eu.lever.co`) |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` |
| Workday | `POST https://{tenant}.{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` with `searchText` (`pricing`, `revenue management`, `yield`, `revenue manager`), `limit` 20, and `offset`. At most 3 pages per search. Each title match is then read with `GET .../wday/cxs/{tenant}/{site}{externalPath}`. |
| Oracle Cloud HCM | `GET https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber={site},keyword="...",limit=25,offset=0` for `pricing`, `revenue management`, `yield`, `revenue manager`, and `revenue strategy`. At most 3 pages per keyword. Each title match is then read with `GET .../recruitingCEJobRequisitionDetails?onlyData=true&expand=all&finder=ById;Id="{id}",siteNumber={site}`. |

A Workday company needs `tenant`, `wd` (the `wdN` host), and `site`, plus the usual `token`. Only those public job-board APIs are called. There is no login and no private API key. Workday requests run two companies at a time, with a short pause and the same retry backoff as the other boards.

An Oracle Cloud HCM company needs `host` (the public `*.oraclecloud.com` career-site host) and `site` (the candidate-experience site number, such as `CX` or `CX_1`), plus the usual `token`. The reader calls the public candidate-experience requisition APIs only. Oracle requests run two companies at a time, with a short pause and the same retry backoff as the other boards.

A posting is kept when the title is a pricing, monetization, deal desk, revenue management, yield management, or packaging role, including hospitality revenue titles such as revenue manager, yield analyst, commercial revenue, network and revenue, revenue strategy, rev strategy, and revenue forecasting, plus revenue analyst when the title is hospitality or revenue-management work. It has to have been posted within 60 days, and it is not a known false positive (retail pricing clerk, generic revenue analyst, revenue accountant, revenue operations, generic sales “revenue” role, software engineer or software engineering title, physical packaging operations, order-to-cash, cash application, receivables, billing and invoicing, securities, fixed income, derivative, XVA, valuation, index operations, or pricing controls, and similar). A revenue manager or revenue strategy title with no pricing, yield, or hospitality wording is dropped when the posting itself is revenue accounting or revenue recognition. A leading “Job Posting Title” label is removed before the title is stored or shown. Duplicates with the same apply URL, or the same company, title, location, and workplace, collapse to the newest posting.

`data/jobs.json` is the generated snapshot the site builds from. It is committed so the board can be rebuilt without a network call.

## What the site includes

- Homepage with search and filters for category, seniority, workplace, and whether a salary is listed
- One page per job, with schema.org `JobPosting` JSON-LD
- Category pages and remote, hybrid, and onsite landing pages
- `sitemap.xml`, `robots.txt`, and a `CNAME` file containing `pricingroles.com`
- A post-a-job page for a featured listing at **$99 for 30 days**. The form is marked TODO and does not submit anywhere
- A weekly new-roles signup embedded from Beehiiv
- A short About page

## GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys `dist/` to GitHub Pages.

- A push to `main` builds the committed snapshot and deploys it.
- A daily schedule, and “Run workflow”, refreshes `data/jobs.json`, builds, deploys, and commits the new snapshot with `[skip ci]` so that commit does not deploy a second time.

### Repository settings the owner has to change

These are not set by the workflow file:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** The first successful run also creates the `github-pages` environment.
2. **Settings → Actions → General → Workflow permissions: Read and write.** The default token is read-only. The daily job needs write so it can commit `data/jobs.json`. The workflow’s own `permissions` block is not enough if the repository policy forces read-only.
3. **Branch protection on `main`.** If pushes require a review, the refresh commit will fail. The site for that run is still deployed from the workflow. Allow the GitHub Actions bot to push, or turn that requirement off for this repository.
4. **Custom domain.** After the first deploy, set the Pages custom domain to `pricingroles.com` if it was not picked up from the `CNAME` file in the artifact. Turn on **Enforce HTTPS** only after the certificate is issued. That happens after DNS is correct, not before.
5. **Domain verification.** When the custom domain is added, GitHub shows a TXT record at `_github-pages-challenge-agents4`. Add that exact value. Do not invent one. This is what stops someone else from attaching the domain to another Pages site.

Actions has to be enabled. On a public repository that is the default.

## DNS for pricingroles.com

Do this at the DNS host. Remove any default apex `A` or `AAAA` records the registrar added (a parking page, for example) before relying on the domain. Do not add a wildcard such as `*.pricingroles.com`.

The Pages site for this repository is served from `agents4.github.io` once the custom domain is attached. The `CNAME` file in the deployed site contains:

```text
pricingroles.com
```

### Apex (`pricingroles.com`)

Add all four `A` records and all four `AAAA` records:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

If the DNS host supports `ALIAS` or `ANAME` and you prefer one record, point `@` at `agents4.github.io` instead of the eight address records. Use that **or** the `A`/`AAAA` set, not a mix of an alias and these addresses.

### www

| Type | Host | Value |
| --- | --- | --- |
| CNAME | `www` | `agents4.github.io` |

With the apex in the `CNAME` file, GitHub Pages redirects `www.pricingroles.com` to `pricingroles.com` when both records are in place.

Check, after the records exist:

```bash
dig pricingroles.com +noall +answer -t A
dig pricingroles.com +noall +answer -t AAAA
dig www.pricingroles.com +noall +answer -t CNAME
```

DNS can take a while to be visible everywhere. HTTPS will not turn on until it is.

## Secrets

This project does not use API keys. Do not commit credentials, `.env` files, or private board tokens. The boards in `data/companies.json` are public.
