const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBZ4CVwLbZ6j7tNmvP_Y92V8TPUSmJwyqX-wmRsiUsrH4Oahe63xHww5ug9b7PsTk7/exec";
const HISTORY_KEY = "cambriaVehicleChecksV21";
const LAST_SUBMISSION_KEY = "cambriaVehicleLastSubmission";
const BOOTSTRAP_CACHE_KEY = "cambriaVehicleBootstrapV42";
const DASHBOARD_CACHE_KEY = "cambriaVehicleDashboardV42";

const QUESTION_DEFS = [
  {ref:"Q001", text:"Horn working correctly"},
  {ref:"Q002", text:"Washers and wipers working correctly"},
  {ref:"Q003", text:"Tyres appear safe, correctly inflated and undamaged"},
  {ref:"Q004", text:"No visible fluid leaks"},
  {ref:"Q005", text:"Oil and water levels checked"},
  {ref:"Q006", text:"Mirrors secure, clean and correctly adjusted"},
  {ref:"Q007", text:"Lights and indicators working correctly"},
  {ref:"Q008", text:"Steering operates satisfactorily"},
  {ref:"Q009", text:"Brakes operate satisfactorily"},
  {ref:"Q010", text:"Is there any other damage not already listed?", special:"yesDefect"},
  {ref:"Q011", text:"Will the vehicle be used for towing?", special:"towing"}
];

let vehicles = [];
let drivers = [];
let answers = {};
let currentReference = "";

const el = id => document.getElementById(id);

const show = id => {
  const element = el(id);
  if (element) {
    element.classList.remove("hidden");
  } else {
    console.warn(`Missing HTML element: #${id}`);
  }
};

const hide = id => {
  const element = el(id);
  if (element) {
    element.classList.add("hidden");
  } else {
    console.warn(`Missing HTML element: #${id}`);
  }
};

function bindClick(id, handler) {
  const element = el(id);
  if (element) {
    element.addEventListener("click", handler);
  } else {
    console.warn(`Cannot bind click event: missing #${id}`);
  }
}

function bindChange(id, handler) {
  const element = el(id);
  if (element) {
    element.addEventListener("change", handler);
  } else {
    console.warn(`Cannot bind change event: missing #${id}`);
  }
}

document.addEventListener("DOMContentLoaded", init);

