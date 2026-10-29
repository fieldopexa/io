# FSM Communications V4 — local test

**Development only.** Source: `feature/fsm-live-chat-v1`. Live GitHub Pages is unchanged.

1. Download the **latest ZIP** of this branch and extract it into a new folder.
2. Double-click `START-FSM-LOCAL.bat` (Python required). Keep the command window open.
3. Open `http://127.0.0.1:8765/` and log in with your **normal FSM account**.
4. Open **Operations → Messages**. On desktop, the Communications page has a two-column inbox and active conversation. On mobile, it opens to a **full-screen vertical inbox**; no horizontal swipe is needed.
5. The Inbox has **Saved Messages** (a persistent private chat with yourself), **FSE Team** for Engineering, and direct messages for Popoy, Erwin, Kenneth. You are not listed twice in other private conversations.
6. On a phone, **tap Kenneth, Erwin, Popoy, FSE Team, or Saved Messages** to open the conversation. Use the **Back arrow** in the conversation header to return to your inbox. Search and **All chats / Unread** filters work on mobile and desktop. Presence is approximate: **Active now**, **Last active**, or **Not active yet**, based on recent Firestore heartbeats.
7. Send yourself a reminder or a link in **Saved Messages** and refresh to confirm it's retained. Then send a test group or private message. Open **⋯** to **Copy**, **Edit**, or **Unsend** your own message.
8. **Publish the updated `firestore.rules` from this branch** before testing Edit / Unsend. V1 rules allowed messages to be created but not edited or unsent.
9. To test notifications, stay signed into FSM (you can keep Dashboard open), grant **Enable alerts**, then ask Kenneth to send a new message. Unread indicators, in-app toast, tab-title count, and browser alerts should work while FSM remains open. The notification permission must be supported and approved by the browser.

**Important:** The downloaded HTML uses your **real FSM Google Sheets and Firebase project**. Avoid modifying real visits, cabinets or inventory during chat testing.

**Optional push when the app is closed** needs an additional Firebase VAPID public key, `FirebaseChatPush.gs` added to the actual Apps Script backend, a server-side `chatPush` dispatcher handler, and a new backend deployment. These are prepared in the branch but **not yet enabled**. See [V2 setup and security instructions](docs/FSM-CHAT-V2.md). A public VAPID key is not the Firebase Admin JSON private key. Never commit or paste admin keys in the browser.

**File attachment limitation:** This version supports link-sharing (🔗), not uploading binary files. An actual upload/storage feature requires additional configuration.

**Security:** Only message senders can edit or unsend; unsend produces a tombstone and clears text in Firestore. Read status is local per browser/account; unread badge counts conversations, not individual messages.

### UI smoke check
- Phone: verify **Messages** opens to a vertical inbox list rather than a horizontal carousel. Tap a person, type, send, press Back and verify the inbox still has the preview and correct unread indicator. Rotate the phone and repeat.
- Desktop: verify the inbox and conversation appear side by side, the composer is not obscured by the **Install app** button, and searching/Unsend still work.
- This UI update **does not change Firestore security rules or Google Apps Script**. The sender-only rules from V2/V3 are still required for Edit/Unsend. Notifications when the app is fully closed still require optional FCM setup.

### V4.1 interface refinements
- Removed the extra **OPEXA / MESSAGES** and **Inbox** headings inside the conversation sidebar on desktop and mobile. Search is the first element.
- Message search now uses the exact **Field Logs** search field pattern (`global-search`, search icon, border, background and mobile tap size).
- Renamed the Engineering group label from **Team Chat** to **FSE Team**, without changing its Firestore room ID (`engineering`) or existing message history.
- No Google Apps Script or Firebase rules change is required for these interface changes.

## Discuss in Chat: Field Logs → FSE Team
1. Open **Field Logs** and find a **Breakdown / Incident** record. Non-incident/routine records deliberately do not display the share action.
2. On an incident card, select **💬 Discuss in Chat**; alternatively select **View details** and use **Discuss in Chat** in the visit drawer.
3. FSM switches to **Messages → FSE Team**, opens the conversation on mobile, and **prepares** (does not send) a message with site, visit date, incident/ticket reference, issue, priority, status, reporting FSE and **View Field Log** link. Review it and press **Send** yourself.
4. Click the resulting **View Field Log** link inside the chat. In the development version, it opens the corresponding existing Field Log in the **same local FSM session** without leaving the localhost test build.
5. On the real GitHub Pages deployment, the canonical URL will be `https://fieldopexa.github.io/io/?fieldlog=<stable-visit-id>`. After this development branch is merged, opening this URL signs in/restores the FSM account if needed, loads permitted visits, then opens the matching detail drawer. The stable ID is used because display tracking numbers may repeat across dates.

