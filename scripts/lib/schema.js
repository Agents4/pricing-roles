import { categoryMeta } from "./classify.js";

const US_STATE = /\b(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV)\b/;

export function detectCountry(location) {
  const value = String(location || "");
  const text = value.toLowerCase();
  if (/\b(united states|u\.s\.a\.|usa)\b/.test(text) || /\bremote\s*[-–]\s*u\.?s\.?a?\.?\b/.test(text) || /,\s*us$/i.test(value)) {
    return "United States";
  }
  if (/\b(united kingdom|u\.k\.|great britain|england|scotland|wales)\b/.test(text) || /\bremote\s*[-–]\s*uk\b/.test(text) || /,\s*uk$/i.test(value)) {
    return "United Kingdom";
  }
  if (/\bcanada\b/.test(text)) return "Canada";
  if (/\b(germany|deutschland)\b/.test(text)) return "Germany";
  if (/\bireland\b/.test(text)) return "Ireland";
  if (/\bfrance\b/.test(text)) return "France";
  if (/\b(netherlands|the netherlands)\b/.test(text)) return "Netherlands";
  if (/\baustralia\b/.test(text)) return "Australia";
  if (/\bindia\b/.test(text)) return "India";
  if (/\bsingapore\b/.test(text)) return "Singapore";
  if (/\bbrazil\b/.test(text)) return "Brazil";
  if (/\bmexico\b/.test(text)) return "Mexico";
  if (/\bspain\b/.test(text)) return "Spain";
  if (/\bpoland\b/.test(text)) return "Poland";
  if (/\bjapan\b/.test(text)) return "Japan";
  if (/\bisrael\b/.test(text)) return "Israel";
  if (/\b(portugal)\b/.test(text)) return "Portugal";
  if (/\b(sweden)\b/.test(text)) return "Sweden";
  if (/\b(denmark)\b/.test(text)) return "Denmark";
  if (/\b(norway)\b/.test(text)) return "Norway";
  if (/\b(finland)\b/.test(text)) return "Finland";
  if (/\b(italy)\b/.test(text)) return "Italy";
  if (/\b(switzerland)\b/.test(text)) return "Switzerland";
  if (/\b(austria)\b/.test(text)) return "Austria";
  if (/\b(belgium)\b/.test(text)) return "Belgium";
  if (/\b(new zealand)\b/.test(text)) return "New Zealand";
  if (US_STATE.test(value)) return "United States";
  return null;
}

export function employmentType(title) {
  if (/\bintern\b/i.test(title)) return "INTERN";
  if (/\b(contract|contractor)\b/i.test(title)) return "CONTRACTOR";
  if (/\bpart[-\s]?time\b/i.test(title)) return "PART_TIME";
  if (/\btemporary\b/i.test(title)) return "TEMPORARY";
  return "FULL_TIME";
}

export function validThrough(postedAt, now = Date.now()) {
  const posted = Date.parse(postedAt);
  const end = posted + 60 * 24 * 60 * 60 * 1000;
  const floor = now + 14 * 24 * 60 * 60 * 1000;
  return new Date(Math.max(end, floor)).toISOString().slice(0, 10);
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function postalAddress(job) {
  const country = detectCountry(job.location);
  const loc = !job.location || job.location === "Unspecified" ? "" : job.location;
  const parts = loc.split(",").map((part) => part.trim()).filter(Boolean);
  const address = { "@type": "PostalAddress" };
  if (country) address.addressCountry = country;
  if (parts.length >= 2) {
    address.addressLocality = parts[0];
    address.addressRegion = parts[1];
  } else if (parts.length === 1) {
    address.addressLocality = parts[0];
  } else {
    address.addressLocality = job.workplace === "remote" ? "Remote" : "Unspecified";
  }
  return { address, country };
}

export function schemaDescription(job) {
  const body = String(job.description || "").replace(/\s+/g, " ").trim();
  const lead = `${job.title} at ${job.company}. ${job.location}.`;
  const text = body.length >= 40 ? body : `${lead} ${body}`.trim();
  return text.slice(0, 5000);
}

export function jobPostingJsonLd(job, canonical, now = Date.now()) {
  const { address, country } = postalAddress(job);
  const category = categoryMeta(job.category);
  const posting = {
    "@type": "JobPosting",
    title: job.title,
    description: schemaDescription(job),
    datePosted: String(job.postedAt).slice(0, 10),
    validThrough: validThrough(job.postedAt, now),
    employmentType: employmentType(job.title),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
    },
    identifier: {
      "@type": "PropertyValue",
      name: "PricingRoles",
      value: job.id,
    },
    url: canonical,
    jobLocation: {
      "@type": "Place",
      address,
    },
  };
  const sameAs = originOf(job.applyUrl);
  if (sameAs) posting.hiringOrganization.sameAs = sameAs;
  if (job.workplace === "remote") {
    posting.jobLocationType = "TELECOMMUTE";
    if (country) {
      posting.applicantLocationRequirements = { "@type": "Country", name: country };
    }
  }
  if (job.salaryMin != null || job.salaryMax != null) {
    const unit = { year: "YEAR", month: "MONTH", hour: "HOUR" }[job.salaryInterval] || "YEAR";
    posting.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salaryCurrency || "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salaryMin ?? job.salaryMax,
        maxValue: job.salaryMax ?? job.salaryMin,
        unitText: unit,
      },
    };
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      posting,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PricingRoles", item: "https://pricingroles.com/" },
          {
            "@type": "ListItem",
            position: 2,
            name: category?.name || "Pricing",
            item: `https://pricingroles.com/category/${job.category}/`,
          },
          { "@type": "ListItem", position: 3, name: job.title, item: canonical },
        ],
      },
    ],
  };
}
