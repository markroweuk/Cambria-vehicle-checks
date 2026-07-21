/**
 * Cambria Vehicle Check — Google Apps Script backend v3.4
 *
 * Required sheet tabs:
 * - Vehicle Register
 * - Drivers
 * - Inspections
 * - Inspection Answers
 * - Defects
 *
 * Deploy as a Web app:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * IMPORTANT:
 * Paste your spreadsheet ID below, save, then deploy a NEW VERSION.
 */

const SPREADSHEET_ID = "PASTE_SPREADSHEET_ID_HERE";
const REPORT_RECIPIENT = "markroweuk@icloud.com";

const SHEETS = {
  vehicles: "Vehicle Register",
  drivers: "Drivers",
  inspections: "Inspections",
  answers: "Inspection Answers",
  defects: "Defects"
};

function doGet(e) {
  try {
    const action = String(e?.parameter?.action || "bootstrap").toLowerCase();

    if (action === "bootstrap") {
      return jsonResponse({
        ok: true,
        vehicles: getVehicles(),
        drivers: getDrivers(),
        generatedAt: new Date().toISOString()
      });
    }

    if (action === "health") {
      return jsonResponse({
        ok: true,
        service: "Cambria Vehicle Check",
        generatedAt: new Date().toISOString()
      });
    }

    throw new Error(`Unsupported GET action: ${action}`);
  } catch (error) {
    console.error(error);
    return jsonResponse({ok: false, error: String(error)});
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e?.postData?.contents || "{}");

    if (payload.action !== "submitInspection") {
      throw new Error("Unsupported POST action");
    }

    validateSubmission(payload);

    const ss = getSpreadsheet();
    appendInspection(ss, payload);
    appendAnswers(ss, payload);
    appendDefectIfRequired(ss, payload);
    sendReport(payload);

    return jsonResponse({
      ok: true,
      inspectionId: payload.inspectionId
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ok: false, error: String(error)});
  }
}

function getVehicles() {
  const sheet = requireSheet(SHEETS.vehicles);
  const records = readRecords(sheet);

  return records
    .map(row => ({
      registration: firstValue(row, [
        "registration", "vehicle registration", "reg", "vehicle"
      ]),
      type: firstValue(row, [
        "type", "vehicle type", "description", "make/model", "make model"
      ]),
      category: firstValue(row, [
        "category", "vehicle category", "class"
      ]),
      seats: toOptionalNumber(firstValue(row, [
        "seats", "number of seats", "seat count", "seating"
      ])),
      tailLift: normaliseYesNo(firstValue(row, [
        "tail lift", "taillift", "tail lift fitted"
      ])),
      notes: firstValue(row, [
        "notes", "note", "comments"
      ]),
      active: toActive(firstValue(row, [
        "active", "status", "enabled", "in service"
      ]))
    }))
    .filter(vehicle => vehicle.registration && vehicle.active);
}

function getDrivers() {
  const sheet = requireSheet(SHEETS.drivers);
  const records = readRecords(sheet);

  return records
    .map(row => ({
      name: firstValue(row, [
        "name", "driver", "driver name", "full name"
      ]),
      active: toActive(firstValue(row, [
        "active", "status", "enabled", "current"
      ]))
    }))
    .filter(driver => driver.name && driver.active);
}

function appendInspection(ss, payload) {
  const sheet = requireSheet(SHEETS.inspections, ss);

  appendByHeaders(sheet, {
    "inspection id": payload.inspectionId,
    "inspectionid": payload.inspectionId,
    "reference": payload.inspectionId,
    "date": payload.date,
    "time": payload.time,
    "vehicle": payload.vehicle,
    "registration": payload.vehicle,
    "driver": payload.driver,
    "start mileage": payload.startMileage,
    "startmileage": payload.startMileage,
    "finish mileage": payload.finishMileage || "",
    "finishmileage": payload.finishMileage || "",
    "departure time": payload.departureTime || "",
    "departure": payload.departureTime || "",
    "return time": payload.returnTime || "",
    "return": payload.returnTime || "",
    "result": payload.result,
    "towing required": payload.towingRequired,
    "towing": payload.towingRequired,
    "driver declaration": payload.driverDeclaration,
    "information declaration": payload.informationDeclaration,
    "licence declaration": payload.licenceDeclaration,
    "defects": payload.defects || "",
    "submitted at": new Date(),
    "timestamp": new Date()
  });
}

