# Production rollout: FSM + FSE View

## 1. GitHub Pages frontend
The main FSM is published from `fieldopexa/io` (`main`) at <https://fieldopexa.github.io/io/>.
The public, read-only FSE viewer is a separate repository, `fieldopexa/fseview`, at <https://fieldopexa.github.io/fseview/>.

The FSE viewer gets **New Visit** and **Messages** entry points that display a sign-in explanation and open the normal main FSM login with a specific destination. Do not collect passwords or session tokens in the public viewer. After successful authentication, the main FSM opens the requested tab, or goes there immediately if the user has an active main FSM session.

## 2. Apps Script backend is a separate deployment
GitHub does **not** deploy `api.gs`, `FirebaseChatSSO.gs`, `FirebaseChatPush.gs`, or `FirebaseChatHistoryReset.gs` into Google Apps Script. The Apps Script project remains responsible for the authenticated user and server-side write permissions.

To finish the *Shared Field Logs* release, copy the updated code from the development/main branch `api.gs` into the existing Google Apps Script project (or sync with your own controlled deployment process), keeping any other Apps Script files/functions intact. Deploy a **new version of the existing web app deployment**, preserving the same URL. This enables all FSEs to read shared Field Logs and enforces *primary FSE only* for changes. The front-end also enforces that rule, but it is not a substitute for the backend check.

If the deployed backend still runs the old `api.gs`, the live site may continue restricting FSEs to their own reports or may not have the expected authorization behavior.

## 3. Clear old chat history (not automatic on GitHub deploy)
**Permanent, destructive action:** clears ALL Firestore chat messages across FSE Team, direct messages, and Saved Messages. This does *not* remove Field Logs, FSM accounts, Firebase identities, or other Firebase settings. The app will keep recording new messages after the reset.

The GitHub deployment alone CANNOT delete Firebase Firestore data, and no admin secrets are present in the repository.

Use the owner-authorized Apps Script helper:
1. Open the Google Apps Script project powering FSM and ensure the existing `FirebaseChatPush.gs` OAuth helper `firebaseChatAccessToken_()` is present and configured with the same Firebase service account already used by chat SSO.
2. Create a new **Script file** named `FirebaseChatHistoryReset.gs`. Paste the file's content from the repository.
3. Under **Project Settings → Script Properties**, temporarily create:
   `FSM_CHAT_HISTORY_RESET_CONFIRM` = `DELETE ALL FSE CHAT HISTORY`.
4. In the Apps Script **Editor**, select `resetFsmChatHistoryOnce` and click **Run**. Approve the Google account permissions if prompted. Inspect **Executions / Logs**.
5. If the function returns `complete:false`, repeat **Run** until it returns `complete:true`. The function deletes messages in capped batches to avoid exhausting Apps Script execution time.
6. When complete, the function removes the confirmation property automatically. Refresh FSM Messages in each signed-in device. Optionally remove the helper script file after completion.

The helper queries the `messages` *collection group*, so it includes messages under private room paths even if no parent room document exists. It clears `chatActivity` metadata after all messages have been removed.

**Do not** paste service-account keys, chat device tokens, or account passwords into GitHub or ChatGPT.

## 4. Quick acceptance test
- In public FSE View, Dashboard and Field Logs work without login. Tap **Messages** or **New Visit**: a prompt offers to sign into the main FSM. Cancel leaves the viewer unchanged.
- Tap **Continue to FSM sign in**. Authenticate with Erwin/Popoy/Kenneth's normal account. The corresponding Messages or New Visit tab opens after login.
- In main FSM, **All FSEs** displays all engineers' visits, **My Work** limits the list, and the technician selector filters. Another engineer's visit is readable but cannot be edited or voided.
- New field visits still trigger FSE Team notifications and **Discuss in FSE Team** prepares a reviewable draft without auto-sending.
- After the optional Firestore reset, FSE Team/private/Saved Message history is empty, and a new message persists normally.
