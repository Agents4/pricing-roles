import assert from "node:assert/strict";
import test from "node:test";
import { classifyTitle, isFresh, MAX_AGE_MS, normalizeTitle } from "../scripts/lib/classify.js";
import { buildJob } from "../scripts/lib/jobs.js";

const included = [
  ["Deal Pricing", "pricing", "mid"],
  ["Deal Pricing Strategist, APAC", "pricing-strategy", "mid"],
  ["Monetization and Contract Success (MACS) Specialist", "monetization", "mid"],
  ["Monetization Operations Analyst", "monetization", "mid"],
  ["Portfolio Pricing Strategist", "pricing-strategy", "mid"],
  ["Pricing Activation Specialist", "pricing-operations", "mid"],
  ["Product Manager, Connect Growth & Monetization", "monetization", "manager"],
  ["Product Marketing Manager, Portfolio Pricing", "pricing-manager", "manager"],
  ["Deal Desk Manager", "deal-desk", "manager"],
  ["Deal Desk Analyst", "deal-desk", "mid"],
  ["Senior Deal Desk Analyst", "deal-desk", "senior"],
  ["Pricing Strategist", "pricing-strategy", "mid"],
  ["Pricing Strategist, GTM", "pricing-strategy", "mid"],
  ["Pricing Operations Lead", "pricing-operations", "senior"],
  ["VP of Pricing", "pricing-leadership", "vp"],
  ["Head of Monetization", "monetization", "vp"],
  ["Director, Pricing Strategy", "pricing-strategy", "director"],
  ["Pricing Analyst", "pricing-analyst", "mid"],
  ["Senior Pricing Manager", "pricing-manager", "manager"],
  ["Revenue Management Analyst", "revenue-management", "mid"],
  ["Yield Management Lead", "revenue-management", "senior"],
  ["Revenue Strategy Manager", "pricing-strategy", "manager"],
  ["Sr. Manager Rev Strategy", "pricing-strategy", "manager"],
  ["Director, Rev. Strategy", "pricing-strategy", "director"],
  ["Manager, Revenue Forecasting", "revenue-management", "manager"],
  ["Revenue Forecast Analyst", "revenue-management", "mid"],
  ["Revenue Manager", "revenue-management", "manager"],
  ["Revenue Optimization Manager", "revenue-management", "manager"],
  ["Senior Revenue Manager", "revenue-management", "manager"],
  ["Hotel Revenue Analyst", "revenue-management", "mid"],
  ["Airline Revenue Analyst", "revenue-management", "mid"],
  ["Yield Analyst", "revenue-management", "mid"],
  ["Senior Yield Analyst", "revenue-management", "senior"],
  ["Inventory & Pricing Analyst", "revenue-management", "mid"],
  ["Pricing & Revenue Management Analyst", "revenue-management", "mid"],
  ["Commercial Revenue Manager", "revenue-management", "manager"],
  ["Network & Revenue Analyst", "revenue-management", "mid"],
  ["RM Analyst", "revenue-management", "mid"],
  ["Demand Analyst, Pricing", "pricing-analyst", "mid"],
  ["Revenue Demand Analyst", "revenue-management", "mid"],
  ["Packaging Strategist", "packaging", "mid"],
  ["Director of Packaging", "packaging", "director"],
  ["Pricing Engineer", "pricing", "mid"],
  ["Pricing Intern", "pricing", "intern"],
  ["Associate Pricing Analyst", "pricing-analyst", "entry"],
  ["Associate, Channel Operations – Contracts & Pricing Execution", "pricing-operations", "entry"],
  ["Manager, Channel Operations – Contracts & Pricing Execution (AIN)", "pricing-operations", "manager"],
  ["Contracts & Pricing Strategy, Associate Director", "pricing-strategy", "director"],
  ["Director Global Market Access & Pricing, frexalimab", "pricing-director", "director"],
  ["Global Market Access & Pricing Lead, Early Neurology", "pricing", "senior"],
  ["Actuary, Personal Lines Property Pricing - REMOTE", "pricing", "mid"],
  ["Insurance Pricing Actuary", "pricing", "mid"],
  ["Actuarial Associate, Excess Casualty Pricing and Modeling - REMOTE", "pricing-analyst", "entry"],
  ["Cruise Revenue Manager", "revenue-management", "manager"],
  ["Airline Revenue Management Analyst", "revenue-management", "mid"],
  ["Principal Product Manager, Security Pricing and Packaging", "packaging", "manager"],
  ["Pricing Exception and Controls Lead Analyst", "pricing-analyst", "senior"],
  ["Senior Product Manager, Billing Engine & Platforms Monetization", "monetization", "manager"],
  ["Sr Manager Data Science & Engineering-Pricing & Optimization", "pricing-strategy", "manager"],
  ["Pricing Solutions Architect", "pricing", "mid"],
  ["Lending Product & Pricing - Senior Associate", "pricing-analyst", "senior"],
  ["Deposits Pricing Associate", "pricing-analyst", "entry"],
  ["Payments- Treasury Services- Deal Pricing Associate", "pricing-analyst", "entry"],
];

