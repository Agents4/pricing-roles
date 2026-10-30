export const MAX_AGE_DAYS = 60;
export const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export const CATEGORIES = [
  {
    slug: "deal-desk",
    name: "Deal desk",
    intro: "Deal desk roles own discount guidance, approval paths, and the commercial terms that sit next to list price. These openings come from public company job boards.",
  },
  {
    slug: "monetization",
    name: "Monetization",
    intro: "Monetization roles shape how a product turns usage, seats, or attention into revenue. This page lists open monetization jobs across the companies PricingRoles tracks.",
  },
  {
    slug: "revenue-management",
    name: "Revenue management",
    intro: "Revenue management and yield roles set prices against demand, capacity, and mix, including airline, hotel, cruise, and other travel revenue management. Listings here are live postings from public applicant-tracking boards.",
  },
  {
    slug: "packaging",
    name: "Packaging",
    intro: "Packaging roles decide tiers, bundles, and what sits inside an offer. These are product and pricing packaging jobs, not physical package handling.",
  },
  {
    slug: "pricing-operations",
    name: "Pricing operations",
    intro: "Pricing operations roles keep rate cards, quotes, billing setup, and price changes running. This page collects open pricing ops jobs from company boards.",
  },
  {
    slug: "pricing-strategy",
    name: "Pricing strategy",
    intro: "Pricing strategy roles cover research, price architecture, and the science behind a price. Each listing links straight to the company that posted it.",
  },
  {
    slug: "pricing-leadership",
    name: "Pricing leadership",
    intro: "Heads, VPs, and chiefs of pricing and monetization. Leadership openings are listed when a tracked company publishes them on its public job board.",
  },
  {
    slug: "pricing-director",
    name: "Pricing director",
    intro: "Director-level pricing roles, including directors of pricing, monetization, and commercial strategy when the title is a pricing role.",
  },
  {
    slug: "pricing-manager",
    name: "Pricing manager",
    intro: "Pricing manager roles across product, sales, and finance organizations. Titles are filtered so generic sales management stays off this page.",
  },
  {
    slug: "pricing-analyst",
    name: "Pricing analyst",
    intro: "Analyst, associate, and specialist roles in pricing and monetization. A starting point for people building a pricing career.",
  },
  {
    slug: "pricing",
    name: "Pricing",
    intro: "Pricing roles that do not sit neatly in analyst, manager, director, or operations titles. The work is still pricing, monetization, or revenue strategy.",
  },
];

export const SENIORITY = [
  { slug: "intern", name: "Intern" },
  { slug: "entry", name: "Entry" },
  { slug: "mid", name: "Mid-level" },
  { slug: "senior", name: "Senior" },
  { slug: "manager", name: "Manager" },
  { slug: "director", name: "Director" },
  { slug: "vp", name: "VP / Head" },
];

export const WORKPLACES = [
  {
    slug: "remote",
    name: "Remote",
    intro: "Remote pricing, monetization, deal desk, packaging, and revenue strategy roles. Workplace is taken from the company posting.",
  },
  {
    slug: "hybrid",
    name: "Hybrid",
    intro: "Hybrid pricing and monetization roles. A posting is hybrid when the company describes it that way.",
  },
  {
    slug: "onsite",
    name: "Onsite",
    intro: "Onsite pricing and monetization roles, where the company lists a workplace and does not mark the job remote or hybrid.",
  },
];

const STRONG = [
  /\bpric(?:e|ing)\b/i,
  /moneti[sz]/i,
  /\bdeal\s*desk\b/i,
  /\brevenue\s+management\b/i,
  /\brevenue\s+strategy\b/i,
  /\brev\.?\s+strateg/i,
  /\b(revenue|rev\.?)\s+forecast/i,
  /\brevenue\s+managers?\b/i,
  /\brevenue\s+optimi[sz]/i,
  /\byield\s+(management|managers?|analysts?|specialists?)\b/i,
  /\bcommercial\s+revenue\b/i,
  /\bnetwork\s*(?:&|and)\s*revenue\b/i,
  /\bnetwork\s+revenue\b/i,
  /\brm\s+analysts?\b/i,
  /\binventory\s*(?:&|and|\/)\s*pricing\b/i,
  /\bpricing\s*(?:&|and|\/)\s*inventory\b/i,
];

