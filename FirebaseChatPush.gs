/**
 * Optional real web-push sender for FSM Team Chat V2.
 *
 * Requires:
 *  - FIREBASE_CHAT_SERVICE_ACCOUNT_JSON stored only in Apps Script Properties.
 *  - Firebase Cloud Messaging API enabled for project opexa-fsm-chat.
 *  - Apps Script doPost(e) dispatch AFTER requireSession_(body.token):
 *      if (action === 'chatPush') return json_(firebaseChatPush_(user, body));
 *
 * Trust boundaries:
 *  - A sender must be authenticated through the existing FSM session.
 *  - Message existence, ownership, freshness, and recipient membership are
 *    re-checked on the server using Firestore's authenticated REST API.
 *  - The client cannot pick recipient device tokens.
 *  - Replayed requests are rate-limited per message.
 */
function firebaseChatAccessToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('FSM_FIREBASE_CHAT_OAUTH_V1');
  if (cached) return cached;
  var raw = PropertiesService.getScriptProperties().getProperty('FIREBASE_CHAT_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('Firebase chat signing account is not configured.');
  var account = JSON.parse(raw);
  if (account.project_id !== 'opexa-fsm-chat') throw new Error('Incorrect Firebase service account project.');
  var now = Math.floor(Date.now() / 1000);
  var encode = function(obj) {
    return Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
  };
  var assertion = encode({alg:'RS256',typ:'JWT'}) + '.' + encode({
    iss:account.client_email,
    scope:'https://www.googleapis.com/auth/cloud-platform',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,exp:now+3500
  });
  assertion += '.' + Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(assertion,account.private_key)
  ).replace(/=+$/, '');
  var resp=UrlFetchApp.fetch('https://oauth2.googleapis.com/token',{
    method:'post',payload:{
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:assertion
    },muteHttpExceptions:true
  });
  if(resp.getResponseCode()!==200)throw new Error('Firebase token exchange failed: HTTP '+resp.getResponseCode());
  var data=JSON.parse(resp.getContentText());
  if(!data.access_token)throw new Error('Firebase OAuth response lacks access token.');
  cache.put('FSM_FIREBASE_CHAT_OAUTH_V1',data.access_token,Math.min(3300,Number(data.expires_in||3600)-120));
  return data.access_token;
}

function firebaseChatRest_(url,token,payload) {
  var options={
    method:payload?'post':'get',
    muteHttpExceptions:true,
    headers:{Authorization:'Bearer '+token},
    contentType:'application/json'
  };
  if(payload)options.payload=JSON.stringify(payload);
  var response=UrlFetchApp.fetch(url,options);
  var code=response.getResponseCode();
  if(code<200||code>=300)throw new Error('Firebase REST request failed (HTTP '+code+').');
  return response.getContentText()?JSON.parse(response.getContentText()):{};
}

function firebaseChatListDocs_(path,token,maxPages) {
  var prefix='https://firestore.googleapis.com/v1/projects/opexa-fsm-chat/databases/(default)/documents/';
  var next='',result=[];
  for(var page=0;page<(maxPages||4);page++){
    var url=prefix+path+'?pageSize=100'+(next?'&pageToken='+encodeURIComponent(next):'');
    var data=firebaseChatRest_(url,token);
    result=result.concat(data.documents||[]);
    if(!data.nextPageToken)break;
    next=data.nextPageToken;
  }
  return result;
}

function firebaseChatFsmUid_(fsmUser) {
  var username=String(fsmUser&&fsmUser.username||'').trim().toLowerCase();
  if(!/^[a-z0-9._-]{1,64}$/.test(username))throw new Error('Invalid FSM username.');
  return 'fsm_'+Utilities.base64EncodeWebSafe(username).replace(/=+$/,'');
}

function firebaseChatField_(doc,name) {
  var field=doc&&doc.fields&&doc.fields[name];
  if(!field)return null;
  if(field.stringValue!==undefined)return field.stringValue;
  if(field.booleanValue!==undefined)return field.booleanValue;
  if(field.timestampValue!==undefined)return field.timestampValue;
  return null;
}

function firebaseChatPush_(fsmUser,body) {
  var senderId=firebaseChatFsmUid_(fsmUser);
  var room=String(body&&body.roomId||'');
  var msgId=String(body&&body.messageId||'');
  if(!/^(engineering|dm~fsm_[A-Za-z0-9_-]+~fsm_[A-Za-z0-9_-]+)$/.test(room)
     || !/^[A-Za-z0-9]{10,32}$/.test(msgId))throw new Error('Invalid chat message reference.');
  if(room!=='engineering' && room.split('~').indexOf(senderId)===-1){
    throw new Error('Sender is not part of this conversation.');
  }
  var bearer=firebaseChatAccessToken_();
  var root='https://firestore.googleapis.com/v1/projects/opexa-fsm-chat/databases/(default)/documents/';
  var msg=firebaseChatRest_(root+'chatRooms/'+encodeURIComponent(room)+'/messages/'+encodeURIComponent(msgId),bearer);
  if(firebaseChatField_(msg,'senderId')!==senderId
     || firebaseChatField_(msg,'deleted')===true)throw new Error('Message not owned by the sender.');
  var created=new Date(firebaseChatField_(msg,'createdAt')||'').getTime();
  if(!created||Math.abs(Date.now()-created)>15*60*1000)throw new Error('Message is not recent.');
  var throttle=CacheService.getScriptCache();
  var dedupe='FSM_PUSH_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,room+'|'+msgId)).replace(/=+$/,'');
  if(throttle.get(dedupe))return {ok:true,pushAttempted:0,alreadyProcessed:true};
  throttle.put(dedupe,'1',300);

  var members=firebaseChatListDocs_('chatMembers',bearer,4);
  var memberIds={};
  members.forEach(function(entry) {
    var id=entry.name.split('/').pop();
    if(firebaseChatField_(entry,'active')===true)memberIds[id]=true;
  });
  if(!memberIds[senderId])throw new Error('Chat sender is not an active FSM member.');
  var recipients=room==='engineering'
    ?Object.keys(memberIds).filter(function(uid){return uid!==senderId;})
    :room.split('~').slice(1).filter(function(uid){return uid!==senderId&&memberIds[uid];});
  var senderName=String(fsmUser.name||fsmUser.displayName||fsmUser.username||'FSM teammate').slice(0,70);
  var attempted=0;
  recipients.forEach(function(uid){
    var devices=[];
    try{devices=firebaseChatListDocs_('chatDevices/'+uid+'/tokens',bearer,2);}
    catch(error){console.warn('Chat push device lookup failed for '+uid+': '+error.message);return;}
    devices.forEach(function(entry){
      var token=firebaseChatField_(entry,'token');
      if(!token)return;
      var payload={message:{
        token:token,
        data:{
          kind:'fsm_chat',
          title:'New message from '+senderName,
          body:'Open FSM to read your message',
          roomId:room
        },
        webpush:{headers:{TTL:'3600'}}
      }};
      attempted++;
      try{
        firebaseChatRest_('https://fcm.googleapis.com/v1/projects/opexa-fsm-chat/messages:send',bearer,payload);
      }catch(error){
        console.warn('Chat push delivery failed: '+error.message);
      }
    });
  });
  return {ok:true,pushAttempted:attempted};
}