const excluded = [
  "Software Engineer, Monetization Delivery",
  "Machine Learning Engineer, Monetization AI/ML",
  "Full Stack Software Engineer, Monetization Platform",
  "Staff Software Engineer, Payments & Billing, Consumer Monetization",
  "Pricing Clerk",
  "Retail Pricing Clerk",
  "Packaging Engineer",
  "Packaging Technician",
  "Account Executive, Monetization",
  "Account Executive, New Revenue",
  "Customer Success Manager",
  "Revenue Analyst",
  "Revenue Accountant",
  "Revenue Accounting Manager",
  "Revenue Operations Analyst",
  "Demand Analyst",
  "Demand Analyst, Revenue Operations",
  "CRM Analyst",
  "Sales Manager",
  "Business Development Representative",
  "Software Engineer",
  "Revenue Forecasting Accountant",
  "Accounting Manager, Revenue Forecasting",
  "Sales Operations Manager, Revenue Forecasting",
  "Sales Ops, Rev Strategy",
  "Revenue Operations Forecast Analyst",
  "Financial Forecast Manager",
  "Revenue Operations Manager",
  "Share Price Analyst",
  "Transfer Pricing Tax Manager",
  "Legal Team Lead for Deal Desk",
  "Staff Qualitative UX Researcher, Monetization",
  "Merchandiser",
  "Warehouse Associate",
  "O2C Cash Application Receivables and Revenue Management Protege (Mandarin Speaker)",
  "Order to Cash Pricing Analyst",
  "Cash Application and Revenue Management Specialist",
  "Receivables and Revenue Management Analyst",
  "Sr Director Software Engineering-Merchandising/Pricing/Promotions/AI Commerce",
  "Software Engineering Manager, Pricing Platform",
  "Credit Portfolio Group – XVA Pricing & Capital Solutions EMEA - Analyst or Associate",
  "Derivatives Pricing Analyst",
  "Fixed Income Index Operations and Pricing Controls - Associate",
  "Securities Pricing Associate",
  "Index Operations Pricing Associate",
  "Valuation Pricing Analyst",
  "OM/Pricing: Billing & Invoicing SME",
  "Billing and Invoicing Analyst, Pricing",
  "Quantitative Analyst – FX Options Electronic Pricing & Automation, VP",
  "Lead Pricing Engineer (SVP) - FX eTrading",
  "Business Support Manager – Strategic Projects, Securities and Pricing Operations",
];

test("pricing titles are classified", () => {
  for (const [title, category, seniority] of included) {
    const result = classifyTitle(title);
    assert.ok(result, title);
    assert.equal(result.category, category, title);
    assert.equal(result.seniority, seniority, title);
  }
});

test("false positives are dropped", () => {
  for (const title of excluded) {
    assert.equal(classifyTitle(title), null, title);
  }
});

