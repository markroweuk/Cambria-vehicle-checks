const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxW7n5Y87G99ukV_NDZNSPGwg5MriTpfFbHw3LBjW9q9wo3J6gk7o-RACcjMYaR42pOPw/exec";
const HISTORY_KEY = "cambriaVehicleChecksV21";
const LAST_SUBMISSION_KEY = "cambriaVehicleLastSubmission";

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
  {ref:"Q010", text:"Will the vehicle be used for towing?", special:"towing"}
];

let vehicles = [];
let drivers = [];
let answers = {};
let currentReference = "";

const el = id => document.getElementById(id);
const show = id => el(id).classList.remove("hidden");
const hide = id => el(id).classList.add("hidden");

document.addEventListener("DOMContentLoaded", init);

async function init(){
  try{
    [vehicles, drivers] = await Promise.all([
      fetch("data/vehicles.json").then(r => r.json()),
      fetch("data/drivers.json").then(r => r.json())
    ]);
  }catch(error){
    console.error(error);
    alert("Unable to load vehicle or driver data.");
    return;
  }

  el("vehicle").innerHTML = vehicles
    .filter(v => v.active)
    .map(v => `<option value="${v.registration}">${v.registration}</option>`)
    .join("");

  el("driver").innerHTML = drivers
    .filter(d => d.active)
    .map(d => `<option value="${d.name}">${d.name}</option>`)
    .join("");

  bindEvents();
  updateVehicleDetails();
  renderQuestions();
  updateProgress();
  renderDashboard();
  renderLastSubmission();
}

function bindEvents(){
  el("vehicle").addEventListener("change", updateVehicleDetails);
  el("vehicleNextBtn").addEventListener("click", () => goToStep("detailsStep"));
  el("detailsBackBtn").addEventListener("click", () => goToStep("vehicleStep"));
  el("inspectionStartBtn").addEventListener("click", beginInspection);
  el("inspectionBackBtn").addEventListener("click", () => goToStep("detailsStep"));
  el("reviewBtn").addEventListener("click", prepareReview);
  el("reviewBackBtn").addEventListener("click", () => goToStep("inspectionStep"));
  el("submitBtn").addEventListener("click", submitCheck);
  el("damagePhotos").addEventListener("change", updatePhotoSummaries);
  el("seatingPhoto").addEventListener("change", updatePhotoSummaries);
  el("driverTab").addEventListener("click", () => switchView("driver"));
  el("managerTab").addEventListener("click", () => switchView("manager"));
  el("refreshDashboardBtn").addEventListener("click", renderDashboard);
  el("homeBtn").addEventListener("click", resetToHome);
}

function switchView(view){
  const driver = view === "driver";
  el("driverTab").classList.toggle("active", driver);
  el("managerTab").classList.toggle("active", !driver);
  el("driverView").classList.toggle("hidden", !driver);
  el("managerView").classList.toggle("hidden", driver);
  if(!driver) renderDashboard();
}

function goToStep(stepId){
  ["vehicleStep","detailsStep","inspectionStep","reviewStep"].forEach(hide);
  show(stepId);
  window.scrollTo({top:0, behavior:"smooth"});
}

function updateVehicleDetails(){
  const v = selectedVehicle();
  if(!v) return;
  const seats = v.seats ? `${v.seats} seats` : "Not applicable";
  el("vehicleDetails").innerHTML = `
    <strong>${escapeHtml(v.registration)}</strong><br>
    ${escapeHtml(v.type)}<br>
    Category: ${escapeHtml(v.category)} · Seating: ${escapeHtml(String(seats))}
    ${v.tailLift === "Yes" ? "<br>Tail lift fitted" : ""}
    ${v.notes ? `<br>${escapeHtml(v.notes)}` : ""}
  `;
}

function selectedVehicle(){
  return vehicles.find(v => v.registration === el("vehicle").value);
}

