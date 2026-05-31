const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const draftKey = "duty-roster-form-draft-v1";

const elements = {
  form: document.querySelector("#availabilityForm"),
  memberName: document.querySelector("#memberName"),
  memberContact: document.querySelector("#memberContact"),
  rosterYear: document.querySelector("#rosterYear"),
  rosterMonth: document.querySelector("#rosterMonth"),
  dateCountLabel: document.querySelector("#dateCountLabel"),
  availabilityGrid: document.querySelector("#availabilityGrid"),
  selectAllButton: document.querySelector("#selectAllButton"),
  submitButton: document.querySelector("#submitButton"),
  submitStatus: document.querySelector("#submitStatus"),
};

const state = loadDraft();

function todayIso() {
  return toIsoDate(new Date());
}

function currentMonth() {
  return todayIso().slice(0, 7);
}

function getSelectedMonth() {
  return `${elements.rosterYear.value}-${elements.rosterMonth.value}`;
}

function populateMonthControls() {
  const currentYear = new Date().getFullYear();
  elements.rosterYear.innerHTML = "";
  for (let year = currentYear - 1; year <= currentYear + 2; year += 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    elements.rosterYear.appendChild(option);
  }

  elements.rosterMonth.innerHTML = "";
  for (let month = 1; month <= 12; month += 1) {
    const option = document.createElement("option");
    option.value = String(month).padStart(2, "0");
    option.textContent = `${month}月`;
    elements.rosterMonth.appendChild(option);
  }
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonthBounds(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function formatDate(value) {
  const date = parseIsoDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getWeekday(value) {
  return weekdayLabels[parseIsoDate(value).getDay()];
}

function loadDraft() {
  const fallback = {
    name: "",
    contact: "",
    rosterMonth: currentMonth(),
    availability: [],
  };

  try {
    const saved = JSON.parse(localStorage.getItem(draftKey));
    const migratedMonth = saved?.rosterMonth || saved?.startDate?.slice(0, 7);
    return { ...fallback, ...saved, rosterMonth: migratedMonth || fallback.rosterMonth };
  } catch {
    return fallback;
  }
}

function saveDraft() {
  localStorage.setItem(draftKey, JSON.stringify(state));
}

function getDateRange() {
  if (!state.rosterMonth) return [];

  const { startDate, endDate } = getMonthBounds(state.rosterMonth);
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  const dates = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(toIsoDate(cursor));
  }
  return dates;
}

function render() {
  elements.memberName.value = state.name;
  elements.memberContact.value = state.contact;
  const [year, month] = state.rosterMonth.split("-");
  elements.rosterYear.value = year;
  elements.rosterMonth.value = month;

  const dates = getDateRange();
  elements.dateCountLabel.textContent = `${dates.length} days`;
  elements.availabilityGrid.innerHTML = "";

  if (dates.length === 0) {
    elements.availabilityGrid.innerHTML = `<div class="empty-state">Please check the date range.</div>`;
    return;
  }

  dates.forEach((date) => {
    const available = state.availability.includes(date);
    const item = document.createElement("div");
    const inputId = `date-${date}`;
    item.className = `date-option${available ? " available" : ""}`;
    item.innerHTML = `
      <input id="${inputId}" class="date-checkbox" type="checkbox" data-date="${date}" ${available ? "checked" : ""} />
      <label for="${inputId}" class="date-label">
        <strong>${formatDate(date)}</strong>
        <span>${getWeekday(date)}</span>
      </label>
    `;
    elements.availabilityGrid.appendChild(item);
  });
}

function syncDraftFromInputs() {
  state.name = elements.memberName.value;
  state.contact = elements.memberContact.value;
  state.rosterMonth = getSelectedMonth();
  const validDates = new Set(getDateRange());
  state.availability = state.availability.filter((date) => validDates.has(date));
  saveDraft();
  render();
}

function syncTextDraft() {
  state.name = elements.memberName.value;
  state.contact = elements.memberContact.value;
  saveDraft();
}

function setStatus(message, tone = "") {
  elements.submitStatus.className = `status-strip ${tone}`;
  elements.submitStatus.textContent = message;
}

async function submitAvailability() {
  const apiUrl = window.ROSTER_CONFIG?.apiUrl?.trim();
  if (!apiUrl) {
    setStatus("Google Apps Script URL is not configured yet. Paste it into assets/config.js.", "warning");
    return;
  }
  if (state.availability.length === 0) {
    setStatus("Please select at least one available date.", "warning");
    return;
  }
  elements.submitButton.disabled = true;
  setStatus("Submitting...");

  try {
    const { startDate, endDate } = getMonthBounds(state.rosterMonth);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "submit",
        name: state.name.trim(),
        contact: state.contact.trim(),
        rosterMonth: state.rosterMonth,
        startDate,
        endDate,
        availability: state.availability,
      }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Submit failed");
    setStatus("Submitted. Submit again later to replace the previous response for this name.", "good");
  } catch (error) {
    setStatus(`Submit failed: ${error.message}`, "warning");
  } finally {
    elements.submitButton.disabled = false;
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  syncDraftFromInputs();
  submitAvailability();
});

elements.memberName.addEventListener("input", syncTextDraft);
elements.memberContact.addEventListener("input", syncTextDraft);
elements.rosterYear.addEventListener("change", syncDraftFromInputs);
elements.rosterMonth.addEventListener("change", syncDraftFromInputs);

elements.availabilityGrid.addEventListener("change", (event) => {
  const input = event.target.closest(".date-checkbox");
  if (!input) return;

  if (input.checked && !state.availability.includes(input.dataset.date)) {
    state.availability.push(input.dataset.date);
  }
  if (!input.checked) {
    state.availability = state.availability.filter((date) => date !== input.dataset.date);
  }

  state.availability.sort();
  saveDraft();
  render();
});

elements.selectAllButton.addEventListener("click", () => {
  const dates = getDateRange();
  state.availability = state.availability.length === dates.length ? [] : dates;
  saveDraft();
  render();
});

populateMonthControls();
render();
