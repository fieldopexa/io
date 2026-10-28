# FSM Communications V3 — local test

**Development only.** Source: `feature/fsm-live-chat-v1`. Live GitHub Pages is unchanged.

1. Download the **latest ZIP** of this branch and extract it into a new folder.
2. Double-click `START-FSM-LOCAL.bat` (Python required). Keep the command window open.
3. Open `http://127.0.0.1:8765/` and log in with your **normal FSM account**.
4. Open **Operations → Team Chat**. The page heading now reads only **Communications**, with a neutral dashboard-matched graphite theme.
5. The Inbox has **Saved Messages** (a persistent private chat with yourself), **Team Chat** for Engineering, and direct messages for Popoy, Erwin, Kenneth. You are not listed twice in other private conversations.
6. Use conversation search on desktop; mobile has a sideways-scrolling conversation bar. Presence is approximate: **Active now**, **Last active**, or **Not active yet**, based on recent Firestore heartbeats.
7. Send yourself a reminder or a link in **Saved Messages** and refresh to confirm it's retained. Then send a test group or private message. Open **⋯** to **Copy**, **Edit**, or **Unsend** your own message.
8. **Publish the updated `firestore.rules` from this branch** before testing Edit / Unsend. V1 rules allowed messages to be created but not edited or unsent.
9. To test notifications, stay signed into FSM (you can keep Dashboard open), grant **Enable alerts**, then ask Kenneth to send a new message. Unread indicators, in-app toast, tab-title count, and browser alerts should work while FSM remains open. The notification permission must be supported and approved by the browser.

**Important:** The downloaded HTML uses your **real FSM Google Sheets and Firebase project**. Avoid modifying real visits, cabinets or inventory during chat testing.

**Optional push when the app is closed** needs an additional Firebase VAPID public key, `FirebaseChatPush.gs` added to the actual Apps Script backend, a server-side `chatPush` dispatcher handler, and a new backend deployment. These are prepared in the branch but **not yet enabled**. See [V2 setup and security instructions](docs/FSM-CHAT-V2.md). A public VAPID key is not the Firebase Admin JSON private key. Never commit or paste admin keys in the browser.

**File attachment limitation:** This version supports link-sharing (🔗), not uploading binary files. An actual upload/storage feature requires additional configuration.

**Security:** Only message senders can edit or unsend; unsend produces a tombstone and clears text in Firestore. Read status is local per browser/account; unread badge counts conversations, not individual messages.