async function init(){
  try {
    const bootstrap = await loadBootstrapData();
    vehicles = Array.isArray(bootstrap.vehicles) ? bootstrap.vehicles : [];
    drivers = Array.isArray(bootstrap.drivers) ? bootstrap.drivers : [];
  } catch (error) {
    console.error("Unable to load fleet data:", error);
    alert("Unable to load vehicles or drivers from Google Sheets. Please check your connection and try again.");
    return;
  }

  const vehicleSelect = el("vehicle");
  const driverSelect = el("driver");

  if (!vehicleSelect || !driverSelect) {
    console.error("Required HTML is missing: #vehicle or #driver.");
    alert("The vehicle-check page is incomplete. Please contact the administrator.");
    return;
  }

  const activeVehicles = vehicles.filter(v => v.active !== false && v.registration);
  const activeDrivers = drivers.filter(d => d.active !== false && d.name);

  vehicleSelect.innerHTML = activeVehicles
    .map(v => `<option value="${escapeHtml(v.registration)}">${escapeHtml(v.registration)}</option>`)
    .join("");

  driverSelect.innerHTML = [
    `<option value="">Select driver</option>`,
    ...activeDrivers.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`),
    `<option value="__OTHER__">Other — enter name</option>`
  ].join("");

  if (!activeVehicles.length) {
    alert("No active vehicles were found in the Vehicle Register sheet.");
    return;
  }

  if (!activeDrivers.length) {
    alert("No active drivers were found in the Drivers sheet.");
    return;
  }

  bindEvents();
  updateVehicleDetails();
  renderQuestions();
  updateProgress();

  renderDashboard().catch(displayError => {
    console.warn("Some optional dashboard elements are missing:", displayError);
  });
  renderLastSubmission();
}


async function loadBootstrapData() {
  const url = `${GOOGLE_SCRIPT_URL}?action=bootstrap&_=${Date.now()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Bootstrap request failed (${response.status})`);
    }

    const data = await response.json();

    if (!data || data.ok !== true) {
      throw new Error(data?.error || "Invalid bootstrap response");
    }

    if (!Array.isArray(data.vehicles) || !Array.isArray(data.drivers)) {
      throw new Error("Bootstrap response is missing vehicles or drivers");
    }

    localStorage.setItem(
      BOOTSTRAP_CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        vehicles: data.vehicles,
        drivers: data.drivers
      })
    );

    return data;
  } catch (networkError) {
    console.warn("Live fleet data unavailable; checking local cache:", networkError);

    try {
      const cached = JSON.parse(localStorage.getItem(BOOTSTRAP_CACHE_KEY) || "null");
      if (cached && Array.isArray(cached.vehicles) && Array.isArray(cached.drivers)) {
        return cached;
      }
    } catch (cacheError) {
      console.warn("Cached fleet data is unreadable:", cacheError);
    }

    throw networkError;
  }
}

function bindEvents() {
  bindChange("vehicle", updateVehicleDetails);
  bindChange("driver", updateCustomDriverVisibility);

  bindClick("vehicleNextBtn", () => goToStep("detailsStep"));
  bindClick("detailsBackBtn", () => goToStep("vehicleStep"));
  bindClick("inspectionStartBtn", beginInspection);
  bindClick("inspectionBackBtn", () => goToStep("detailsStep"));
  bindClick("reviewBtn", prepareReview);
  bindClick("reviewBackBtn", () => goToStep("inspectionStep"));
  bindClick("submitBtn", submitCheck);

  bindChange("damagePhotos", updatePhotoSummaries);
  bindChange("seatingPhoto", updatePhotoSummaries);

  bindClick("driverTab", () => switchView("driver"));
  bindClick("managerTab", () => switchView("manager"));
  bindClick("refreshDashboardBtn", () => renderDashboard(true));
  bindClick("homeBtn", resetToHome);
}

function switchView(view){
  const driver = view === "driver";

  const driverTab = el("driverTab");
  const managerTab = el("managerTab");
  const driverView = el("driverView");
  const managerView = el("managerView");

  if (driverTab) driverTab.classList.toggle("active", driver);
  if (managerTab) managerTab.classList.toggle("active", !driver);
  if (driverView) driverView.classList.toggle("hidden", !driver);
  if (managerView) managerView.classList.toggle("hidden", driver);

  if(!driver) {
    renderDashboard().catch(error => {
      console.warn("Unable to render manager dashboard:", error);
    });
  }
}

function goToStep(stepId){
  ["vehicleStep","detailsStep","inspectionStep","reviewStep"].forEach(hide);
  show(stepId);
  window.scrollTo({top:0, behavior:"smooth"});
}

function normaliseRegistration(value){
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const VEHICLE_PRESENTATION = {
  HC04XTL: {model:"Mercedes Sprinter", image:"images/vehicles/hc04xtl.svg"},
  YT60XTR: {model:"Ford Transit Mk7", image:"images/vehicles/yt60xtr.svg"},
  SC16LVY: {model:"Ford Transit Mk8", image:"images/vehicles/sc16lvy.svg"},
  MX10AYH: {model:"DAF 45 160", image:"images/vehicles/mx10ayh.svg"}
};

function updateVehicleDetails(){
  const v = selectedVehicle();
  const details = el("vehicleDetails");

  if(!v || !details) return;

  const presentation = VEHICLE_PRESENTATION[normaliseRegistration(v.registration)] || {};
  const seats = v.seats ? `${v.seats} seats` : "Not applicable";
  const displayModel = presentation.model || v.type || "Fleet vehicle";
  const imageHtml = presentation.image
    ? `<img class="vehicle-photo" src="${presentation.image}" alt="White ${escapeHtml(displayModel)}, registration ${escapeHtml(v.registration)}">`
    : "";

  details.innerHTML = `
    ${imageHtml}
    <div class="vehicle-copy">
      <strong class="vehicle-reg">${escapeHtml(v.registration)}</strong>
      <span class="vehicle-model">${escapeHtml(displayModel)} · White</span>
      <span>Category: ${escapeHtml(v.category)} · Seating: ${escapeHtml(String(seats))}</span>
      ${v.tailLift === "Yes" ? "<span>Tail lift fitted</span>" : ""}
      ${v.notes ? `<span>${escapeHtml(v.notes)}</span>` : ""}
    </div>
  `;
}

function updateCustomDriverVisibility(){
  const otherSelected = el("driver")?.value === "__OTHER__";
  const wrap = el("customDriverWrap");
  if (wrap) wrap.classList.toggle("hidden", !otherSelected);
  if (!otherSelected && el("customDriver")) el("customDriver").value = "";
}

function getDriverName(){
  const selected = el("driver")?.value || "";
  return selected === "__OTHER__" ? (el("customDriver")?.value.trim() || "") : selected;
}

function selectedVehicle(){
  const vehicleSelect = el("vehicle");
  if (!vehicleSelect) return null;
  return vehicles.find(v => v.registration === vehicleSelect.value);
}

function beginInspection(){
  const mileage = el("mileage");
  const driver = el("driver");

  if (!driver || !driver.value) {
    alert("Please select the driver.");
    return;
  }

  if (!getDriverName()) {
    alert("Please enter the driver's full name.");
    el("customDriver")?.focus();
    return;
  }

  if(!mileage || !mileage.value){
    alert("Please enter the start mileage.");
    return;
  }

  answers = {};
  renderQuestions();
  updateProgress();
  updateDefectPanel();
  updateSeatingPanel();
  goToStep("inspectionStep");
}

function renderQuestions(){
  const questionsContainer = el("questions");
  if (!questionsContainer) {
    console.warn("Missing HTML element: #questions");
    return;
  }

  questionsContainer.innerHTML = QUESTION_DEFS.map(q => `
    <div class="question-row ${q.special === "yesDefect" ? "yes-defect" : ""}">
      <div class="question-title">${q.ref} · ${escapeHtml(q.text)}</div>
      <div class="answer-buttons">
        <button type="button" class="answer-btn yes" data-ref="${q.ref}" data-answer="YES">YES</button>
        <button type="button" class="answer-btn no" data-ref="${q.ref}" data-answer="NO">NO</button>
      </div>
    </div>
  `).join("");

  questionsContainer.querySelectorAll(".answer-btn").forEach(button => {
    button.addEventListener("click", () => {
      const ref = button.dataset.ref;
      const value = button.dataset.answer;
      answers[ref] = value;

      button.closest(".answer-buttons")
        .querySelectorAll(".answer-btn")
        .forEach(b => b.classList.remove("selected"));

      button.classList.add("selected");
      updateProgress();
      updateDefectPanel();
    });
  });
}

function updateProgress(){
  const complete = Object.keys(answers).length;
  const failed = failedSafetyChecks().length;

  const progressText = el("progressText");
  if (progressText) {
    progressText.textContent = `${complete} of ${QUESTION_DEFS.length} checks completed`;
  }

  const pill = el("defectCount");
  if (!pill) return;

  if(failed){
    pill.textContent = `${failed} defect${failed === 1 ? "" : "s"}`;
    pill.className = "status-pill bad";
  }else if(complete === QUESTION_DEFS.length){
    pill.textContent = "Checks complete";
    pill.className = "status-pill good";
  }else{
    pill.textContent = "No defects";
    pill.className = "status-pill neutral";
  }
}

function failedSafetyChecks(){
  return QUESTION_DEFS.filter(q => {
    if (q.special === "towing") return false;
    if (q.special === "yesDefect") return answers[q.ref] === "YES";
    return answers[q.ref] === "NO";
  });
}

function updateDefectPanel(){
  const panel = el("defectPanel");
  if (panel) {
    panel.classList.toggle("hidden", failedSafetyChecks().length === 0);
  }
}

function updateSeatingPanel(){
  const panel = el("seatingPanel");
  if (panel) {
    const minibus = selectedVehicle()?.category === "Minibus";
    panel.classList.toggle("hidden", !minibus);
  }
}

function updatePhotoSummaries(){
  const damageInput = el("damagePhotos");
  const seatingInput = el("seatingPhoto");

  const damageFiles = damageInput ? [...damageInput.files] : [];
  const seatingFiles = seatingInput ? [...seatingInput.files] : [];

  const damageSummary = el("damageFileSummary");
  const seatingSummary = el("seatingFileSummary");

  if (damageSummary) {
    damageSummary.textContent = damageFiles.length
      ? `${damageFiles.length} damage photo${damageFiles.length === 1 ? "" : "s"} selected`
      : "No damage photos selected";
  }

  if (seatingSummary) {
    seatingSummary.textContent = seatingFiles.length
      ? seatingFiles[0].name
      : "No seating photo selected";
  }
}

function prepareReview(){
  if(Object.keys(answers).length !== QUESTION_DEFS.length){
    alert("Please answer every inspection question.");
    return;
  }

  const failed = failedSafetyChecks();
  const defectsField = el("defects");
  const seatingPhoto = el("seatingPhoto");

  if(failed.length && !defectsField?.value.trim()){
    alert("Please describe the defects before reviewing the submission.");
    return;
  }

  if(selectedVehicle()?.category === "Minibus" && (!seatingPhoto || seatingPhoto.files.length === 0)){
    alert("Please add the minibus seating photograph.");
    return;
  }

  const result = failed.length ? "DEFECT" : "OK";
  const towing = answers.Q011 === "YES" ? "Yes" : "No";
  const damageCount = el("damagePhotos")?.files.length || 0;
  const seatingCount = seatingPhoto?.files.length || 0;

  const answersHtml = QUESTION_DEFS.map(q => {
    const value = answers[q.ref];
    const fail = q.special === "yesDefect" ? value === "YES" : q.special !== "towing" && value === "NO";
    return `
      <div class="review-answer">
        <span>${q.ref} · ${escapeHtml(q.text)}</span>
        <span class="${fail ? "answer-fail" : "answer-pass"}">${value}</span>
      </div>`;
  }).join("");

  const reviewSummary = el("reviewSummary");
  if (!reviewSummary) {
    alert("The review screen is unavailable.");
    return;
  }

  reviewSummary.innerHTML = `
    <div class="review-block">
      <div class="review-grid">
        <div class="review-item"><span>Vehicle</span><strong>${escapeHtml(el("vehicle")?.value || "")}</strong></div>
        <div class="review-item"><span>Driver</span><strong>${escapeHtml(getDriverName())}</strong></div>
        <div class="review-item"><span>Start mileage</span><strong>${escapeHtml(el("mileage")?.value || "")}</strong></div>
        <div class="review-item"><span>Result</span><strong class="${result === "OK" ? "answer-pass" : "answer-fail"}">${result}</strong></div>
        <div class="review-item"><span>Estimated use</span><strong>${escapeHtml(el("departure")?.value || "Not entered")} – ${escapeHtml(el("returnTime")?.value || "Not entered")}</strong></div>
        <div class="review-item"><span>Towing</span><strong>${towing}</strong></div>
        <div class="review-item"><span>Damage photos</span><strong>${damageCount}</strong></div>
        <div class="review-item"><span>Seating photos</span><strong>${seatingCount}</strong></div>
      </div>
    </div>
    ${failed.length ? `<div class="review-block"><h3>Defect details</h3><p>${escapeHtml(defectsField?.value || "")}</p></div>` : ""}
    <div class="review-block"><h3>Inspection answers</h3>${answersHtml}</div>
  `;

  if (el("informationDeclaration")) el("informationDeclaration").checked = false;
  if (el("licenceDeclaration")) el("licenceDeclaration").checked = false;

  const submissionMessage = el("submissionMessage");
  if (submissionMessage) submissionMessage.className = "message hidden";

  goToStep("reviewStep");
}

async function submitCheck(){
  const informationDeclaration = el("informationDeclaration");
  const licenceDeclaration = el("licenceDeclaration");
  const submitButton = el("submitBtn");

  if(!informationDeclaration?.checked || !licenceDeclaration?.checked){
    showSubmissionMessage("Please confirm both declarations before submitting.", "error");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
  }

  currentReference = createReference();
  const failed = failedSafetyChecks();
  const result = failed.length ? "DEFECT" : "OK";

  let payload;

  try{
    const photos = await collectPhotos();

    payload = {
      action: "submitInspection",
      inspectionId: currentReference,
      date: new Date().toISOString().slice(0,10),
      time: new Date().toTimeString().slice(0,8),
      vehicle: el("vehicle")?.value || "",
      driver: getDriverName(),
      startMileage: el("mileage")?.value || "",
      finishMileage: "",
      departureTime: el("departure")?.value || "",
      returnTime: el("returnTime")?.value || "",
      result,
      towingRequired: answers.Q011 === "YES" ? "Yes" : "No",
      driverDeclaration: "Confirmed",
      informationDeclaration: "Confirmed",
      licenceDeclaration: "Confirmed",
      defects: el("defects")?.value.trim() || "",
      answers: QUESTION_DEFS.map(q => ({
        questionRef:q.ref,
        question:q.text,
        answer:answers[q.ref]
      })),
      photos
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });

  }catch(error){
    console.error("Submission request failed:", error);
    showSubmissionMessage(
      "The check could not be submitted. Your information remains on screen so you can try again.",
      "error"
    );
    return;

  }finally{
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit vehicle check";
    }
  }

  // The request reached Google Apps Script successfully. Any local display or
  // storage problem after this point must not be reported as a failed submission.
  try {
    saveLocalHistory(payload);

    localStorage.setItem(
      LAST_SUBMISSION_KEY,
      JSON.stringify({
        inspectionId: currentReference,
        vehicle: payload.vehicle,
        driver: payload.driver,
        submittedAt: new Date().toISOString()
      })
    );
  } catch (storageError) {
    console.warn("Submission succeeded, but local history could not be saved:", storageError);
  }

  showSubmissionSuccess(payload);

  try {
    renderDashboard();
    renderLastSubmission();
  } catch (displayError) {
    console.warn("Submission succeeded, but part of the display failed:", displayError);
  }
}

async function collectPhotos(){
  const damageInput = el("damagePhotos");
  const seatingInput = el("seatingPhoto");

  const damageFiles = damageInput ? [...damageInput.files] : [];
  const seatingFiles = seatingInput ? [...seatingInput.files] : [];

  const files = [
    ...damageFiles.map((file,index) => ({file, type:"damage", index:index+1})),
    ...seatingFiles.map((file,index) => ({file, type:"seating", index:index+1}))
  ];

  return Promise.all(files.map(async item => ({
    name:`${item.type}-${item.index}-${item.file.name}`,
    mimeType:item.file.type || "image/jpeg",
    type:item.type,
    data:(await fileToDataUrl(item.file)).split(",")[1]
  })));
}

function fileToDataUrl(file){
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createReference(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  return `VC-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function saveLocalHistory(payload){
  const records = getLocalHistory();
  records.unshift({
    inspectionId:payload.inspectionId,
    submittedAt:new Date().toISOString(),
    vehicle:payload.vehicle,
    driver:payload.driver,
    startMileage:payload.startMileage,
    result:payload.result,
    towingRequired:payload.towingRequired,
    defects:payload.defects,
    photoCount:payload.photos.length
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0,100)));
}

function getLocalHistory(){
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

async function loadDashboardData(forceRefresh = false){
  const url = `${GOOGLE_SCRIPT_URL}?action=dashboard&_=${Date.now()}`;

  try {
    const response = await fetch(url, {method:"GET", cache:"no-store"});
    if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);

    const data = await response.json();
    if (!data || data.ok !== true || !data.dashboard) {
      throw new Error(data?.error || "Invalid dashboard response");
    }

    const cached = {
      savedAt:new Date().toISOString(),
      dashboard:data.dashboard
    };
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cached));
    return {dashboard:data.dashboard, source:"live"};
  } catch (networkError) {
    console.warn("Live dashboard unavailable; checking dashboard cache:", networkError);
    try {
      const cached = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || "null");
      if (cached?.dashboard) return {dashboard:cached.dashboard, source:"cache", savedAt:cached.savedAt};
    } catch (cacheError) {
      console.warn("Cached dashboard data is unreadable:", cacheError);
    }
    throw networkError;
  }
}

