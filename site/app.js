const body = document.body;
const filters = document.querySelector("#filters");
const fields = {
  q: document.querySelector("#q"),
  category: document.querySelector("#category"),
  seniority: document.querySelector("#seniority"),
  workplace: document.querySelector("#workplace"),
  salary: document.querySelector("#salary"),
};
const jobs = [...document.querySelectorAll("[data-job]")];
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty");

function valueOf(name) {
  if (body.dataset[name]) return body.dataset[name];
  const field = fields[name];
  if (!field) return "";
  if (field.type === "checkbox") return field.checked ? "1" : "";
  return field.value;
}

function applyFilters() {
  const query = (fields.q?.value || "").trim().toLowerCase();
  const category = valueOf("category");
  const seniority = valueOf("seniority");
  const workplace = valueOf("workplace");
  const salary = valueOf("salary");
  let shown = 0;
  for (const job of jobs) {
    const visible = (!query || job.dataset.search.includes(query))
      && (!category || job.dataset.category === category)
      && (!seniority || job.dataset.seniority === seniority)
      && (!workplace || job.dataset.workplace === workplace)
      && (!salary || job.dataset.salary === "1");
    job.hidden = !visible;
    if (visible) shown += 1;
  }
  if (count) count.textContent = String(shown);
  if (empty) empty.hidden = shown !== 0;

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (!body.dataset.category && category) params.set("category", category);
  if (!body.dataset.workplace && workplace) params.set("workplace", workplace);
  if (seniority) params.set("seniority", seniority);
  if (salary) params.set("salary", "1");
  const next = `${location.pathname}${params.size ? `?${params}` : ""}`;
  if (`${location.pathname}${location.search}` !== next) {
    history.replaceState(null, "", next);
  }
}

if (filters && jobs.length) {
  const params = new URLSearchParams(location.search);
  if (fields.q && params.get("q")) fields.q.value = params.get("q");
  for (const name of ["category", "seniority", "workplace"]) {
    if (fields[name] && params.get(name)) fields[name].value = params.get(name);
  }
  if (fields.salary && params.get("salary") === "1") fields.salary.checked = true;
  filters.addEventListener("submit", (event) => event.preventDefault());
  filters.addEventListener("input", applyFilters);
  filters.addEventListener("change", applyFilters);
  applyFilters();
}

document.querySelectorAll("[data-todo-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-todo-status]");
    if (status) status.hidden = false;
  });
});
