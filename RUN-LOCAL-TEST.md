# Opexa FSM with Integrated Team Chat (Test Build)

This branch adds **Team Chat as a page inside FSM**, not a separate app. Open it under **Operations → Team Chat** in the desktop sidebar or the mobile menu.

## Run locally on Windows

1. Download this development branch using GitHub **Code → Download ZIP** and extract the folder.
2. Double-click `START-FSM-LOCAL.bat` (requires Python installed).
3. Open `http://127.0.0.1:8765/` in the browser if not opened automatically.
4. Sign in using your existing FSM username/password.
5. Select **Operations → Team Chat**.
6. On first use, sign in with your separate approved **Firebase Authentication** email/password. Firefox/Chrome will remember the Firebase session on this device.
7. Switch to **Engineering Team** or a direct message from the left side. Use a second approved Firebase account to test instant delivery from another browser or device.

### Why it needs a local server

Don't double-click `index.html` using `file://`. Browser modules, Firebase Auth persistence, and other web features often require HTTP. The local launcher serves all of FSM's existing JavaScript/CSS assets and uses Firebase over the Internet.

### Scope and safety
- This **test build** uses the same Google Apps Script backend as production FSM. Any edits to visits, inventory, or users may affect live data. Avoid changing real FSM records during chat testing.
- Firebase chat sends actual messages to your `opexa-fsm-chat` project.
- Only accounts added in both **Firebase Authentication** and Firestore **chatMembers/{UID}** with `active: true` may use chat.
- All Firebase security rules must be published from this branch's `firestore.rules`.
- Group and direct messages work through Firestore in real time while the app is open. Offline history pagination, background push notifications, typing indicators, message attachments, and automatic FSM single sign-on aren't included in v1.
- Chat sign-in persists across browser restarts. **Logging out explicitly from FSM also signs out of Firebase chat** on that device.
- No changes have been merged into the live GitHub Pages main branch.

To report problems: include screenshot of the chat screen and browser Console error (F12) without sharing passwords or private credentials.
