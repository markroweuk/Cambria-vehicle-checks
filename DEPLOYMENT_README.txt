Cambria Vehicle Check v2.1.1 Polished Corrective Release

This release restores and improves:
- Compact Cambria-styled UI
- Working selected-state YES/NO buttons
- Full review screen before submission
- Two driver declarations
- Responsibility statement
- Damage photo uploads
- Mandatory minibus seating photograph
- Local manager dashboard showing saved checks and open defects
- Google Sheet structure compatibility
- Google Drive photo storage and email reporting Apps Script

Google Apps Script update:
1. Open the Cambria Vehicle Checks Google Sheet.
2. Extensions > Apps Script.
3. Replace the script with google/apps_script_v2_1.gs.
4. Save.
5. Deploy > Manage deployments.
6. Edit the current web app deployment and deploy a new version.
7. Execute as: Me.
8. Access: Anyone.

GitLab/Cloudflare:
Upload all web files and folders except the spreadsheet and deployment notes if desired.
Cloudflare will redeploy after commit.


v2.1.1 amendments:
- Version number shown in the header and footer.
- Successful submissions now display a dedicated confirmation panel.
- Added Back to Home button after successful submission.
- Returning home clears the completed check and prepares the form for the next driver.
- The home screen shows the most recent successful submission reference.