async function renderDashboard(forceRefresh = false){
  const refreshButton = el("refreshDashboardBtn");
  const status = el("dashboardStatus");
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading…";
  }
  if (status) status.textContent = "Loading live data from Google Sheets…";

  ["metricChecks","metricDefects","metricVehicles"].forEach(id => {
    const node = el(id);
    if (node) node.textContent = "—";
  });

  try {
    const loaded = await loadDashboardData(forceRefresh);
    const data = loaded.dashboard || {};
    const records = Array.isArray(data.recentChecks) ? data.recentChecks : [];
    const defects = Array.isArray(data.openDefects) ? data.openDefects : [];
    const metrics = data.metrics || {};

    const metricChecks = el("metricChecks");
    const metricDefects = el("metricDefects");
    const metricVehicles = el("metricVehicles");
    if (metricChecks) metricChecks.textContent = Number(metrics.checks || 0);
    if (metricDefects) metricDefects.textContent = Number(metrics.openDefects || 0);
    if (metricVehicles) metricVehicles.textContent = Number(metrics.vehiclesChecked || 0);

    const recentChecks = el("recentChecks");
    if (recentChecks) {
      recentChecks.innerHTML = records.length
        ? records.slice(0,10).map(r => `
          <div class="list-item">
            <strong>${escapeHtml(r.vehicle || "Unknown vehicle")}</strong>
            <span class="tag ${r.result === "OK" ? "ok" : "defect"}">${escapeHtml(r.result || "UNKNOWN")}</span>
            <div>${escapeHtml(r.driver || "Driver not recorded")} · ${escapeHtml(r.inspectionId || "No reference")}</div>
            <div class="list-meta">${escapeHtml(formatDashboardDate(r))}${r.startMileage ? ` · Mileage ${escapeHtml(String(r.startMileage))}` : ""}</div>
          </div>`).join("")
        : `<div class="empty">No inspections are recorded in Google Sheets yet.</div>`;
    }

    const openDefects = el("openDefects");
    if (openDefects) {
      openDefects.innerHTML = defects.length
        ? defects.map(r => `
          <div class="list-item">
            <strong>${escapeHtml(r.vehicle || "Unknown vehicle")}</strong>
            <span class="tag defect">${escapeHtml(r.status || "OPEN")}</span>
            <div>${escapeHtml(r.description || "Defect reported")}</div>
            <div class="list-meta">${escapeHtml(r.inspectionId || r.defectId || "No reference")}${r.dateRaised ? ` · ${escapeHtml(r.dateRaised)}` : ""}</div>
          </div>`).join("")
        : `<div class="empty">There are no open defects in Google Sheets.</div>`;
    }

    const fleetOverview = el("fleetOverview");
    if (fleetOverview) {
      fleetOverview.innerHTML = vehicles.filter(v => v.active !== false).map(v => {
        const key = normaliseRegistration(v.registration);
        const latest = records.find(r => normaliseRegistration(r.vehicle) === key);
        const vehicleDefects = defects.filter(r => normaliseRegistration(r.vehicle) === key);
        const statusText = vehicleDefects.length ? "OPEN DEFECT" : (latest?.result || "NO CHECK");
        const tagClass = vehicleDefects.length || latest?.result === "DEFECT" ? "defect" : latest?.result === "OK" ? "ok" : "";
        return `
          <div class="list-item">
            <strong>${escapeHtml(v.registration)}</strong>
            <span class="tag ${tagClass}">${escapeHtml(statusText)}</span>
            <div>${escapeHtml(v.type || "Fleet vehicle")}</div>
            <div class="list-meta">${latest ? `Last check ${escapeHtml(formatDashboardDate(latest))} by ${escapeHtml(latest.driver || "Unknown driver")}` : "No inspection recorded"}</div>
          </div>`;
      }).join("");
    }

    if (status) {
      status.textContent = loaded.source === "live"
        ? `Live Google Sheets data · updated ${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`
        : `Offline cached dashboard · last saved ${formatDate(loaded.savedAt)}`;
    }
  } catch (error) {
    console.error("Dashboard load failed:", error);
    if (status) status.textContent = "Unable to load dashboard data. Check the Apps Script deployment and internet connection.";
    ["recentChecks","openDefects","fleetOverview"].forEach(id => {
      const node = el(id);
      if (node) node.innerHTML = `<div class="empty">Dashboard data could not be loaded.</div>`;
    });
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = "Refresh";
    }
  }
}

