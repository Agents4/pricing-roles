import assert from "node:assert/strict";
import test from "node:test";
import { classifyTitle, isFresh, MAX_AGE_MS } from "../scripts/lib/classify.js";

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
  "Revenue Operations Manager",
  "Share Price Analyst",
  "Transfer Pricing Tax Manager",
  "Legal Team Lead for Deal Desk",
  "Staff Qualitative UX Researcher, Monetization",
  "Merchandiser",
  "Warehouse Associate",
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

test("freshness window is 60 days", () => {
  const now = Date.parse("2026-10-29T00:00:00Z");
  assert.equal(isFresh("2026-09-01T00:00:00Z", now), true);
  assert.equal(isFresh(new Date(now - MAX_AGE_MS + 1000).toISOString(), now), true);
  assert.equal(isFresh(new Date(now - MAX_AGE_MS - 1000).toISOString(), now), false);
  assert.equal(isFresh("not-a-date", now), false);
});
