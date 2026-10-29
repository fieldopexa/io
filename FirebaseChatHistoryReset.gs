/**
 * One-time Firestore chat-history reset.
 *
 * Execute MANUALLY as the Apps Script owner. Not a web endpoint and not
 * callable by FSEs/Management from the browser.
 *
 * Requires the existing FirebaseChatPush.gs/firebaseChatAccessToken_ helper
 * and the Firebase service-account JSON in Script Properties. The key is
 * never placed in GitHub or browser source code.
 *
 * Scope: removes every chatRooms/*/messages/* message (including group, DMs
 * and Saved Messages) and chatActivity metadata. Leaves chatMembers, presence,
 * and device login/FCM token registrations untouched.
 *
 * To authorize, temporarily add this Script Property:
 *   FSM_CHAT_HISTORY_RESET_CONFIRM = DELETE ALL FSE CHAT HISTORY
 * Select resetFsmChatHistoryOnce from the Apps Script function selector and
 * Run as script owner. Repeat if the log says more messages remain. Remove
 * the confirmation property once complete.
 */
function resetFsmChatHistoryOnce() {
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('FSM_CHAT_HISTORY_RESET_CONFIRM')!=='DELETE ALL FSE CHAT HISTORY'){
    throw new Error('Set FSM_CHAT_HISTORY_RESET_CONFIRM to the exact phrase in the script header.');
  }
  var token=firebaseChatAccessToken_();
  var base='https://firestore.googleapis.com/v1/projects/opexa-fsm-chat/databases/(default)/documents';
  var headers={Authorization:'Bearer '+token};
  var post=function(url,payload){
    var response=UrlFetchApp.fetch(url,{
      method:'post',contentType:'application/json',headers:headers,
      muteHttpExceptions:true,payload:JSON.stringify(payload)
    });
    if(response.getResponseCode()<200||response.getResponseCode()>=300){
      throw new Error('Firestore reset failed (HTTP '+response.getResponseCode()+'): '+response.getContentText().slice(0,300));
    }
    return JSON.parse(response.getContentText()||'{}');
  };
  var clearBatch=function(names){
    if(!names.length)return;
    var data=post(base+':batchWrite',{writes:names.map(function(name){return {delete:name};})});
    var errors=(data.status||[]).filter(function(status){return status&&status.code&&status.code!==0;});
    if(errors.length)throw new Error('Firestore rejected '+errors.length+' message deletions; check service-account permissions.');
  };
  var removed=0;
  var hasMore=false;
  // Query ALL 'messages' subcollections even if their parent room documents
  // do not exist. Do not rely on listing only chatRooms parent documents.
  for(var i=0;i<8;i++){
    var data=post(base+':runQuery',{structuredQuery:{
      from:[{collectionId:'messages',allDescendants:true}],
      select:{fields:[{fieldPath:'__name__'}]},
      limit:200
    }});
    if(!Array.isArray(data))throw new Error('Unexpected Firestore query response.');
    var names=data.filter(function(hit){return hit.document&&hit.document.name;})
      .map(function(hit){return hit.document.name;});
    if(!names.length){hasMore=false;break;}
    clearBatch(names);
    removed+=names.length;
    hasMore=names.length>=200;
    if(!hasMore)break;
  }
  if(hasMore){
    console.log('Deleted '+removed+' messages. More remain: Run resetFsmChatHistoryOnce again.');
    return {messagesDeleted:removed,complete:false};
  }
  // Clear per-conversation last activity only AFTER messages are gone.
  // Otherwise old previews/badges could linger in listeners.
  var clearedActivity=0;
  for(var j=0;j<10;j++){
    var response=UrlFetchApp.fetch(base+'/chatActivity?pageSize=200',{
      headers:headers,muteHttpExceptions:true
    });
    if(response.getResponseCode()===404)break;
    if(response.getResponseCode()!==200)throw new Error('Cannot read chatActivity: HTTP '+response.getResponseCode());
    var records=(JSON.parse(response.getContentText()||'{}').documents||[])
      .map(function(doc){return doc.name;});
    if(!records.length)break;
    clearBatch(records);
    clearedActivity+=records.length;
    if(records.length<200)break;
  }
  props.deleteProperty('FSM_CHAT_HISTORY_RESET_CONFIRM');
  console.log('Chat history reset complete. Deleted '+removed+' messages and '+clearedActivity+' activity records.');
  return {messagesDeleted:removed,activityDeleted:clearedActivity,complete:true};
}