function formatDashboardDate(record){
  if (record?.submittedAt) return formatDate(record.submittedAt);
  const parts = [record?.date, record?.time].filter(Boolean);
  return parts.join(" ") || "Date not recorded";
}

function showSubmissionSuccess(payload) {
  hide("submissionMessage");
  hide("reviewActions");

  const successPanel = el("successPanel");
  const successDetails = el("successDetails");

  if (successPanel && successDetails) {
    successDetails.innerHTML = `
      <strong>Reference:</strong> ${escapeHtml(payload.inspectionId)}<br>
      <strong>Vehicle:</strong> ${escapeHtml(payload.vehicle)}<br>
      <strong>Driver:</strong> ${escapeHtml(payload.driver)}
    `;

    show("successPanel");
  } else {
    console.warn(
      "Success panel HTML is missing. Expected #successPanel and #successDetails."
    );

    showSubmissionMessage(
      `Vehicle check submitted successfully. Reference: ${payload.inspectionId}`,
      "success"
    );
  }
}

function renderLastSubmission(){
  const box = el("lastSubmission");
  if (!box) return;

  let last = null;
  try {
    last = JSON.parse(localStorage.getItem(LAST_SUBMISSION_KEY) || "null");
  } catch {
    last = null;
  }

  if(!last){
    hide("lastSubmission");
    return;
  }

  box.textContent = `Last submitted: ${last.vehicle} · ${formatDate(last.submittedAt)} · ${last.inspectionId}`;
  show("lastSubmission");
}

