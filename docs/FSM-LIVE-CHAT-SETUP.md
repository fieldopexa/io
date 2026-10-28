# FSM Team Chat: One-Login Firebase SSO

Development only: `feature/fsm-live-chat-v1`. **Not deployed to the live FSM or the live Google Apps Script backend.** Do not merge until verified.

## Outcome

- One FSM login grants access to the Team Chat page. No second login form or password.
- Firebase is a separate real-time message database, but its identity is obtained through an **FSM-session-validated custom token**. Users' real FSM passwords remain entirely in the existing backend.
- User identity is derived **on the server**, never from untrusted browser input. Each Firebase UID is `fsm_` followed by base64url of the normalized FSM username. This produces collision-free regex-safe identifiers, even for usernames with dots, dashes or underscores.
- On the first visit to Team Chat, the Firebase user and their `chatMembers/{uid}` profile are created automatically. The Firestore Rules permit this only for that user's server-signed FSM claims.
- Users in the Firebase Authentication > Users list created manually with Email/Password do **not** automatically convert to the new SSO identity. Those old users are unnecessary after SSO, and old `chatMembers` documents can be cleaned up once migration is tested.

## Required one-time administrator setup

### 1. Publish updated Firestore rules

1. Open `https://console.firebase.google.com/project/opexa-fsm-chat/firestore/databases/-default-/rules`.
2. Replace existing rules with this branch's `firestore.rules`, then click **Publish**.
3. **Do not use** `allow read, write: if true`. The new rules require a Firebase custom claim `fsm: true` signed by the FSM backend; they allow each verified user to create only their own immutable membership profile.

### 2. Create and securely store a Firebase service account signing key

1. In Firebase Console, open **Project Settings → Service accounts → Firebase Admin SDK → Generate new private key** for `opexa-fsm-chat`.
2. Treat the downloaded JSON file as a **highly sensitive server credential**. **Never share it in chat, upload it to GitHub, put it in a webpage/HTML/JS, or send screenshots showing its private key**.
3. Open the **actual deployed FSM Google Apps Script project** (the backend that serves the `API_URL` used by `index.html`). In **Project Settings → Script properties**, add:
   - Property: `FIREBASE_CHAT_SERVICE_ACCOUNT_JSON`
   - Value: **The complete contents of the downloaded JSON file**.
4. Save the property. It is accessed only server-side via `PropertiesService.getScriptProperties()` and used for RSA-SHA256 signing by Apps Script. Ideally restrict editor access to the script and follow your organization's key rotation policies.

### 3. Update and deploy the Apps Script backend

1. In the actual FSM Apps Script editor, update `api.gs` from this **development branch** (merge the small SSO route/function if the script has newer unpublished work; do not overwrite other live backend changes blindly).
2. The new **`chatSSO`** POST action must be placed **after** `requireSession_(body.token)`: only existing authenticated FSM sessions can request Firebase tokens.
3. Deploy a **new version** of the Apps Script web app using the current execution identity and allowed access settings. You may need to update the `API_URL` in `index.html` if using a new deployment rather than updating the existing one.
4. The server returns only `customToken`, never the service-account key or raw FSM password. The token is valid for at most an hour, and Firebase signs the user in using that token. Firebase refresh tokens persist until revoked or sign-out, so **when an employee loses FSM access, also disable their matching `chatMembers` document** and revoke their Firebase refresh tokens when appropriate.

### 4. Local test

1. Download branch ZIP and run `START-FSM-LOCAL.bat` from the extracted folder (requires Python).
2. Open `http://127.0.0.1:8765/`, sign in to FSM using the normal username/password.
3. Select **Team Chat** in the Operations sidebar or mobile menu.
4. It should show **Connecting to Team Chat → Engineering Team** without a second login. A Firebase user with UID `fsm_...` and a self-profile in Firestore should appear after first use.
5. Have Kenneth sign in to FSM with **his own FSM account** in another browser/device. Verify the two names, the team room, and one-on-one messages. If Kenneth does not have an FSM account, create one in FSM's User Management, not in Firebase Authentication.
6. Test logout and account revocation. A deliberate **FSM Log out** also signs out of chat; closing and reopening a remembered FSM session keeps one-login behavior.

## Known limitations

- Chat is a development build and the Google Apps Script endpoint is **not** deployed automatically by a GitHub change.
- No push notifications when the app is closed, read receipts across devices, or attachments in v1.
- The separate `chatActivity` collection stores room activity metadata. Approved users can read activity timestamps of private conversations they are not in, but **not** their messages. Harden the metadata model if this is inappropriate for your organization.
- If FSM access is removed, a previously issued Firebase refresh token can remain valid until its Firebase account is revoked or its membership document is disabled. Run both account-offboarding actions together.
- This test build still reaches the real FSM backend and real Firebase project. **Do not edit real field logs, users, or inventory during experiments.**

## How the security model works

```text
Existing FSM username + password
   → Google Apps Script login
   → FSM session token
   → POST chatSSO (server validates session)
   → Firebase service-account-signed custom token for fsm_<encoded username>
   → Firebase signInWithCustomToken
   → Firestore rules verify fsm:true + active member
   → Realtime Engineering Team / direct messages
```

The browser never receives the service account key. Avoid building a client-side shortcut that merely tells Firebase which username to assume. That would permit impersonation.