// Generic "revenue analyst" stays out. Hospitality and revenue-management
// titles ("Hotel Revenue Analyst") are the pricing job.
const HOSPITALITY = /\b(hospitality|hotels?|airlines?|aviation|cruises?|lodging|resorts?|revpar|occupancy|vacation\s+rentals?|short[-\s]?term\s+rentals?|car\s+rentals?|travel)\b/i;

const EXCLUDE = [
  /\b(clerk|cashier|stocker|barista)\b/i,
  /\b(pricing|price)\s+(clerk|checker)\b/i,
  /\b(warehouse|retail|store|sales)\s+associate\b/i,
  /\bmerchandiser\b/i,
  /\bpackage handler\b/i,
  /\baccount executive\b/i,
  /\bsales development\b/i,
  /\bbusiness development\b/i,
  /\b(sdr|bdr)\b/i,
  /\bcustomer success\b/i,
  /\bcustomer support\b/i,
  /\bsales engineer\b/i,
  /\bsolutions engineer\b/i,
  /\bsolutions consultant\b/i,
  /\brecruiter\b/i,
  /\bsourcer\b/i,
  /\btalent acquisition\b/i,
  /\b(counsel|attorney|lawyer|paralegal)\b/i,
  /\b(accountant|bookkeeper)\b/i,
  /\bdesigner\b/i,
  /\bshare price\b/i,
  /\btransfer pricing\b/i,
  /\blegal\b/i,
];

const ENGINEERING = [
  /\bsoftware engineer\b/i,
  /\bsoftware developer\b/i,
  /\bfront[-\s]?end engineer\b/i,
  /\bback[-\s]?end engineer\b/i,
  /\bfull[-\s]?stack engineer\b/i,
  /\bmachine learning engineer\b/i,
  /\bml engineer\b/i,
  /\bdata engineer\b/i,
  /\bplatform engineer\b/i,
  /\binfrastructure engineer\b/i,
  /\bmobile engineer\b/i,
  /\bios engineer\b/i,
  /\bandroid engineer\b/i,
  /\bsite reliability engineer\b/i,
  /\bsecurity engineer\b/i,
  /\bdevops engineer\b/i,
  /\banalytics engineer\b/i,
  /\bqa engineer\b/i,
  /\btest engineer\b/i,
  /\bengineering manager\b/i,
  /\bdeveloper\b/i,
];

export function categoryMeta(slug) {
  return CATEGORIES.find((category) => category.slug === slug) || null;
}

export function seniorityMeta(slug) {
  return SENIORITY.find((level) => level.slug === slug) || null;
}

export function workplaceMeta(slug) {
  return WORKPLACES.find((place) => place.slug === slug) || null;
}

function packagingMatch(title) {
  if (!/\bpackaging\b/i.test(title)) return false;
  const physical = /\b(engineer|technician|operator|designer|scientist|developer|mechanic|machinist|warehouse|manufactur)\b/i.test(title);
  const pricing = /\b(pric(?:e|ing)|moneti[sz])\b/i.test(title);
  return !(physical && !pricing);
}

function isEngineering(title) {
  if (/\bpricing engineer\b/i.test(title)) return false;
  if (/\b(revenue management|yield management) engineer\b/i.test(title)) return false;
  if (ENGINEERING.some((pattern) => pattern.test(title))) return true;
  return /\bengineer\b/i.test(title);
}

