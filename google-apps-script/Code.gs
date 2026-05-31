const SHEET_NAME = "responses";

function doGet(e) {
  const action = e.parameter.action || "list";
  if (action !== "list") {
    return jsonOutput({ ok: false, error: "Unknown action" });
  }

  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);
  const latestByName = new Map();

  rows.forEach((row) => {
    const [submittedAt, name, contact, startDate, endDate, availabilityJson] = row;
    if (!name) return;
    latestByName.set(String(name).trim(), {
      submittedAt,
      name: String(name).trim(),
      contact: String(contact || "").trim(),
      startDate,
      endDate,
      availability: safeParseAvailability(availabilityJson),
    });
  });

  return jsonOutput({
    ok: true,
    responses: Array.from(latestByName.values()),
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (payload.action !== "submit") {
      return jsonOutput({ ok: false, error: "Unknown action" });
    }

    const name = String(payload.name || "").trim();
    if (!name) {
      return jsonOutput({ ok: false, error: "Name is required" });
    }

    const availability = Array.isArray(payload.availability)
      ? payload.availability.map(String).filter(Boolean)
      : [];
    if (availability.length === 0) {
      return jsonOutput({ ok: false, error: "Availability is required" });
    }

    getSheet().appendRow([
      new Date(),
      name,
      String(payload.contact || "").trim(),
      String(payload.startDate || ""),
      String(payload.endDate || ""),
      JSON.stringify(availability),
    ]);

    return jsonOutput({ ok: true });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["submittedAt", "name", "contact", "startDate", "endDate", "availabilityJson"]);
  }

  return sheet;
}

function safeParseAvailability(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
