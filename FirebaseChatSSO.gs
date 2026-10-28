/**
 * FSM Live Chat: Firebase custom authentication.
 *
 * To install on the EXISTING Google Apps Script backend:
 * 1. Add a new script file named FirebaseChatSSO.gs and paste this code.
 * 2. In the existing doPost(e), immediately AFTER
 *      var user = requireSession_(body.token);
 *    add:
 *      if (action === 'chatSSO') {
 *        return json_({ok:true, customToken:firebaseChatCustomToken_(user)});
 *      }
 * 3. Deploy a new version of the EXISTING Apps Script web app.
 *
 * Requires script property FIREBASE_CHAT_SERVICE_ACCOUNT_JSON
 * containing the PRIVATE service-account JSON. Never commit or paste that JSON
 * into source code, client-side HTML, GitHub, or a public shared file.
 */
function firebaseChatCustomToken_(fsmUser) {
  var username = String(fsmUser && fsmUser.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,64}$/.test(username)) {
    throw new Error('Your FSM username is not eligible for Team Chat.');
  }
  var name = String(fsmUser.name || fsmUser.displayName || username).trim().slice(0,120);
  var role = String(fsmUser.role || 'fse').trim().slice(0,32);
  var keyText = PropertiesService.getScriptProperties().getProperty('FIREBASE_CHAT_SERVICE_ACCOUNT_JSON');
  if (!keyText) throw new Error('Team Chat SSO server key is not configured.');

  var account;
  try { account = JSON.parse(keyText); }
  catch (e) { throw new Error('Team Chat service-account JSON is invalid.'); }
  if (account.project_id !== 'opexa-fsm-chat' || !account.client_email || !account.private_key) {
    throw new Error('Team Chat service account belongs to another project or has missing fields.');
  }

  var now = Math.floor(Date.now() / 1000);
  var payload = {
    iss: account.client_email,
    sub: account.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: 'fsm_' + Utilities.base64EncodeWebSafe(Utilities.newBlob(username).getBytes()).replace(/=+$/, ''),
    claims: {
      fsm: true,
      fsm_username: username,
      fsm_name: name,
      fsm_role: role
    }
  };
  var toBase64Url = function(o) {
    return Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(o)).getBytes()).replace(/=+$/, '');
  };
  var signingInput = toBase64Url({alg:'RS256',typ:'JWT'}) + '.' + toBase64Url(payload);
  var signature = Utilities.computeRsaSha256Signature(signingInput, account.private_key);
  return signingInput + '.' + Utilities.base64EncodeWebSafe(signature).replace(/=+$/, '');
}