export function categoryFor(title) {
  if (/\bdeal\s*desk\b/i.test(title)) return "deal-desk";
  if (/moneti[sz]/i.test(title)) return "monetization";
  if (/\b(revenue|yield)\s+management\b/i.test(title)) return "revenue-management";
  if (/\brevenue\s+managers?\b/i.test(title)) return "revenue-management";
  if (/\brevenue\s+optimi[sz]/i.test(title)) return "revenue-management";
  if (/\byield\s+(managers?|analysts?)\b/i.test(title)) return "revenue-management";
  if (/\bcommercial\s+revenue\b/i.test(title)) return "revenue-management";
  if (/\bnetwork\s*(?:&|and)\s*revenue\b/i.test(title) || /\bnetwork\s+revenue\b/i.test(title)) return "revenue-management";
  if (/\brm\s+analysts?\b/i.test(title)) return "revenue-management";
  if (/\binventory\s*(?:&|and|\/)\s*pricing\b/i.test(title) || /\bpricing\s*(?:&|and|\/)\s*inventory\b/i.test(title)) return "revenue-management";
  if (/\b(revenue|rev\.?)\s+forecast/i.test(title)) return "revenue-management";
  if (/\brevenue\s+analysts?\b/i.test(title)) return "revenue-management";
  if (/\bdemand\s+analysts?\b/i.test(title) && /\b(revenue|yield)\b/i.test(title)) return "revenue-management";
  if (/\bpackaging\b/i.test(title)) return "packaging";
  if (
    /\b(pricing|price)\s+(ops|operations)\b/i.test(title)
    || (/\b(operations|ops|activation)\b/i.test(title) && /\bpric(?:e|ing)\b/i.test(title))
  ) {
    return "pricing-operations";
  }
  if (/\b(strateg\w*|scient\w*|optimi[sz]ation)\b/i.test(title)) return "pricing-strategy";
  if (/\b(chief|svp|evp|vp|vice president|head)\b/i.test(title)) return "pricing-leadership";
  if (/\bdirector\b/i.test(title)) return "pricing-director";
  if (/\bmanager\b/i.test(title)) return "pricing-manager";
  if (/\b(analyst|associate|specialist|coordinator|consultant)\b/i.test(title)) return "pricing-analyst";
  return "pricing";
}

export function seniorityFor(title) {
  if (/\bintern\b/i.test(title)) return "intern";
  if (/\b(chief|svp|evp|vp|vice president|head)\b/i.test(title)) return "vp";
  if (/\bdirector\b/i.test(title)) return "director";
  if (/\bmanager\b/i.test(title)) return "manager";
  if (/\b(senior|sr\.?|staff|principal|lead)\b/i.test(title)) return "senior";
  if (/\b(junior|jr\.?|associate|coordinator|entry[-\s]?level)\b/i.test(title)) return "entry";
  return "mid";
}

function contextualRevenueMatch(title) {
  if (/\b(accountant|accounting|bookkeeper)\b/i.test(title)) return false;
  if (/\brevenue\s+(operations|ops)\b/i.test(title)) return false;
  if (/\brevenue\s+analysts?\b/i.test(title)) {
    return HOSPITALITY.test(title) || /\b(yield|revenue\s+management)\b/i.test(title);
  }
  if (/\bdemand\s+analysts?\b/i.test(title)) {
    return /\b(pric(?:e|ing)|revenue|yield)\b/i.test(title);
  }
  return false;
}

export function classifyTitle(title) {
  const cleaned = String(title || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const strong = STRONG.some((pattern) => pattern.test(cleaned));
  if (!strong && !packagingMatch(cleaned) && !contextualRevenueMatch(cleaned)) return null;
  if (EXCLUDE.some((pattern) => pattern.test(cleaned))) return null;
  if (isEngineering(cleaned)) return null;
  if (/\bresearcher\b/i.test(cleaned) && !/\bpricing researcher\b/i.test(cleaned)) return null;
  if (/\baccounting\b/i.test(cleaned) && !/\b(pric(?:e|ing)|moneti[sz]|deal\s*desk)\b/i.test(cleaned)) return null;
  if (/\bsales\s+(operations|ops)\b/i.test(cleaned) && !/\b(pric(?:e|ing)|moneti[sz]|deal\s*desk)\b/i.test(cleaned)) return null;
  const revenueOpsException = /\b(pric(?:e|ing)|moneti[sz]|deal\s*desk|revenue\s+management|yield)\b/i.test(cleaned)
    || /\brevenue\s+strateg/i.test(cleaned)
    || /\brev\.?\s+strateg/i.test(cleaned);
  if (/\brevenue\s+(operations|ops)\b/i.test(cleaned) && !revenueOpsException) return null;
  return {
    category: categoryFor(cleaned),
    seniority: seniorityFor(cleaned),
  };
}

export function isFresh(iso, now = Date.now()) {
  const posted = Date.parse(iso);
  if (Number.isNaN(posted)) return false;
  return now - posted <= MAX_AGE_MS;
}
