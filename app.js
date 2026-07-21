let vehicles=[];
let drivers=[];

async function init(){
 vehicles=await fetch('data/vehicles.json').then(r=>r.json());
 drivers=await fetch('data/drivers.json').then(r=>r.json());
}

function loadVehicles(){
 result.innerHTML=vehicles.map(v=>`
 <div class="item">
 <b>${v.registration}</b><br>
 ${v.type}<br>
 Status: <span class="ok">OK</span><br>
 Last check: Available from Google Sheet
 </div>`).join('');
}

function loadDefects(){
 result.innerHTML=`
 <h3>Defect Tracker</h3>
 <div class="item">
 No open defects loaded.
 <br>
 Future connection: Google Sheet defect records
 </div>`;
}

function loadDrivers(){
 result.innerHTML=drivers.map(d=>`
 <div class="item">
 <b>${d}</b><br>
 Completed checks: Live data connection pending
 </div>`).join('');
}

init();