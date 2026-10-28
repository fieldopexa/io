# FSM • Shared Field Logs Access

Development branch: `feature/fsm-live-chat-v1`. **Production is NOT updated merely by merging/downloading the HTML.** The Google Apps Script backend has to be edited and redeployed separately.

## What changes
- **All FSEs** (default) loads every Field Visit from every technician. Ian, Erwin, Popoy, and Kenneth can view each other's site history, incidents, actions taken, and approved visit attachments.
- **My Work** filters locally to visits in which the signed-in FSE is Primary or Supporting Engineer.
- **All technicians** lets any FSE or Management filter by a specific technician (Primary or Supporting), regardless of All/My Work.
- **Search, status/category/date filters** continue to work.
- **View-only for other engineers**: Edit, Void, Duplicate and Add Attachment are not available for visits not owned by the currently signed-in **Primary FSE**.
- **Management is view-only** for all Field Logs. New Visit, Edit, Void, and direct delete operations are denied.
- **Discuss in Chat** (incident) and **automatic new-visit announcements in FSE Team** remain available. The **Notify FSE Team** action is still available for an authenticated FSE.
- Existing Field Log rows and Firestore chat history remain unchanged.

## Backend security and access
This change modifies the Apps Script `api.gs` source in the development branch. The `entries` GET route no longer filters results by current technician. Authenticated FSEs and Management both receive the complete visit history.

Write actions (`addEntry`, `updateEntry`, `archiveEntry`, direct/seamless attachment upload) verify that the user is an authenticated FSE. Updates/voids and attachment writes require a **Primary FSE match against the original saved row**, not the technician name from the submitted form. Supporting FSEs can view but not alter their colleague's record. Edit preserves the original Primary FSE identity. Permanent visit and attachment deletions are disabled to maintain Management's view-only access and preserve records.

### Mandatory rollout sequence

1. **Back up your current `Api.gs` in Google Apps Script first.** Review the changed version at [api.gs](https://github.com/fieldopexa/io/blob/feature/fsm-live-chat-v1/api.gs). Because the deployed Apps Script may have live changes that aren't in GitHub, **merge the modified permissions and handlers into the existing live `Api.gs`** rather than blindly replacing the whole file.
2. Confirm these are present in the live Apps Script: `requireFseFieldLogWrite_`, `requirePrimaryFseFieldLogOwner_`, changed `requireVisitAttachmentAccess_(user, visitId, forWrite)`, team-wide `doGet('entries')`, and owner validation in `addEntry`, `updateEntry` and `archiveEntry`. Keep the current Firebase chat SSO and notification code.
3. Save and select **Deploy → Manage deployments → Edit current FSM web app → New version → Deploy**. Preserve its URL/permissions. Changing HTML alone will NOT reveal the team history because the old backend will still filter visits.
4. Download the updated development ZIP from `feature/fsm-live-chat-v1`, extract to a **new folder**, and run `START-FSM-LOCAL.bat`. Load `http://127.0.0.1:8765/` and sign in normally.
5. Test with **Popoy and Erwin accounts**: Popoy should see Erwin's visit in **All FSEs**, no Edit/Void buttons for Erwin's record, and Popoy's own visits in **My Work**. Verify that the opposite account cannot modify the record via API, not just via hidden buttons. Check Management can review but not save/void or upload.
6. Test attachments: Popoy should be able to view an Erwin attachment (if previously permitted to FSM users), but only Erwin can add one to Erwin's own visit.
7. Verify FSE Team new-visit notifications and Discuss in Chat, plus the Field Log URL, still function as before.

## Notes
- Technician filters match names case-insensitively, including supporting-engineer assignments; **only the Primary FSE can edit**.
- Existing records with a Primary FSE name inconsistent with the user's assigned FSE name may appear **view-only even to their author**. Fix the FSE assignment or reconcile the historical record with an authorized administrator rather than weakening owner checks.
- Management user administration, other assets/inventory permissions, and Firebase Firestore messaging rules are unaffected by this Field Logs change.
- The release remains a **draft PR**, not a production deployment. The changed Apps Script backend must be merged into the actual Script editor and deployed.
