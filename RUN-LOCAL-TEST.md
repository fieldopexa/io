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
