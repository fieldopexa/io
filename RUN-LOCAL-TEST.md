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

**No automatic posts.** Engineers may edit or cancel the draft before sending. No Apps Script handler, new Firebase collection, or Firestore rule change is needed for this feature.

**Test note:** Until the branch is merged into GitHub Pages, an externally opened production URL will run the older live FSM and may not process the new `fieldlog` query parameter. Test the link by clicking it inside this development build, where the URL is intercepted.
