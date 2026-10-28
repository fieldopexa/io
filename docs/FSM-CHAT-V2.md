# OPEXA FSM • Communications V2
Development branch: `feature/fsm-live-chat-v1`. The live GitHub Pages `main` branch is **unchanged**.

## In this build
- **One FSM login**. Existing session-validated `chatSSO` in Google Apps Script signs you into Firebase.
- Clean **Communications** page with a single active conversation heading; conversation search on desktop.
- **Team Chat** group plus direct conversations with Ian, Kenneth, Erwin, and Popoy (the signed-in user is excluded), and any additional active members who've opened chat.
- Live last-message previews and room unread indicators, with sidebar/mobile unread badges and browser-tab counts.
- Automatically starts the chat listeners after normal FSM login, including when you stay on Dashboard.
- In-app toast for new messages while FSM is open; opt-in browser notifications when the tab is hidden. Permission must be granted by clicking **Enable alerts**. Some mobile browsers do not allow normal browser notifications from a tab.
- Improved timestamps, Today/Yesterday separators, responsive layout, link detection, a **🔗 Insert link** action.
- **Copy**, **Edit** and **Unsend** on a message's `⋯` menu. Only the original sender may Edit or Unsend. Unsend is a soft delete: message text becomes blank for everyone, replaced by a neutral "Message unsent" placeholder.
- Approximate recently-active indicator from lightweight Firestore heartbeats (not guaranteed online status).

## Mandatory administrator action for V2 message editing
**Publish the UPDATED** `firestore.rules` from this branch again, even if you published rules earlier for V1. Those old rules explicitly denied updating existing messages. New rules:
- permit only the sender to edit/unsend; sender ID & creation time are immutable;
- restrict private room activity metadata to participants;
- add presence and optional FCM registration permissions.
After publishing, it may take a little time to propagate. Test Edit and Unsend from Ian and verify Kenneth sees the change.

### Local test
1. Download the latest development branch ZIP and extract it into a **new** folder. Older ZIPs can contain stale chat files.
2. Double-click `START-FSM-LOCAL.bat` (Python required) and open `http://127.0.0.1:8765/`.
3. Sign into FSM normally, then **Operations → Team Chat**. No second login.
4. Send a message to Team Chat, then a private message to Kenneth.
5. Hover/tap `⋯` on your message to Copy, Edit or Unsend.
6. Click **Enable alerts** and grant permission. Leave FSM open, switch tabs, then have Kenneth send a new message.
7. With the browser still open, unread badges, tab-title counts, and browser notifications should appear if supported and permitted.

**This is a live-data test:** the development HTML still uses real FSM Google Sheets and the real Firebase project. Do not modify production field records while experimenting.

## Optional: true background push after the app is closed
**Prepared but not active until the steps below are completed.** Browser/tab notifications in V2 work while FSM is open. True device push uses Firebase Cloud Messaging, a service worker and a trusted server. The app cannot safely send pushes to other devices with a Firebase service account key embedded in HTML.

1. In Firebase Console `opexa-fsm-chat`, go to **Project settings → Cloud Messaging → Web Push certificates**. Create or select a public **VAPID key**. Do not use the service-account JSON key. Copy the **public** VAPID key only.
2. In this development branch's `chat-config.js`, set `window.FSM_CHAT_WEB_PUSH_VAPID_KEY` to the public VAPID key.
3. In the *actual* FSM Google Apps Script editor, add the **new, separate Script file** `FirebaseChatPush.gs` using the source in the development branch. Keep `FirebaseChatSSO.gs`, existing `Api.gs`, `Code.gs` and other functions intact.
4. In the existing `doPost(e)` dispatcher, **immediately after** `var user=requireSession_(body.token);` add:
   ```javascript
   if (action === 'chatPush') {
     return json_(firebaseChatPush_(user, body));
   }
   ```
   (Do not create another `doPost` and do not accidentally duplicate the existing `chatSSO` handler.)
5. Save and **Deploy → Manage deployments → Edit existing FSM web app → New version → Deploy**. Keep execution settings and URL unchanged. Confirm the restored Firebase service account has the required Firestore and Cloud Messaging API permissions and the Cloud Messaging API is enabled.
6. Publish the V2 Firestore Rules, then use the test build on a secure origin. **HTTPS GitHub Pages** is preferred for mobile. Browsers may support localhost as a secure context on desktop. Install the FSM PWA on an eligible phone if required by its browser.
7. On each device, sign into FSM, click **Enable alerts**, and grant permission. The app registers a private per-device FCM token. Test with a second FSM account from another device. The trusted Apps Script server verifies sender/message before sending a data-only push.

**Limitations:** FCM delivery depends on browser, OS, notification permission, service worker support, network, device settings, and the trusted backend. Do not promise push delivery after the browser is force-closed on all platforms. iOS often requires an installed PWA and explicit notification permission. Push is not active merely because Firebase project was created. Registration tokens are private data; never post them in chat.

## Attachments
V2 supports safe **link sharing** using the chain-link button and automatic HTTPS link detection. It does **not** upload binary files; Firebase Storage setup and a file permission/access policy would be required for genuine in-chat file attachments. Existing FSM field-visit attachments are unaffected.

## Testing and safety
- Press `Ctrl+Shift+N` (Incognito) or use a fresh extracted folder if V1 keeps appearing.
- If Edit/Unsend fails, check the **new Firestore rules were actually published**.
- Unread badges currently count unread **conversations** (max one per room) rather than exact unread message totals.
- Read status is stored per FSM user, per browser. Read receipts and synchronized read states across devices are not in this build.
- A recently-active indicator shows a heartbeat seen in roughly the past 3 minutes, not guaranteed live availability.
- Soft-unsent messages remain as metadata/tombstones in Firestore. This is not cryptographic erasure from backups or recipients' prior views.
- Real browser notifications require explicit opt-in, a secure context, and an open FSM tab; true closed-app push requires the additional FCM setup above.
- On offboarding, disable the user's `chatMembers/{uid}` profile and revoke Firebase tokens in addition to disabling their FSM login.
- Do not upload service account JSON or any Firebase Admin private key to GitHub or into ChatGPT.