**Important access rule:** FSM currently restricts Field Log lists by account/assigned FSE. Sharing a record in FSE Team does **not** grant teammates permission to open it. Unauthorized teammates still see the short summary posted in Chat but receive **Field Log unavailable** if the full record is outside their accessible records. This is intentional and should be reviewed before wider rollout.

**Manual Discuss in Chat:** Engineers may edit or cancel the incident draft before sending. That button still does **not** auto-send.

## Automatic FSE Team updates for newly saved Field Visits
- When an **authorized FSM account creates a new visit** and Google Apps Script confirms `addEntry`, the chat client automatically posts a compact **New Field Visit Logged** card to **FSE Team**.
- Includes site, visit type, reporting engineer, visit date, optional ticket/machine/incident priority, status and **View Field Log** (stable record ID).
- This applies to **routine visits as well as incidents**. It does not auto-post on edits, voided records, or failed/unconfirmed saves. Authorized management-submitted visits are also included.
- The group chat remains `engineering`; no second group or Firebase collection is needed. Existing Firebase authentication and Firestore create permissions are reused.
- The visitor is not forced into Messages. Other FSEs see the group update in their inbox and can receive in-app/browser alerts **while FSM is open**. Closed-app push still requires separate Firebase Cloud Messaging setup.
- A per-FSM-user browser queue holds pending announcements if chat has not finished connecting or Firebase temporarily fails. It retries on chat sign-in, online reconnection, returning to the tab, or progressively timed retries (30 seconds to 5 minutes), for up to **14 days**. Announcements use the stable ID `visit_<entry.id>` and a Firestore transaction to prevent duplicate posting.
- **Status feedback:** below the successful visit-save message, FSM now displays **Posting notification**, **Notification posted to FSE Team**, or **Notification pending. FSM will retry**. This status is separate from the result of saving the visit.
- **Important:** this is a browser-triggered notification after the server confirms the Field Visit, **not guaranteed server-side delivery**. If the FSE closes the app before the write reaches Firebase, the notification remains queued only on that browser. A fully server-generated event would require Google Apps Script/Firebase backend work.
- **Access restriction:** the summary is visible in FSE Team, but the link only opens a Field Log that the recipient's existing FSM account is authorized to read.
- **No additional Apps Script deployment or Firestore rules publish is required** for this feature, assuming FSE Team messaging already works.

### Suggested two-device test
1. On Ian's local FSM test build, sign in as Ian; on another browser/device, sign in as Kenneth and leave FSM open.
2. Create a **new routine visit** for an appropriate test site. Save and confirm the shared-sheet success message.
3. Beneath the saved-visit confirmation, check whether **Notification posted to FSE Team** appears. If it says **Pending**, the chat write has not succeeded yet. Open **Messages → FSE Team** on both devices. Confirm exactly **one** automatic visit card appears, showing the correct site, visit type and link.
4. Edit the same Field Log, save, and confirm **no second automatic card** is posted.
5. Test the manual **Discuss in Chat** action on an incident. It should still prepare an editable draft, not send automatically.
6. Test notification badges from Kenneth's Dashboard when Ian saves a separate new visit.
7. Note that the test uses **real FSM Google Sheets and Firebase**. Do not create fictitious production incidents. Use a legitimate test entry only where your team permits it, then void/clean up according to your site's testing procedure.


**Test note:** Until the branch is merged into GitHub Pages, an externally opened production URL will run the older live FSM and may not process the new `fieldlog` query parameter. Test the link by clicking it inside this development build, where the URL is intercepted.

### If no automatic card appears
Make sure every engineer uses the **latest development ZIP** (old local or live versions do not emit the confirmed-save event). If the Field Log saves but the FSE Team status remains Pending, keep FSM open while it retries; check that ordinary messages to FSE Team work. Note that new browser-side announcements will not retroactively process visits logged using older builds.

### Notification status and previously saved visits
After a newly confirmed save, the visit form shows **Posting notification**, **Notification posted to FSE Team**, or **Notification pending (will retry)**. If you saved a visit in an earlier test build, it is **not automatically backfilled**. To share that already-saved visit, open **Field Logs → the visit's ••• menu → Notify FSE Team**. This queues the existing record using its stable visit ID and will not create a duplicate group card if it was already posted. For detailed incident discussion, **Discuss in Chat** remains a separate manual, editable draft action.

