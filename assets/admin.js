const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const settingsKey = "duty-roster-admin-settings-v1";

const elements = {
  settingsForm: document.querySelector("#settingsForm"),
  rosterYear: document.querySelector("#rosterYear"),
  rosterMonth: document.querySelector("#rosterMonth"),
  slotsPerDay: document.querySelector("#slotsPerDay"),
  restDays: document.querySelector("#restDays"),
  dateCountLabel: document.querySelector("#dateCountLabel"),
  responseCountLabel: document.querySelector("#responseCountLabel"),
  backendStatus: document.querySelector("#backendStatus"),
  responsesTable: document.querySelector("#responsesTable"),
  rosterTable: document.querySelector("#rosterTable"),
  rosterStatus: document.querySelector("#rosterStatus"),
  rosterSummary: document.querySelector("#rosterSummary"),
  loadResponsesButton: document.querySelector("#loadResponsesButton"),
  buildRosterButton: document.querySelector("#buildRosterButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
};

const state = {
  settings: loadSettings(),
  responses: [],
  roster: [],
};

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

function loadSettings() {
  const fallback = {
    rosterMonth: currentMonth(),
    slotsPerDay: 1,
    restDays: 1,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    const migratedMonth = saved?.rosterMonth || saved?.startDate?.slice(0, 7);
    return { ...fallback, ...saved, rosterMonth: migratedMonth || fallback.rosterMonth };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(state.settings));
}

function getDateRange() {
  if (!state.settings.rosterMonth) return [];

  const { startDate, endDate } = getMonthBounds(state.settings.rosterMonth);
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  const dates = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(toIsoDate(cursor));
  }
  return dates;
}

function render() {
  renderSettings();
  renderResponses();
  renderRoster();
}

function renderSettings() {
  const [year, month] = state.settings.rosterMonth.split("-");
  elements.rosterYear.value = year;
  elements.rosterMonth.value = month;
  elements.slotsPerDay.value = state.settings.slotsPerDay;
  elements.restDays.value = state.settings.restDays;
  elements.dateCountLabel.textContent = `${getDateRange().length} days`;
  elements.responseCountLabel.textContent = `${state.responses.length} responses`;
}

function renderResponses() {
  elements.responsesTable.innerHTML = "";

  if (state.responses.length === 0) {
    elements.responsesTable.innerHTML = `<tr><td colspan="3">No responses loaded.</td></tr>`;
    return;
  }

  state.responses.forEach((response) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(response.name)}</td>
      <td>${escapeHtml(response.contact || "")}</td>
      <td>${response.availability.map(formatDate).join(", ")}</td>
    `;
    elements.responsesTable.appendChild(tr);
  });
}

function renderRoster() {
  elements.rosterTable.innerHTML = "";
  elements.rosterSummary.textContent = state.roster.length ? `${state.roster.length} days` : "Not generated";

  if (state.roster.length === 0) {
    elements.rosterStatus.className = "status-strip";
    elements.rosterStatus.textContent = "Load responses, then generate the roster.";
    return;
  }

  const shortageCount = state.roster.filter((row) => row.shortage > 0).length;
  elements.rosterStatus.className = `status-strip ${shortageCount ? "warning" : "good"}`;
  elements.rosterStatus.textContent = shortageCount
    ? `${shortageCount} days are short-staffed. Adjust availability or slots per day.`
    : "Roster generated. Every date has enough people.";

  state.roster.forEach((row) => {
    const assignment = row.assigned.length
      ? `<div class="assignment-list">${row.assigned
          .map((name) => `<span class="pill">${escapeHtml(name)}</span>`)
          .join("")}</div>`
      : `<span class="shortage">Unassigned</span>`;
    const status = row.shortage
      ? `<span class="shortage">Short ${row.shortage}</span>`
      : "Filled";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(row.date)}</td>
      <td>${getWeekday(row.date)}</td>
      <td>${assignment}</td>
      <td>${status}</td>
    `;
    elements.rosterTable.appendChild(tr);
  });
}

function syncSettingsFromForm() {
  state.settings.rosterMonth = getSelectedMonth();
  state.settings.slotsPerDay = Math.max(1, Number(elements.slotsPerDay.value || 1));
  state.settings.restDays = Math.max(0, Number(elements.restDays.value || 0));
  state.roster = [];
  saveSettings();
  render();
}

async function loadResponses() {
  const apiUrl = window.ROSTER_CONFIG?.apiUrl?.trim();
  if (!apiUrl) {
    setBackendStatus("Google Apps Script URL is not configured", "warning");
    return;
  }

  elements.loadResponsesButton.disabled = true;
  setBackendStatus("Loading...");

  try {
    const url = new URL(apiUrl);
    url.searchParams.set("action", "list");
    const response = await fetch(url);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Load failed");
    state.responses = normalizeResponses(result.responses);
    state.roster = [];
    setBackendStatus("Loaded", "good");
    render();
  } catch (error) {
    setBackendStatus(`Load failed: ${error.message}`, "warning");
  } finally {
    elements.loadResponsesButton.disabled = false;
  }
}

function normalizeResponses(responses) {
  if (!Array.isArray(responses)) return [];
  return responses
    .map((response) => ({
      name: String(response.name || "").trim(),
      contact: String(response.contact || "").trim(),
      availability: Array.isArray(response.availability) ? response.availability : [],
    }))
    .filter((response) => response.name && response.availability.length > 0);
}

function buildRoster() {
  const dates = getDateRange();
  const slots = Number(state.settings.slotsPerDay);
  const restDays = Number(state.settings.restDays);
  const counters = new Map(state.responses.map((response) => [response.name, 0]));
  const lastAssignedIndex = new Map();

  state.roster = dates.map((date, index) => {
    const candidates = state.responses
      .filter((response) => response.availability.includes(date))
      .filter((response) => {
        const last = lastAssignedIndex.get(response.name);
        return last === undefined || index - last > restDays;
      })
      .sort((a, b) => {
        const countDiff = (counters.get(a.name) ?? 0) - (counters.get(b.name) ?? 0);
        if (countDiff !== 0) return countDiff;
        return a.name.localeCompare(b.name, "zh-Hant");
      });

    const assigned = candidates.slice(0, slots);
    assigned.forEach((response) => {
      counters.set(response.name, (counters.get(response.name) ?? 0) + 1);
      lastAssignedIndex.set(response.name, index);
    });

    return {
      date,
      assigned: assigned.map((response) => response.name),
      shortage: Math.max(0, slots - assigned.length),
    };
  });

  renderRoster();
}

function exportCsv() {
  if (state.roster.length === 0) buildRoster();

  const rows = [
    ["Date", "Weekday", "Assignees", "Status"],
    ...state.roster.map((row) => [
      row.date,
      getWeekday(row.date),
      row.assigned.join(", "),
      row.shortage ? `Short ${row.shortage}` : "Filled",
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`roster_${state.settings.rosterMonth}.csv`, csv, "text/csv;charset=utf-8");
}

function setBackendStatus(message, tone = "") {
  elements.backendStatus.className = tone;
  elements.backendStatus.textContent = message;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.settingsForm.addEventListener("input", syncSettingsFromForm);
elements.settingsForm.addEventListener("change", syncSettingsFromForm);
elements.loadResponsesButton.addEventListener("click", loadResponses);
elements.buildRosterButton.addEventListener("click", buildRoster);
elements.exportCsvButton.addEventListener("click", exportCsv);

populateMonthControls();
render();