function appendAnswers(ss, payload) {
  const sheet = requireSheet(SHEETS.answers, ss);

  (payload.answers || []).forEach(answer => {
    appendByHeaders(sheet, {
      "inspection id": payload.inspectionId,
      "inspectionid": payload.inspectionId,
      "reference": payload.inspectionId,
      "question ref": answer.questionRef,
      "questionref": answer.questionRef,
      "question": answer.question,
      "answer": answer.answer
    });
  });
}

function appendDefectIfRequired(ss, payload) {
  if (payload.result !== "DEFECT") return;

  const sheet = requireSheet(SHEETS.defects, ss);
  const defectId = `DEF-${payload.inspectionId}`;

  appendByHeaders(sheet, {
    "defect id": defectId,
    "defectid": defectId,
    "inspection id": payload.inspectionId,
    "inspectionid": payload.inspectionId,
    "vehicle": payload.vehicle,
    "registration": payload.vehicle,
    "driver": payload.driver,
    "defect": payload.defects || "Defect reported",
    "description": payload.defects || "Defect reported",
    "reported at": new Date(),
    "date reported": new Date(),
    "status": "OPEN",
    "resolved at": "",
    "resolution": ""
  });
}

function sendReport(payload) {
  const answerLines = (payload.answers || [])
    .map(answer =>
      `${answer.questionRef} — ${answer.question}: ${answer.answer}`
    )
    .join("\n");

  const subject =
    `Vehicle check ${payload.result}: ${payload.vehicle} — ${payload.inspectionId}`;

  const body = [
    "Cambria Vehicle Check",
    "",
    `Reference: ${payload.inspectionId}`,
    `Vehicle: ${payload.vehicle}`,
    `Driver: ${payload.driver}`,
    `Date: ${payload.date} ${payload.time}`,
    `Start mileage: ${payload.startMileage}`,
    `Estimated use: ${payload.departureTime || "Not entered"} - ${payload.returnTime || "Not entered"}`,
    `Result: ${payload.result}`,
    `Towing required: ${payload.towingRequired}`,
    `Defects: ${payload.defects || "None reported"}`,
    "",
    "Inspection answers",
    answerLines
  ].join("\n");

  MailApp.sendEmail(REPORT_RECIPIENT, subject, body);
}

function validateSubmission(payload) {
  const required = [
    "inspectionId",
    "vehicle",
    "driver",
    "startMileage",
    "result"
  ];

  required.forEach(field => {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      throw new Error(`Missing required field: ${field}`);
    }
  });

  if (!Array.isArray(payload.answers) || !payload.answers.length) {
    throw new Error("Inspection answers are missing");
  }
}

function getSpreadsheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") {
    throw new Error("SPREADSHEET_ID has not been configured");
  }

  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function requireSheet(name, spreadsheet) {
  const ss = spreadsheet || getSpreadsheet();
  const sheet = ss.getSheetByName(name);

  if (!sheet) {
    throw new Error(`Required sheet not found: ${name}`);
  }

  return sheet;
}

function readRecords(sheet) {
  const values = sheet.getDataRange().getDisplayValues();

  if (values.length < 2) return [];

  const headers = values[0].map(normaliseHeader);

  return values.slice(1).map(row => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index];
    });
    return record;
  });
}

function appendByHeaders(sheet, valuesByHeader) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];

  if (!headers.some(value => String(value).trim())) {
    throw new Error(`Sheet "${sheet.getName()}" has no header row`);
  }

  const normalisedValues = {};
  Object.keys(valuesByHeader).forEach(key => {
    normalisedValues[normaliseHeader(key)] = valuesByHeader[key];
  });

  const row = headers.map(header => {
    const key = normaliseHeader(header);
    return Object.prototype.hasOwnProperty.call(normalisedValues, key)
      ? normalisedValues[key]
      : "";
  });

  sheet.appendRow(row);
}

function firstValue(record, aliases) {
  for (const alias of aliases) {
    const value = record[normaliseHeader(alias)];
    if (value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function normaliseHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function toActive(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text) return true;

  return ![
    "no", "n", "false", "0", "inactive", "disabled",
    "archived", "off", "left", "out of service"
  ].includes(text);
}

function normaliseYesNo(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["yes", "y", "true", "1", "fitted"].includes(text) ? "Yes" : "No";
}

function toOptionalNumber(value) {
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