test("job posting title prefix is stripped", () => {
  const raw = "Job Posting Title Associate, Channel Operations – Contracts & Pricing Execution";
  const cleaned = "Associate, Channel Operations – Contracts & Pricing Execution";
  assert.equal(normalizeTitle(raw), cleaned);
  assert.equal(normalizeTitle("Job Posting Title: Pricing Analyst"), "Pricing Analyst");
  const classified = classifyTitle(raw);
  assert.ok(classified);
  assert.equal(classified.category, "pricing-operations");
  assert.equal(classified.seniority, "entry");

  const job = buildJob({
    title: raw,
    company: { name: "Amgen", token: "amgen", sector: "healthcare" },
    ats: "workday",
    sourceId: "1",
    location: "California",
    postedAt: "2026-10-20T00:00:00.000Z",
    applyUrl: "https://example.com/job/1",
    description: "Contracts and pricing execution for channel operations.",
  }, Date.parse("2026-10-29T00:00:00Z"));
  assert.equal(job.title, cleaned);
  assert.equal(job.category, "pricing-operations");
});

test("revenue accounting bodies are not revenue management", () => {
  const accounting = [
    "Reports to the Sr. Manager, Revenue Accounting. Reviews contracts under ASC 606 and owns revenue recognition.",
    "Support global revenue accounting functions, revenue recognition policy, and ASC 606.",
    "5+ years of revenue recognition experience. ASC606 technical revenue experience preferred.",
    "Lead technical revenue recognition and systems execution. Interpret ASC 606 requirements.",
  ];
  for (const body of accounting) {
    assert.equal(classifyTitle("Revenue Manager", body), null, body.slice(0, 48));
  }
  assert.equal(
    classifyTitle("Manager, Revenue Strategy", "Lead technical revenue recognition for ASC 606."),
    null,
  );
  assert.equal(
    classifyTitle("Revenue Manager - Business Systems", "The Revenue Recognition team owns revenue accounting data."),
    null,
  );

  const hotel = classifyTitle(
    "Revenue Manager",
    "Own hotel pricing, RevPAR, and occupancy. Forecast demand and set room rates.",
  );
  assert.ok(hotel);
  assert.equal(hotel.category, "revenue-management");
  assert.equal(hotel.seniority, "manager");

  const bare = classifyTitle("Revenue Manager");
  assert.ok(bare);
  assert.equal(bare.category, "revenue-management");

  const dropped = buildJob({
    title: "Revenue Manager",
    company: { name: "Elastic", token: "elastic", sector: "saas" },
    ats: "greenhouse",
    sourceId: "rm",
    location: "United States",
    postedAt: "2026-10-20T00:00:00.000Z",
    applyUrl: "https://example.com/job/rm",
    description: "Reports directly to the Sr. Manager, Revenue Accounting. ASC 606 revenue recognition.",
  }, Date.parse("2026-10-29T00:00:00Z"));
  assert.equal(dropped, null);

  const kept = buildJob({
    title: "Revenue Manager",
    company: { name: "Marriott", token: "marriott", sector: "travel" },
    ats: "oracle",
    sourceId: "rm-hotel",
    location: "Prague",
    postedAt: "2026-10-20T00:00:00.000Z",
    applyUrl: "https://example.com/job/rm-hotel",
    description: "Drive RevPAR and occupancy for the hotel and set daily rates.",
  }, Date.parse("2026-10-29T00:00:00Z"));
  assert.equal(kept.title, "Revenue Manager");
  assert.equal(kept.category, "revenue-management");
});

test("freshness window is 60 days", () => {
  const now = Date.parse("2026-10-29T00:00:00Z");
  assert.equal(isFresh("2026-09-01T00:00:00Z", now), true);
  assert.equal(isFresh(new Date(now - MAX_AGE_MS + 1000).toISOString(), now), true);
  assert.equal(isFresh(new Date(now - MAX_AGE_MS - 1000).toISOString(), now), false);
  assert.equal(isFresh("not-a-date", now), false);
});
