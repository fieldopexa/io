# FSM Live Chat v1.0 Setup

Development branch: `feature/fsm-live-chat-v1`. Do not merge until testing.

## Why a separate Firebase account?
FSM's existing Google Apps Script username/password and session token stay intact. Firestore client access must use Firebase Authentication so security rules validate each chat participant. Chat stays logged in across app restarts through Firebase local persistence. Once signed in to chat, there is no need to log in to chat each time. Logging out of FSM does not log out of Firebase chat on that browser; chat is only visible after FSM sign-in.

## One-time admin setup

1. Visit https://console.firebase.google.com, create an FSM project, and add a **Web app**.
2. In **Authentication > Sign-in method**, enable **Email/Password**. Do not permit public self-registration in the FSM UI.
3. In **Firestore Database**, create a database in a suitable region. **Do not use open/test rules in production**. Paste `firestore.rules` from this branch into Firestore > Rules and publish.
4. In Authentication > Users, manually create each authorized team member (Ian, Popoy, Erwin, and other approved users). Record each Firebase **User UID**. Use different, strong initial passwords and have users change them; never commit passwords or private keys.
5. In Firestore > Data, create a collection `chatMembers`. For each UID create a document **whose document ID exactly matches the Firebase Authentication UID**. Add fields:
   - `active`: Boolean `true`
   - `name`: String (display name)
   - `email`: String (work email)
   Set `active=false` for accounts that should lose access. Members cannot create or modify these documents from the browser.
6. In Firebase Console > Project settings > General > Your apps > SDK setup and configuration, copy the **firebaseConfig web fields** into `chat-config.js`:
   ```js
   window.FSM_CHAT_FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "...firebaseapp.com",
     projectId: "...",
     appId: "...",
   };
   ```
   Firebase web configuration is normally public. Never put service-account JSON, admin keys, private keys, or FSM credentials in the repository.
7. In Firebase Authentication > Settings > Authorized domains, add `fieldopexa.github.io` if necessary. If app hosted on a custom domain later, add it there.
8. Merge the branch after verifying: two different user accounts can message in Engineering Team; direct messages are accessible only to their participants; unauthorized Firebase accounts cannot read the directory or messages; closing/reopening the app keeps the Firebase chat session; disabling a member prevents new reads/writes; performance and mobile layout remain acceptable.

## Technical details
- Runs directly on GitHub Pages. The separate ES module lazily loads the Firebase JavaScript SDK on first opening chat, avoiding dashboard startup cost.
- `chatRooms/engineering/messages/{autoId}` stores group messages. `chatRooms/dm_UID1_UID2/messages/{autoId}` stores direct messages, with participant UIDs sorted lexicographically.
- `chatActivity/{roomId}` stores only latest sender UID and timestamp for an approximate unread badge. It does **not** store message content. Only approved staff can read room activity metadata, including activity of other direct rooms. Change the model to per-user activity if that metadata visibility is unacceptable.
- Unread badges are only approximate and track whether a room has new messages, not the exact count. Read markers are stored locally on each device, so they do not sync between phones and PCs.
- Message history is limited to the 100 most recent messages per open conversation for speed. Older messages remain stored, but historical pagination is not yet implemented.
- Chat currently supports text only. Attachments, edits/deletes, presence, typing indicators, push notifications when app is closed, and cross-device read receipts are future upgrades.
- Firestore's free quota can be sufficient for a small team but usage and pricing should be monitored in Firebase Console.
- The chat uses separate Firebase sign-in, not automatic single sign-on from FSM. For truly seamless single sign-on in the future, implement a **server-side** Firebase custom-token exchange only after validating the FSM session token on the server. Never expose Firebase Admin credentials in GitHub Pages.

## Security notes
Firestore rules require an active, approved Firebase user and verify room membership on every message access. Messages cannot be edited or deleted from the client. Firestore rules should be tested in the Firebase Rules Playground / Emulator before merging. The message sender display name is user-provided metadata and not independently authenticated. Chat content is stored in Firebase and should follow your company's data retention and acceptable-use policy.
