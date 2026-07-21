const REPORT_EMAIL = "markroweuk@icloud.com";
const DRIVE_FOLDER_NAME = "Cambria Vehicle Check Photos";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");

    if (data.action !== "submitInspection") {
      return jsonResponse({status:"error", message:"Unknown action"});
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const inspections = requireSheet(ss, "Inspections");
    const answers = requireSheet(ss, "Inspection Answers");
    const defects = requireSheet(ss, "Defects");

    const photoLinks = savePhotos(data.inspectionId, data.vehicle, data.photos || []);

    inspections.appendRow([
      data.inspectionId,
      data.date,
      data.time,
      data.vehicle,
      data.driver,
      data.startMileage,
      data.finishMileage || "",
      data.departureTime || "",
      data.returnTime || "",
      data.result,
      data.towingRequired,
      data.driverDeclaration,
      data.defects || "",
      photoLinks.join("\n")
    ]);

    (data.answers || []).forEach(answer => {
      answers.appendRow([
        data.inspectionId,
        answer.questionRef,
        answer.question,
        answer.answer
      ]);
    });

    if (data.result === "DEFECT") {
      defects.appendRow([
        "DEF-" + Utilities.getUuid().slice(0,8).toUpperCase(),
        data.inspectionId,
        data.vehicle,
        data.defects || "Defect reported",
        photoLinks.join("\n"),
        new Date(),
        "OPEN",
        "",
        "",
        ""
      ]);
    }

    sendReportEmail(data, photoLinks);

    return jsonResponse({status:"success", inspectionId:data.inspectionId});

  } catch (error) {
    console.error(error);
    return jsonResponse({status:"error", message:String(error)});
  }
}

function requireSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Missing sheet tab: " + name);
  return sheet;
}

function savePhotos(inspectionId, vehicle, photos) {
  if (!photos.length) return [];

  const root = getOrCreateFolder(DRIVE_FOLDER_NAME);
  const checkFolder = root.createFolder(inspectionId + " - " + vehicle);

  return photos.map(photo => {
    const bytes = Utilities.base64Decode(photo.data);
    const blob = Utilities.newBlob(bytes, photo.mimeType, photo.name);
    const file = checkFolder.createFile(blob);
    return file.getUrl();
  });
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function sendReportEmail(data, photoLinks) {
  const answersHtml = (data.answers || []).map(a =>
    "<tr><td>" + html(a.questionRef) + "</td><td>" + html(a.question) +
    "</td><td><b>" + html(a.answer) + "</b></td></tr>"
  ).join("");

  const htmlBody =
    "<h2>Cambria Vehicle Check</h2>" +
    "<p><b>Reference:</b> " + html(data.inspectionId) + "<br>" +
    "<b>Vehicle:</b> " + html(data.vehicle) + "<br>" +
    "<b>Driver:</b> " + html(data.driver) + "<br>" +
    "<b>Start mileage:</b> " + html(data.startMileage) + "<br>" +
    "<b>Estimated use:</b> " + html(data.departureTime || "") + " – " + html(data.returnTime || "") + "<br>" +
    "<b>Result:</b> " + html(data.result) + "<br>" +
    "<b>Towing required:</b> " + html(data.towingRequired) + "</p>" +
    "<p><b>Defects:</b><br>" + html(data.defects || "None") + "</p>" +
    "<h3>Inspection answers</h3>" +
    "<table border='1' cellpadding='6' cellspacing='0'>" +
    "<tr><th>Ref</th><th>Question</th><th>Answer</th></tr>" + answersHtml + "</table>" +
    (photoLinks.length ? "<p><b>Photo links:</b><br>" + photoLinks.map(html).join("<br>") + "</p>" : "") +
    "<p>The driver confirmed that the information was correct and that they hold the relevant driving licence.</p>";

  MailApp.sendEmail({
    to: REPORT_EMAIL,
    subject: "Vehicle Check - " + data.vehicle + " - " + data.inspectionId,
    htmlBody: htmlBody
  });
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function html(value) {
  return String(value || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}