function resetToHome(){
  answers = {};
  currentReference = "";

  const valuesToClear = [
    "mileage",
    "departure",
    "returnTime",
    "defects",
    "damagePhotos",
    "seatingPhoto",
    "customDriver"
  ];

  valuesToClear.forEach(id => {
    const element = el(id);
    if (element) element.value = "";
  });

  if (el("driver")) el("driver").value = "";
  updateCustomDriverVisibility();

  if (el("informationDeclaration")) el("informationDeclaration").checked = false;
  if (el("licenceDeclaration")) el("licenceDeclaration").checked = false;
  if (el("damageFileSummary")) el("damageFileSummary").textContent = "";
  if (el("seatingFileSummary")) el("seatingFileSummary").textContent = "";

  hide("successPanel");
  show("reviewActions");
  hide("submissionMessage");

  renderQuestions();
  updateProgress();
  updateDefectPanel();
  updateSeatingPanel();
  updateVehicleDetails();
  renderLastSubmission();

  switchView("driver");
  goToStep("vehicleStep");
}

function showSubmissionMessage(text,type){
  const box = el("submissionMessage");

  if (box) {
    box.textContent = text;
    box.className = `message ${type}`;
  } else {
    console.warn(`Submission message: ${text}`);
    alert(text);
  }
}

function formatDate(value){
  try {
    return new Date(value).toLocaleString("en-GB", {
      dateStyle:"medium",
      timeStyle:"short"
    });
  } catch {
    return value;
  }
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  })[char]);
}