A successful Field Log save is independent of the Firebase message. The retry queue lives in this browser (per authenticated FSM username) for up to 14 days, so do not assume guaranteed delivery after the browser is closed. A system-wide guarantee for visits created from any older client would require a server-side Apps Script hook and deployment. As with other group messages, the **sender will not get an incoming-message alert for their own visit**; teammates should see the group update and unread indicator while FSM is open. True closed-app push requires the separate FCM setup.

## Shared FSE Field Logs (new)
**Requires merging and redeploying the updated Apps Script `api.gs` first.** Older deployed APIs still filter FSE records to the current technician. See [complete setup and authorization guide](docs/FSE-SHARED-FIELD-LOGS.md).

1. Sign in as Popoy. Open Field Logs → **All FSEs**. You should see Erwin's, Kenneth's and Ian's visits (when they exist). Use **All technicians** to filter Erwin.
2. Switch to **My Work**. Only visits where Popoy participated should remain. Keep the category/date/search filters available.
3. Open an Erwin visit. Details and attachments should be readable, but **Edit**, **Duplicate**, **Void** and **Add attachment** should not be available. Discuss in FSE Team must still work for incidents.
4. Sign in as Erwin and verify that Erwin can edit and void **only Erwin's Primary FSE visits**. Supporting FSEs may view but not change someone else's log.
5. Sign in as Management. All Field Logs are visible, but New Visit, Edit, Void and permanent delete requests are blocked.
6. Check automatic new-visit notifications in FSE Team still appear once for newly saved visits, and old logs/history have not changed.

## Header Notification Bell (2026-10-29)

- Notifications live in the **top-right bell**, not Dashboard/Field Logs/Reports/Messages navigation.
- **Desktop:** bell is in the upper-right of the workspace. **Mobile:** bell is next to the hamburger menu.
- Tap/click to open **Notifications** without changing pages. Unread badge, **All activity / Unread**, **Mark all as read**, and visit links are retained. Click outside or press Escape to close.
- Saved New Visits create feed entries based on authenticated shared Field Logs; they **do not auto-post to FSE Team Chat**. Incident **Discuss in Chat** remains a manual option.
- An FSE view link to `?intent=notifications` still takes them through FSM sign-in before opening the bell after login.
- Existing notices are derived from Field Logs, not separately stored. Current browser remembers read status per FSE account in local storage. Other signed-in accounts check for new saved visits while the app is open (approximately every two minutes); no claim of FCM closed-browser delivery for visit notifications.
- **No backend, Firestore rule, or account migration** is required for this header placement change. No Firebase chat messages are deleted by this UI change.

### Quick smoke test
1. Sign in from the main FSM or via FSE View. Verify the bell appears at the top-right, and **Notifications** does not appear as a navigation item.
2. On mobile, verify the bell is next to the menu button. Open and close using touch and then tap a visit.
3. Have another FSE save a new visit. Confirm the new feed item and unread badge show after a refresh/poll; the FSE Team conversation should **not** get an automatic visit message.
4. Tap a notification and confirm it opens the correct visit in Field Logs, while **Discuss in Chat** remains available for a manual incident conversation.

## Notifications bell: read and archive statuses (October 29)

- Field Visit updates appear in the **upper-right bell** on desktop and beside the mobile menu in the app header. They do **not** create automatic FSE Team group-chat messages. The separate **Discuss in Chat** incident action remains unchanged.
- Open the bell for **All**, **Unread**, **Read**, and **Archived** views. Select a visit to mark it read and open its Field Log. Use each entry's **⋯** menu for **Mark as read/unread**, **Archive**, or **Restore to All**. **Mark all as read** affects active notifications but not archives.
- The same visit has one notification keyed to its stable Field Log ID. Editing or saving a follow-up to the same visit does not create extra notices; new visits are detected by refreshing the authenticated Field Logs data.
- Existing visits are treated as already read the first time an account enables this notification center, avoiding an avalanche of old notifications. Thereafter, new entries become unread and increase the bell count.
- Read/Archived state is currently stored **per signed-in user and per browser/device**. It does not yet synchronize between laptops and phones. Visits themselves remain in shared Google Sheets and are available to permitted team members.
- While FSM is open, notifications refresh approximately every 60 seconds while the browser is visible and on window focus; this is **not closed-app device push**. The device must be online with a valid FSM session. Clicking a notice opens its original Field Log in FSM.
- Test: sign in with two FSE accounts on separate browsers, create a Field Visit from one, check the other FSE's notification bell after the next refresh or by reopening it. Mark read, archive, restore, and confirm the badge changes. Confirm no new automatic FSE Team Chat entry appears.
