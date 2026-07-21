CAMBRIA VEHICLE CHECK — v3.4 SHEETS-DRIVEN

WHAT CHANGED
- Vehicles now load from the "Vehicle Register" Google Sheet.
- Drivers now load from the "Drivers" Google Sheet.
- data/vehicles.json and data/drivers.json have been removed.
- The last successfully loaded fleet list is cached locally for temporary offline use.
- Inspections, answers, defects and email reports continue through Apps Script.

IMPORTANT: BOTH SIDES MUST BE DEPLOYED
The new frontend calls:
  GET <Apps Script URL>?action=bootstrap

Your Apps Script must therefore be updated with:
  apps-script/Code.gs

BACKEND DEPLOYMENT
1. Open the Apps Script project connected to the spreadsheet.
2. Back up the current Code.gs.
3. Replace Code.gs with apps-script/Code.gs from this package.
4. Set SPREADSHEET_ID near the top of the file.
5. Save.
6. Deploy > Manage deployments > Edit.
7. Select "New version".
8. Execute as: Me.
9. Access: Anyone.
10. Deploy.
11. Keep the /exec URL.

FRONTEND URL
app.js currently uses:
https://script.google.com/macros/s/AKfycbyBZ4CVwLbZ6j7tNmvP_Y92V8TPUSmJwyqX-wmRsiUsrH4Oahe63xHww5ug9b7PsTk7/exec

If the deployment URL changes, update GOOGLE_SCRIPT_URL at the top of app.js.

EXPECTED VEHICLE REGISTER HEADERS
The backend recognises common alternatives. Recommended:
- Registration
- Type
- Category
- Seats
- Tail Lift
- Notes
- Active

EXPECTED DRIVERS HEADERS
Recommended:
- Name
- Active

"Active" may contain Yes/No, TRUE/FALSE, Active/Inactive, or may be left blank.
Blank is treated as active.

FRONTEND DEPLOYMENT
1. Replace the frontend repository files with this package.
2. Commit and push.
3. Wait for Cloudflare Pages.
4. Clear the old PWA/site cache once because the service worker version changed.
5. Reload and verify the vehicle and driver dropdowns.

TEST THE BACKEND FIRST
Open this in a browser:
<YOUR_EXEC_URL>?action=bootstrap

You should receive JSON containing:
- "ok": true
- "vehicles": [...]
- "drivers": [...]

If it returns an error, check SPREADSHEET_ID, sheet names and header rows.
