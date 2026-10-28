# Opexa FSM with Integrated Team Chat (Test Build)

This branch adds **Team Chat as a page inside FSM**, not a separate app. Open it under **Operations → Team Chat** in the desktop sidebar or the mobile menu.

## Run locally on Windows

1. Download this development branch using GitHub **Code → Download ZIP** and extract the folder.
2. Double-click `START-FSM-LOCAL.bat` (requires Python installed).
3. Open `http://127.0.0.1:8765/` in the browser if not opened automatically.
4. Sign in using your existing FSM username/password.
5. Select **Operations → Team Chat**. The conversation list shows **Team Chat (Engineering group)** plus direct messages for **Popoy, Erwin, and Kenneth** (excluding your own account). Those direct-message choices are available even if a teammate has not opened Firebase chat yet.
6. Team Chat should sign in **automatically using your existing FSM account**. There is no second email/password form. This only works **after** the FSM Apps Script backend and the updated Firestore rules are deployed as described in `docs/FSM-LIVE-CHAT-SETUP.md`.
7. Switch to **Engineering Team** or a direct message. Test using Kenneth's **FSM** login on another browser or device.

### Why it needs a local server

Don't double-click `index.html` using `file://`. Browser modules, Firebase Auth persistence, and other web features often require HTTP. The local launcher serves all of FSM's existing JavaScript/CSS assets and uses Firebase over the Internet.

### Scope and safety
- This **test build** uses the same Google Apps Script backend as production FSM. Any edits to visits, inventory, or users may affect live data. Avoid changing real FSM records during chat testing.
- Firebase chat sends actual messages to your `opexa-fsm-chat` project.
- Firebase membership profiles are created automatically for authenticated FSM users using server-signed custom claims. Users disabled in Firestore are blocked.
- All Firebase security rules must be published from this branch's `firestore.rules`.
- Group and direct messages work through Firestore in real time while the app is open. Offline history pagination, background push notifications, typing indicators, message attachments, and automatic FSM single sign-on aren't included in v1.
- Chat identity is derived from the existing FSM session. **Logging out explicitly from FSM also signs out of Firebase chat** on that device.
- No changes have been merged into the live GitHub Pages main branch. This test cannot authenticate chat until the Google Apps Script server-side SSO setup is completed. Do not upload a service-account key or any private credentials to this repository.

To report problems: include screenshot of the chat screen and browser Console error (F12) without sharing passwords or private credentials.