function beginInspection(){
  if(!el("mileage").value){
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
  el("questions").innerHTML = QUESTION_DEFS.map(q => `
    <div class="question-row">
      <div class="question-title">${q.ref} · ${escapeHtml(q.text)}</div>
      <div class="answer-buttons">
        <button type="button" class="answer-btn yes" data-ref="${q.ref}" data-answer="YES">YES</button>
        <button type="button" class="answer-btn no" data-ref="${q.ref}" data-answer="NO">NO</button>
      </div>
    </div>
  `).join("");

  el("questions").querySelectorAll(".answer-btn").forEach(button => {
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
  el("progressText").textContent = `${complete} of ${QUESTION_DEFS.length} checks completed`;

  const pill = el("defectCount");
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
  return QUESTION_DEFS.filter(q => q.special !== "towing" && answers[q.ref] === "NO");
}

function updateDefectPanel(){
  el("defectPanel").classList.toggle("hidden", failedSafetyChecks().length === 0);
}

function updateSeatingPanel(){
  const minibus = selectedVehicle()?.category === "Minibus";
  el("seatingPanel").classList.toggle("hidden", !minibus);
}

function updatePhotoSummaries(){
  const damageFiles = [...el("damagePhotos").files];
  const seatingFiles = [...el("seatingPhoto").files];

  el("damageFileSummary").textContent = damageFiles.length
    ? `${damageFiles.length} damage photo${damageFiles.length === 1 ? "" : "s"} selected`
    : "No damage photos selected";

  el("seatingFileSummary").textContent = seatingFiles.length
    ? seatingFiles[0].name
    : "No seating photo selected";
}

function prepareReview(){
  if(Object.keys(answers).length !== QUESTION_DEFS.length){
    alert("Please answer every inspection question.");
    return;
  }

  const failed = failedSafetyChecks();
  if(failed.length && !el("defects").value.trim()){
    alert("Please describe the defects before reviewing the submission.");
    return;
  }

  if(selectedVehicle()?.category === "Minibus" && el("seatingPhoto").files.length === 0){
    alert("Please add the minibus seating photograph.");
    return;
  }

  const result = failed.length ? "DEFECT" : "OK";
  const towing = answers.Q010 === "YES" ? "Yes" : "No";
  const damageCount = el("damagePhotos").files.length;
  const seatingCount = el("seatingPhoto").files.length;

  const answersHtml = QUESTION_DEFS.map(q => {
    const value = answers[q.ref];
    const fail = q.special !== "towing" && value === "NO";
    return `
      <div class="review-answer">
        <span>${q.ref} · ${escapeHtml(q.text)}</span>
        <span class="${fail ? "answer-fail" : "answer-pass"}">${value}</span>
      </div>`;
  }).join("");

  el("reviewSummary").innerHTML = `
    <div class="review-block">
      <div class="review-grid">
        <div class="review-item"><span>Vehicle</span><strong>${escapeHtml(el("vehicle").value)}</strong></div>
        <div class="review-item"><span>Driver</span><strong>${escapeHtml(el("driver").value)}</strong></div>
        <div class="review-item"><span>Start mileage</span><strong>${escapeHtml(el("mileage").value)}</strong></div>
        <div class="review-item"><span>Result</span><strong class="${result === "OK" ? "answer-pass" : "answer-fail"}">${result}</strong></div>
        <div class="review-item"><span>Estimated use</span><strong>${escapeHtml(el("departure").value || "Not entered")} – ${escapeHtml(el("returnTime").value || "Not entered")}</strong></div>
        <div class="review-item"><span>Towing</span><strong>${towing}</strong></div>
        <div class="review-item"><span>Damage photos</span><strong>${damageCount}</strong></div>
        <div class="review-item"><span>Seating photos</span><strong>${seatingCount}</strong></div>
      </div>
    </div>
    ${failed.length ? `<div class="review-block"><h3>Defect details</h3><p>${escapeHtml(el("defects").value)}</p></div>` : ""}
    <div class="review-block"><h3>Inspection answers</h3>${answersHtml}</div>
  `;

  el("informationDeclaration").checked = false;
  el("licenceDeclaration").checked = false;
  el("submissionMessage").className = "message hidden";
  goToStep("reviewStep");
}

async function submitCheck(){
  if(!el("informationDeclaration").checked || !el("licenceDeclaration").checked){
    showSubmissionMessage("Please confirm both declarations before submitting.", "error");
    return;
  }

  el("submitBtn").disabled = true;
  el("submitBtn").textContent = "Submitting…";

  currentReference = createReference();
  const failed = failedSafetyChecks();
  const result = failed.length ? "DEFECT" : "OK";

  try{
    const photos = await collectPhotos();
    const payload = {
      action: "submitInspection",
      inspectionId: currentReference,
      date: new Date().toISOString().slice(0,10),
      time: new Date().toTimeString().slice(0,8),
      vehicle: el("vehicle").value,
      driver: el("driver").value,
      startMileage: el("mileage").value,
      finishMileage: "",
      departureTime: el("departure").value,
      returnTime: el("returnTime").value,
      result,
      towingRequired: answers.Q010 === "YES" ? "Yes" : "No",
      driverDeclaration: "Confirmed",
      informationDeclaration: "Confirmed",
      licenceDeclaration: "Confirmed",
      defects: el("defects").value.trim(),
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

    saveLocalHistory(payload);
    localStorage.setItem(LAST_SUBMISSION_KEY, JSON.stringify({
      inspectionId: currentReference,
      vehicle: payload.vehicle,
      driver: payload.driver,
      submittedAt: new Date().toISOString()
    }));
    showSubmissionSuccess(payload);
    renderDashboard();
    renderLastSubmission();

  }catch(error){
    console.error(error);
    showSubmissionMessage("The check could not be submitted. Your information remains on screen so you can try again.", "error");
  }finally{
    el("submitBtn").disabled = false;
    el("submitBtn").textContent = "Submit vehicle check";
  }
}

async function collectPhotos(){
  const files = [
    ...[...el("damagePhotos").files].map((file,index) => ({file, type:"damage", index:index+1})),
    ...[...el("seatingPhoto").files].map((file,index) => ({file, type:"seating", index:index+1}))
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
  try{return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");}
  catch{return []}
}

function renderDashboard(){
  const records = getLocalHistory();
  const defects = records.filter(r => r.result === "DEFECT");
  const vehicleCount = new Set(records.map(r => r.vehicle)).size;

  el("metricChecks").textContent = records.length;
  el("metricDefects").textContent = defects.length;
  el("metricVehicles").textContent = vehicleCount;

  el("recentChecks").innerHTML = records.length
    ? records.slice(0,10).map(r => `
      <div class="list-item">
        <strong>${escapeHtml(r.vehicle)}</strong>
        <span class="tag ${r.result === "OK" ? "ok" : "defect"}">${r.result}</span>
        <div>${escapeHtml(r.driver)} · ${escapeHtml(r.inspectionId)}</div>
        <div class="list-meta">${formatDate(r.submittedAt)} · Mileage ${escapeHtml(String(r.startMileage || ""))}</div>
      </div>`).join("")
    : `<div class="empty">No completed checks are stored on this device yet.</div>`;

  el("openDefects").innerHTML = defects.length
    ? defects.map(r => `
      <div class="list-item">
        <strong>${escapeHtml(r.vehicle)}</strong>
        <span class="tag defect">OPEN</span>
        <div>${escapeHtml(r.defects || "Defect reported")}</div>
        <div class="list-meta">${escapeHtml(r.inspectionId)} · ${formatDate(r.submittedAt)}</div>
      </div>`).join("")
    : `<div class="empty">No open defects are stored on this device.</div>`;

  el("fleetOverview").innerHTML = vehicles.filter(v => v.active).map(v => {
    const latest = records.find(r => r.vehicle === v.registration);
    const status = latest?.result || "NO CHECK";
    return `
      <div class="list-item">
        <strong>${escapeHtml(v.registration)}</strong>
        <span class="tag ${status === "OK" ? "ok" : status === "DEFECT" ? "defect" : ""}">${status}</span>
        <div>${escapeHtml(v.type)}</div>
        <div class="list-meta">${latest ? `Last check ${formatDate(latest.submittedAt)} by ${escapeHtml(latest.driver)}` : "No check stored on this device"}</div>
      </div>`;
  }).join("");
}


function showSubmissionSuccess(payload){
  hide("submissionMessage");
  hide("reviewActions");
  show("successPanel");
  el("successDetails").innerHTML = `
    <strong>Reference:</strong> ${escapeHtml(payload.inspectionId)}<br>
    <strong>Vehicle:</strong> ${escapeHtml(payload.vehicle)}<br>
    <strong>Driver:</strong> ${escapeHtml(payload.driver)}
  `;
}

function renderLastSubmission(){
  const box = el("lastSubmission");
  let last = null;
  try{ last = JSON.parse(localStorage.getItem(LAST_SUBMISSION_KEY) || "null"); }
  catch{ last = null; }

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

  el("mileage").value = "";
  el("departure").value = "";
  el("returnTime").value = "";
  el("defects").value = "";
  el("damagePhotos").value = "";
  el("seatingPhoto").value = "";
  el("informationDeclaration").checked = false;
  el("licenceDeclaration").checked = false;
  el("damageFileSummary").textContent = "";
  el("seatingFileSummary").textContent = "";

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
  box.textContent = text;
  box.className = `message ${type}`;
}

function formatDate(value){
  try{return new Date(value).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"});}
  catch{return value}
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);
}