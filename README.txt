CAMBRIA FLEET SAFETY — VERSION 4.2 LIVE DASHBOARD

WHAT CHANGED
- Manager Dashboard now reads live from Google Sheets through Apps Script.
- Figures are consistent on every phone, tablet and computer.
- Recent checks come from the Inspections sheet.
- Open defects come from the Defects sheet.
- Fleet overview shows the latest check and open-defect state for each active vehicle.
- Cached dashboard data is used only as an offline fallback.
- Bold text, colours, borders and other Google Sheet formatting do not affect the app.

IMPORTANT: BOTH BACKEND AND FRONTEND MUST BE DEPLOYED

BACKEND
1. Open the vehicle-check Google Sheet.
2. Extensions > Apps Script.
3. Back up the existing Code.gs.
4. Replace Code.gs with AppsScript_Code_CopyPaste.txt from this package.
5. Preserve/paste the correct SPREADSHEET_ID at the top.
6. Save.
7. Deploy > Manage deployments > Edit > New version > Deploy.
8. Test: <EXEC_URL>?action=dashboard
9. Confirm the response contains "ok":true and dashboard metrics.

FRONTEND
1. Replace the GitLab/Cloudflare frontend files with this package.
2. Commit to the production branch.
3. Wait for Cloudflare Pages deployment success.
4. Clear the old PWA cache once or remove and reinstall the PWA.
5. Open Manager Dashboard and press Refresh.

EXPECTED SHEET HEADERS
The code accepts common header aliases. Current production headings such as
Inspection ID, Date, Time, Vehicle, Driver, Start Mileage, Result, Defects,
Defect ID, Description, Date Raised and Status are supported.
