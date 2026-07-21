CAMBRIA FLEET SAFETY — VERSION 4.1 PRODUCTION

This release keeps the live Google Sheets architecture from v3.4 and restores
the Cambria Sea Scouts visual identity from Camp Companion.

BRANDING CHANGES
- Uses the same Cambria Sea Scouts logo artwork as Camp Companion.
- Uses the same navy/blue header and purple Scout accent.
- Header app name is "Fleet Safety", matching the "Camp Companion" treatment.
- New Fleet Safety hero card: "Vehicle Check Companion".
- Cards, typography, spacing and buttons now follow the same Cambria design family.

DATA ARCHITECTURE
- Vehicles load from the "Vehicle Register" Google Sheet.
- Drivers load from the "Drivers" Google Sheet.
- Inspections write to "Inspections".
- Answers write to "Inspection Answers".
- Defects write to "Defects".
- Reports are sent by Google Apps Script.

DEPLOYMENT
1. Complete the Apps Script v3.4 backend deployment first.
2. Confirm <EXEC_URL>?action=bootstrap returns vehicles and drivers.
3. Replace the files in the GitLab/Cloudflare frontend repository with this package.
4. Commit and wait for Cloudflare Pages to deploy.
5. Clear the old PWA/site cache once, or remove and reinstall the PWA.
6. Confirm the Cambria header, Fleet Safety title, vehicles and drivers all appear.
7. Submit one normal check and one defect check.

The existing Apps Script URL remains configured in app.js. Only change
GOOGLE_SCRIPT_URL if Google issued a different /exec address.


VERSION 4.1 IMPROVEMENTS
- Vehicle illustration appears when a fleet registration is selected.
- Driver list includes “Other — enter name” for guest and loan drivers.
- Q010 asks whether there is any other damage not already listed. YES opens defect details.
- The towing question is now Q011.
