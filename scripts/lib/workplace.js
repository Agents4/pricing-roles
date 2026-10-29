export function workplaceFromSignals({ location = "", title = "", workplaceType = "", isRemote = false } = {}) {
  const type = String(workplaceType || "").toLowerCase().replace(/[\s_]/g, "");
  if (type === "hybrid") return "hybrid";
  if (type === "remote") return "remote";
  if (type === "onsite") return "onsite";

  const blob = `${title} ${location}`.toLowerCase();
  if (/\bhybrid\b/.test(blob)) return "hybrid";
  if (/\bremote\b/.test(blob)) return "remote";
  if (/\b(on-?site|in-?office)\b/.test(blob)) return "onsite";
  if (isRemote === true && !String(location || "").trim()) return "remote";
  if (String(location || "").trim()) return "onsite";
  if (isRemote === true) return "remote";
  return "unknown";
}
