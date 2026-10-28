// API V42: shared service forms and reusable account signatures in private Drive files.
function doGet(e) {
  try {
    var type = (e.parameter.type || 'entries');
    var token = String(e.parameter.token || '');
    var publicViewer = String(e.parameter.viewer || '') === '1';
    var publicReadTypes = {
      entries:true, assetsBootstrap:true, siteRecords:true, sites:true, fses:true,
      inventory:true, visitCabinets:true, cabinets:true, movements:true,
      spareParts:true, cabinetParts:true, agenda:true
    };
    if (publicViewer && !publicReadTypes[type]) {
      return json_({status:'error', error:'This dataset is not available in view-only mode.'});
    }
    var user = publicViewer
      ? {username:'viewer', name:'Management View', role:'management', fse:''}
      : requireSession_(token);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (type === 'accountSignature') {
      return json_({signature:readAccountSignature_(user)});
    }

    if (type === 'entries') {
      ensureEntriesServiceFormColumns_();
      ensureEntriesAttachmentCountColumn_();
      var sheet = ss.getSheetByName('Entries');
      var data = sheet.getDataRange().getValues();

      if (!data.length) {
        return json_([]);
      }

      var headers = data[0];
      var rows = data.slice(1)
        .filter(function(row) { return row[0] !== ''; })
        .map(function(row) {
          var obj = {};
          headers.forEach(function(h, i) { obj[h] = row[i]; });
          return obj;
        });

      // Shared Field Logs: all authenticated FSEs and Management can review
      // the whole Engineering visit history. Write authorization is separate.

      rows.forEach(function(row) {
        row.hasServiceForm = !!row.serviceFormFileId;
        // The owner permits signed service forms in the public fseview reader.
        hydrateVisitServiceForm_(row);
        if (publicViewer) delete row.serviceFormFileId;
      });
      return json_(rows);
    }


    if (type === 'assetsBootstrap') {
      // One round-trip for the data shared by Sites and Inventory.
      // Management receives full cabinet records; FSE receives the safe cabinet view.
      var assetSites = sheetObjects_(getSitesLifecycleSheet_());

      var assetInvSheet = ss.getSheetByName('Inventory');
      var assetInventory = assetInvSheet ? sheetObjects_(assetInvSheet) : [];

      var assetCabSheet = getCabinetsSheet_();
      var assetCabData = assetCabSheet.getDataRange().getValues();
      var assetCabinets = [];

      if (assetCabData.length >= 2) {
        var assetCabHeaders = assetCabData[0];
        var assetRows = assetCabData.slice(1).filter(function(row) { return row[0] !== ''; });

        if (user.role === 'management') {
          assetCabinets = assetRows.map(function(row) {
            var obj = {};
            assetCabHeaders.forEach(function(h, i) { obj[h] = row[i]; });
            return obj;
          });
        } else {
          var safeAssetFields = [
            'id', 'cabinetId', 'permanentNumber', 'site', 'label', 'status',
            'token', 'teamviewerId',
            'mpuSerial', 'cabinetSerial',
            'bvModel', 'bvSerial',
            'printerModel', 'printerSerial',
            'networkNote'
          ];
          assetCabinets = assetRows.map(function(row) {
            var obj = {};
            safeAssetFields.forEach(function(field) {
              var idx = assetCabHeaders.indexOf(field);
              obj[field] = idx >= 0 ? row[idx] : '';
            });
            return obj;
          });
        }
      }

      return json_({
        sites: assetSites,
        inventory: assetInventory,
        cabinets: assetCabinets,
        fetchedAt: new Date().toISOString()
      });
    }

    if (type === 'siteRecords') {
      return json_(sheetObjects_(getSitesLifecycleSheet_()));
    }

    if (type === 'sites' || type === 'fses') {
      var sheetName = type === 'sites' ? 'Sites' : 'FSEs';
      var listSheet = ss.getSheetByName(sheetName);
      var listData = listSheet.getDataRange().getValues();
      var list = listData
        .map(function(r) { return r[0]; })
        .filter(function(v) { return v !== ''; });

      return json_(list);
    }

    if (type === 'inventory') {
      // Inventory overview is readable by any authenticated field user.
      // Write actions remain management-only in doPost.
      if (!publicViewer) requireSession_(token);
      var inv = ss.getSheetByName('Inventory');
      if (!inv) {
        return json_([]);
      }
      var invData = inv.getDataRange().getValues();
      if (invData.length < 2) {
        return json_([]);
      }
      var invHeaders = invData[0];
      var invRows = invData.slice(1)
        .filter(function(row) { return row[0] !== ''; })
        .map(function(row) {
          var obj = {};
          invHeaders.forEach(function(h, i) { obj[h] = row[i]; });
          return obj;
        });
      return json_(invRows);
    }

    if (type === 'visitCabinets') {
      // Safe cabinet identity data for authenticated FSE/management users.
      // FSEs may view Token + TeamViewer for field/remote support, but writes stay management-only.
      if (!publicViewer) requireSession_(token);
      var visitCab = getCabinetsSheet_();
      var visitCabData = visitCab.getDataRange().getValues();
      if (visitCabData.length < 2) {
        return json_([]);
      }
      var visitCabHeaders = visitCabData[0];
      var allowedVisitCabFields = [
        'id', 'cabinetId', 'permanentNumber', 'site', 'label', 'status',
        'token', 'teamviewerId',
        'mpuSerial', 'cabinetSerial',
        'bvModel', 'bvSerial',
        'printerModel', 'printerSerial',
        'networkNote'
      ];
      var visitCabRows = visitCabData.slice(1)
        .filter(function(row) { return row[0] !== ''; })
        .map(function(row) {
          var obj = {};
          allowedVisitCabFields.forEach(function(field) {
            var idx = visitCabHeaders.indexOf(field);
            obj[field] = idx >= 0 ? row[idx] : '';
          });
          return obj;
        });
      return json_(visitCabRows);
    }

    if (type === 'cabinets') {
      if (!publicViewer) requireSession_(token, 'management');
      var cab = getCabinetsSheet_();
      var cabData = cab.getDataRange().getValues();
      if (cabData.length < 2) {
        return json_([]);
      }
      var cabHeaders = cabData[0];
      var cabRows = cabData.slice(1)
        .filter(function(row) { return row[0] !== ''; })
        .map(function(row) {
          var obj = {};
          cabHeaders.forEach(function(h, i) { obj[h] = row[i]; });
          return obj;
        });
      return json_(cabRows);
    }

    if (type === 'movements') {
      // Movement history is view-only for FSEs; changes remain management-only.
      if (!publicViewer) requireSession_(token);
      var mov = getCabinetMovementsSheet_();
      var movData = mov.getDataRange().getValues();
      if (movData.length < 2) {
        return json_([]);
      }
      var movHeaders = movData[0];
      var movRows = movData.slice(1)
        .filter(function(row) { return row[0] !== ''; })
        .map(function(row) {
          var obj = {};
          movHeaders.forEach(function(h, i) { obj[h] = row[i]; });
          return obj;
        });
      return json_(movRows);
    }

    if (type === 'spareParts') {
      // FSEs may view available spare stock and use parts through the controlled
      // useSparePart workflow. Add/edit/delete remains management-only.
      if (!publicViewer) requireSession_(token);
      var sp = getSparePartsSheet_();
      return json_(sheetObjects_(sp));
    }

    if (type === 'cabinetParts') {
      // Read-only installed-parts history for authenticated users.
      if (!publicViewer) requireSession_(token);
      var cp = getCabinetPartsSheet_();
      return json_(sheetObjects_(cp));
    }

    if (type === 'agenda') {
      // Public viewer may read weekly agenda items. Writes remain protected in doPost().
      if (!publicViewer) requireSession_(token);
      var agendaSheet = ss.getSheetByName('Agenda');
      if (!agendaSheet) return json_([]);
      var agendaData = agendaSheet.getDataRange().getValues();
      if (agendaData.length < 2) return json_([]);
      var agendaHeaders = agendaData[0];
      var agendaRows = agendaData.slice(1)
        .filter(function(row){ return row[0] !== ''; })
        .map(function(row){
          var obj = {};
          agendaHeaders.forEach(function(h,i){ obj[h] = row[i]; });
          return obj;
        });
      return json_(agendaRows);
    }

    if (type === 'removedParts') {
      requireSession_(token, 'management');
      var rp = getRemovedPartsSheet_();
      return json_(sheetObjects_(rp));
    }

    if (type === 'auditTrail') {
      var auditUser = requireSession_(token);
      var auditRows = sheetObjects_(getAuditTrailSheet_());

      // Management sees the complete audit history.
      // FSE accounts only see audit events created by their own login.
      if (String(auditUser.role || '').toLowerCase() === 'fse') {
        var auditUsername = String(auditUser.username || '').trim().toLowerCase();
        auditRows = auditRows.filter(function(row){
          return String(row.actorUsername || '').trim().toLowerCase() === auditUsername;
        });
      }

      auditRows.sort(function(a,b){
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      });
      return json_(auditRows.slice(0, 1000));
    }

    return json_({status: 'error', error: 'Unknown type.'});

  } catch (err) {
    return json_({status: 'error', error: err.message});
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = body.action;

    // Actions that do not require an existing session.
    if (['planningList','planningSave','planningSnapshot'].includes(action)) return json_(planningApi_(body));

    if (action === 'login') {
      return json_(authLogin_(body));
    }

    if (action === 'changePassword') return json_(authChangePassword_(body));

    if (action === 'logout') {
      return json_(authLogout_(body));
    }

    // Management user administration.
    if (action === 'listUsers') return json_(authListUsers_(body));
    if (action === 'addUser') return json_(authCreateUser_(body));
    if (action === 'setUserStatus') return json_(authSetUserStatus_(body));
    if (action === 'resetPassword') return json_(authResetPassword_(body));

    // Everything below requires a valid login session.
    var user = requireSession_(body.token);
    if (action === 'saveAccountSignature') {
      return json_({status:'ok',signature:saveAccountSignature_(user, body.signature)});
    }

    if (action === 'me') {
      return json_({
        ok: true,
        user: user
      });
    }

    // Firebase Live Chat custom sign-in: issue tokens only after validating
    // the existing FSM session. Never accept a requested UID from the browser.
    if (action === 'chatSSO') {
      return json_({ok:true, customToken:firebaseChatCustomToken_(user)});
    }
    // Optional: trusted FCM push after an authenticated sender saves a message.
    if (action === 'chatPush') {
      return json_(firebaseChatPush_(user, body));
    }

    // Agenda writes are available only to authenticated Master users.
    // The separate public viewer can read Agenda through doGet(viewer=1),
    // but it has no session token and cannot reach these actions.
    if (action === 'saveAgendaItem') {
      var agendaRecord = body.record || {};
      var agendaWeek = String(agendaRecord.week || '').trim();
      var agendaText = String(agendaRecord.text || '').trim();

      if (!agendaWeek) throw new Error('Reporting week is required.');
      if (!agendaText) throw new Error('Agenda details are required.');

      var agendaSheet = getAgendaSheet_();
      var agendaId = String(agendaRecord.id || '').trim();
      if (!agendaId) {
        agendaId = 'AG-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      }

      var beforeAgenda = getRowObjectById_(agendaSheet, agendaId);
      var nowAgenda = new Date();
      var ownerAgenda = beforeAgenda
        ? String(beforeAgenda.owner || user.name || user.fse || user.username || 'User')
        : String(user.name || user.fse || user.username || 'User');
      var createdAgenda = beforeAgenda && beforeAgenda.createdAt
        ? beforeAgenda.createdAt
        : nowAgenda;

      var agendaRow = [
        agendaId,
        agendaWeek,
        agendaText,
        ownerAgenda,
        createdAgenda,
        nowAgenda
      ];

      upsertRowById_(agendaSheet, agendaId, agendaRow);

      var savedAgenda = getRowObjectById_(agendaSheet, agendaId);
      appendAudit_(
        user,
        beforeAgenda ? 'UPDATE' : 'CREATE',
        'Agenda',
        agendaId,
        agendaWeek,
        beforeAgenda,
        savedAgenda,
        beforeAgenda ? 'Agenda item updated' : 'Agenda item created'
      );

      return json_({
        status: 'ok',
        record: savedAgenda || {
          id: agendaId,
          week: agendaWeek,
          text: agendaText,
          owner: ownerAgenda,
          createdAt: createdAgenda,
          updatedAt: nowAgenda
        }
      });
    }

    if (action === 'deleteAgendaItem') {
      var agendaDeleteId = String(body.id || '').trim();
      if (!agendaDeleteId) throw new Error('Agenda item ID is required.');

      var agendaDeleteSheet = getAgendaSheet_();
      var beforeAgendaDelete = getRowObjectById_(agendaDeleteSheet, agendaDeleteId);
      if (!beforeAgendaDelete) throw new Error('Agenda item not found.');

      removeRowById(agendaDeleteSheet, agendaDeleteId);

      appendAudit_(
        user,
        'DELETE',
        'Agenda',
        agendaDeleteId,
        String(beforeAgendaDelete.week || ''),
        beforeAgendaDelete,
        null,
        'Agenda item deleted'
      );

      return json_({status: 'ok'});
    }



    if (action === 'beginSeamlessDriveUpload') {
      var visitIdForSession = String(body.visitId || '').trim();
      requireVisitAttachmentAccess_(user, visitIdForSession, true);

      var browserOrigin = String(body.origin || '').trim();
      var allowedUploadOrigin = 'https://fieldopexa.github.io';
      if (browserOrigin !== allowedUploadOrigin) {
        throw new Error('Attachment upload origin is not allowed.');
      }

      var uploadDetails = body.file || {};
      var uploadName = sanitizeAttachmentFileName_(uploadDetails.name);
      var uploadMime = String(uploadDetails.mimeType || '').toLowerCase().trim();
      var uploadSize = Number(uploadDetails.sizeBytes || 0);
      if (!uploadName || !{'image/jpeg':true,'image/png':true,'image/webp':true,'application/pdf':true}[uploadMime]) {
        throw new Error('Only named JPG, PNG, WEBP or PDF files are supported.');
      }
      if (!Number.isSafeInteger(uploadSize) || uploadSize < 1 || uploadSize > 6 * 1024 * 1024) {
        throw new Error('File must be between 1 byte and 6 MB.');
      }
      var folderId = String(PropertiesService.getScriptProperties().getProperty('FSM_VISIT_ATTACHMENTS_FOLDER_ID') || '').trim();
      if (!folderId) throw new Error('Missing FSM_VISIT_ATTACHMENTS_FOLDER_ID script property.');
      var metadata = {
        name: uploadName,
        mimeType: uploadMime,
        parents: [folderId],
        description: 'FSM Field Visit ' + visitIdForSession + ' attachment',
        appProperties: {fsm:'true',visitId:visitIdForSession}
      };
      var uploadStart = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink', {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
          Origin: browserOrigin,
          'X-Upload-Content-Type': uploadMime,
          'X-Upload-Content-Length': String(uploadSize)
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
        followRedirects: false
      });
      var startCode = uploadStart.getResponseCode();
      if (startCode !== 200 && startCode !== 201) {
        throw new Error('Google Drive session failed (' + startCode + '): ' + uploadStart.getContentText().slice(0, 300));
      }
      var uploadHeaders = uploadStart.getAllHeaders();
      var sessionUrl = uploadHeaders.Location || uploadHeaders.location;
      if (Array.isArray(sessionUrl)) sessionUrl = sessionUrl[0];
      if (!sessionUrl || !/^https:\/\/www\.googleapis\.com\//.test(sessionUrl)) {
        throw new Error('Drive did not provide a usable upload session URL.');
      }
      return json_({status:'ok',sessionUrl:sessionUrl});
    }

    if (action === 'registerDirectDriveVisitAttachment') {
      var directVisitId = String(body.visitId || '').trim();
      var directVisit = requireVisitAttachmentAccess_(user, directVisitId, true);
      var direct = body.attachment || {};
      var directFileId = String(direct.fileId || '').trim();
      var directName = sanitizeAttachmentFileName_(direct.fileName);
      var directMime = String(direct.mimeType || '').trim().toLowerCase();
      var directSize = Number(direct.sizeBytes || 0);
      var directWebViewLink = String(direct.webViewLink || '').trim();
      var directAllowed = {'image/jpeg':true,'image/png':true,'image/webp':true,'application/pdf':true};

      if (!/^[A-Za-z0-9_-]{10,200}$/.test(directFileId)) throw new Error('Google Drive file ID is invalid.');
      if (!directName) throw new Error('Attachment file name is required.');
      if (!directAllowed[directMime]) throw new Error('Only JPG, PNG, WEBP, and PDF attachments are allowed.');
      if (!directSize || directSize > 6 * 1024 * 1024) throw new Error('Attachment size is invalid.');
      var actualDriveFile = DriveApp.getFileById(directFileId);
      var expectedFolderId = String(PropertiesService.getScriptProperties().getProperty('FSM_VISIT_ATTACHMENTS_FOLDER_ID') || '').trim();
      var actualParents = actualDriveFile.getParents();
      var inExpectedFolder = false;
      while (actualParents.hasNext()) {
        if (actualParents.next().getId() === expectedFolderId) inExpectedFolder = true;
      }
      if (!inExpectedFolder) throw new Error('Uploaded file is not in the configured attachment folder.');
      if (actualDriveFile.getName() !== directName || actualDriveFile.getMimeType() !== directMime || actualDriveFile.getSize() !== directSize) {
        throw new Error('Uploaded file metadata does not match the attachment request.');
      }
      directWebViewLink = actualDriveFile.getUrl();

      var directAttachmentId = 'ATT-' + Utilities.getUuid().slice(0, 10).toUpperCase();
      var directAttachmentSheet = getVisitAttachmentsSheet_();
      var directUploadedBy = String(user.name || user.fse || user.username || 'User');
      var directUploadedAt = new Date();

      appendVisitAttachmentObject_(directAttachmentSheet, {
        id:directAttachmentId,
        visitId:directVisitId,
        fileId:directFileId,
        fileName:directName,
        mimeType:directMime,
        sizeBytes:directSize,
        uploadedBy:directUploadedBy,
        uploadedAt:directUploadedAt,
        provider:'drive-direct',
        webViewLink:directWebViewLink
      });

      var directCount = syncVisitAttachmentCount_(directVisitId);
      appendAudit_(
        user, 'CREATE', 'Visit Attachment', directAttachmentId,
        String(directVisit.site || '') + ' · ' + directName,
        null,
        {visitId:directVisitId,provider:'drive-direct',fileId:directFileId,fileName:directName,mimeType:directMime,sizeBytes:directSize},
        'Direct Google Drive visit attachment registered'
      );

      return json_({
        status:'ok',
        attachment:{
          id:directAttachmentId,
          visitId:directVisitId,
          provider:'drive-direct',
          fileId:directFileId,
          fileName:directName,
          mimeType:directMime,
          sizeBytes:directSize,
          uploadedBy:directUploadedBy,
          uploadedAt:directUploadedAt,
          webViewLink:directWebViewLink
        },
        attachmentCount:directCount
      });
    }

    if (action === 'listVisitAttachments') {
      var listVisitId = String(body.visitId || '').trim();
      requireVisitAttachmentAccess_(user, listVisitId);
      var attachmentRows = sheetObjects_(getVisitAttachmentsSheet_())
        .filter(function(r){ return String(r.visitId || '') === listVisitId; })
        .sort(function(a,b){ return new Date(a.uploadedAt || 0).getTime() - new Date(b.uploadedAt || 0).getTime(); })
        .map(function(r){
          var provider = String(r.provider || '').trim() || 'drive-backend';
          return {
            id:r.id,
            visitId:r.visitId,
            provider:provider,
            fileId:String(r.fileId || ''),
            fileName:r.fileName,
            mimeType:r.mimeType,
            sizeBytes:r.sizeBytes,
            uploadedBy:r.uploadedBy,
            uploadedAt:r.uploadedAt,
            webViewLink:String(r.webViewLink || '')
          };
        });
      return json_({status:'ok', attachments:attachmentRows});
    }

    if (action === 'uploadVisitAttachment') {
      var uploadVisitId = String(body.visitId || '').trim();
      var uploadVisit = requireVisitAttachmentAccess_(user, uploadVisitId, true);
      var uploadFile = body.file || {};
      var uploadName = sanitizeAttachmentFileName_(uploadFile.name);
      var uploadMime = String(uploadFile.mimeType || '').trim().toLowerCase();
      var allowedMimes = {'image/jpeg':true,'image/png':true,'image/webp':true,'application/pdf':true};
      if (!uploadName) throw new Error('Attachment file name is required.');
      if (!allowedMimes[uploadMime]) throw new Error('Only JPG, PNG, WEBP, and PDF attachments are allowed.');

      var encoded = String(uploadFile.base64 || '');
      if (!encoded) throw new Error('Attachment file data is missing.');
      var bytes = Utilities.base64Decode(encoded);
      var maxAttachmentBytes = 6 * 1024 * 1024;
      if (!bytes.length) throw new Error('Attachment file is empty.');
      if (bytes.length > maxAttachmentBytes) throw new Error('Attachment is larger than 6 MB.');

      var visitFolder = getVisitAttachmentFolder_(uploadVisitId);
      var blob = Utilities.newBlob(bytes, uploadMime, uploadName);
      var driveFile = visitFolder.createFile(blob);
      driveFile.setDescription('FSM Field Visit ' + uploadVisitId + ' attachment');

      var attachmentId = 'ATT-' + Utilities.getUuid().slice(0, 10).toUpperCase();
      var attachmentSheet = getVisitAttachmentsSheet_();
      var uploadedBy = String(user.name || user.fse || user.username || 'User');
      var uploadedAt = new Date();
      appendVisitAttachmentObject_(attachmentSheet, {
        id:attachmentId,
        visitId:uploadVisitId,
        fileId:driveFile.getId(),
        fileName:uploadName,
        mimeType:uploadMime,
        sizeBytes:bytes.length,
        uploadedBy:uploadedBy,
        uploadedAt:uploadedAt,
        provider:'drive-backend',
        webViewLink:''
      });

      var newCount = syncVisitAttachmentCount_(uploadVisitId);
      appendAudit_(
        user, 'CREATE', 'Visit Attachment', attachmentId,
        String(uploadVisit.site || '') + ' · ' + uploadName,
        null, {visitId:uploadVisitId,fileName:uploadName,mimeType:uploadMime,sizeBytes:bytes.length},
        'Visit attachment uploaded'
      );

      return json_({
        status:'ok',
        attachment:{
          id:attachmentId,visitId:uploadVisitId,fileName:uploadName,mimeType:uploadMime,
          sizeBytes:bytes.length,uploadedBy:uploadedBy,uploadedAt:uploadedAt
        },
        attachmentCount:newCount
      });
    }

    if (action === 'getVisitAttachmentPreview') {
      var previewAttachmentId = String(body.attachmentId || '').trim();
      var previewMeta = getRowObjectById_(getVisitAttachmentsSheet_(), previewAttachmentId);
      if (!previewMeta) throw new Error('Attachment not found.');
      requireVisitAttachmentAccess_(user, String(previewMeta.visitId || ''));

      var previewFileId = String(previewMeta.fileId || '').trim();
      if (!previewFileId) throw new Error('Attachment file is missing.');
      var previewMime = String(previewMeta.mimeType || '').trim().toLowerCase();
      var token = ScriptApp.getOAuthToken();
      var metaUrl = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(previewFileId) +
        '?fields=id%2Cname%2CmimeType%2ChasThumbnail%2CthumbnailLink&supportsAllDrives=true';
      var metaResp = UrlFetchApp.fetch(metaUrl, {
        method:'get',
        headers:{Authorization:'Bearer ' + token},
        muteHttpExceptions:true,
        followRedirects:true
      });

      if (metaResp.getResponseCode() >= 200 && metaResp.getResponseCode() < 300) {
        var driveMeta = JSON.parse(metaResp.getContentText() || '{}');
        var thumbnailLink = String(driveMeta.thumbnailLink || '').trim();
        if (thumbnailLink) {
          // Ask Drive for a larger preview thumbnail. The frontend requests these
          // automatically when the visit Attachments section opens; no original-file fallback is used.
          thumbnailLink = thumbnailLink.replace(/=s\d+(?:-[^?]*)?$/, '=s1200');
          var thumbResp = UrlFetchApp.fetch(thumbnailLink, {
            method:'get',
            headers:{Authorization:'Bearer ' + token},
            muteHttpExceptions:true,
            followRedirects:true
          });
          if (thumbResp.getResponseCode() >= 200 && thumbResp.getResponseCode() < 300) {
            var thumbBlob = thumbResp.getBlob();
            var thumbBytes = thumbBlob.getBytes();
            if (thumbBytes.length && thumbBytes.length <= 1024 * 1024) {
              return json_({
                status:'ok',
                kind:'thumbnail',
                id:previewAttachmentId,
                fileName:String(previewMeta.fileName || driveMeta.name || 'attachment'),
                sourceMimeType:previewMime || String(driveMeta.mimeType || ''),
                mimeType:String(thumbBlob.getContentType() || 'image/jpeg'),
                base64:Utilities.base64Encode(thumbBytes)
              });
            }
          }
        }
      }
      // Do not download the original image as a thumbnail fallback.
      // Returning immediately keeps automatic thumbnail loading lightweight and
      // prevents it from slowing down visit logging or attachment uploads.
      return json_({
        status:'ok',
        kind:'none',
        id:previewAttachmentId,
        fileName:String(previewMeta.fileName || 'attachment'),
        sourceMimeType:previewMime,
        mimeType:''
      });
    }

    if (action === 'getVisitAttachment') {
      var getAttachmentId = String(body.attachmentId || '').trim();
      var attachmentMeta = getRowObjectById_(getVisitAttachmentsSheet_(), getAttachmentId);
      if (!attachmentMeta) throw new Error('Attachment not found.');
      requireVisitAttachmentAccess_(user, String(attachmentMeta.visitId || ''));
      var attachmentProvider = String(attachmentMeta.provider || '').trim() || 'drive-backend';
      var attachmentDriveFile = DriveApp.getFileById(String(attachmentMeta.fileId || ''));
      var attachmentBlob = attachmentDriveFile.getBlob();
      var attachmentBytes = attachmentBlob.getBytes();
      if (attachmentBytes.length > 6 * 1024 * 1024) throw new Error('Attachment is too large to preview in FSM.');
      return json_({
        status:'ok',
        provider:'drive-backend',
        id:getAttachmentId,
        fileName:String(attachmentMeta.fileName || attachmentDriveFile.getName()),
        mimeType:String(attachmentMeta.mimeType || attachmentBlob.getContentType()),
        base64:Utilities.base64Encode(attachmentBytes)
      });
    }

    if (action === 'deleteVisitAttachment') {
      requireSession_(body.token, 'management');
      var deleteAttachmentId = String(body.attachmentId || '').trim();
      var attachmentSheetDelete = getVisitAttachmentsSheet_();
      var beforeAttachment = getRowObjectById_(attachmentSheetDelete, deleteAttachmentId);
      if (!beforeAttachment) throw new Error('Attachment not found.');
      var deleteVisitId = String(beforeAttachment.visitId || '');
      try {
        DriveApp.getFileById(String(beforeAttachment.fileId || '')).setTrashed(true);
      } catch (driveDeleteErr) {}
      removeRowById(attachmentSheetDelete, deleteAttachmentId);
      var deleteCount = syncVisitAttachmentCount_(deleteVisitId);
      appendAudit_(
        user, 'DELETE', 'Visit Attachment', deleteAttachmentId,
        String(beforeAttachment.fileName || ''),
        beforeAttachment, null, 'Visit attachment removed'
      );
      return json_({status:'ok', attachmentCount:deleteCount});
    }

    if (action === 'addEntry') {
      ensureEntriesServiceFormColumns_();
      ensureEntriesSupportingFsesColumn_();
      ensureEntriesAttachmentCountColumn_();
      var sheet = ss.getSheetByName('Entries');
      var headers = sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0];

      var entry = body.entry || {};

      requireFseFieldLogWrite_(user);
      // The backend, not the browser, sets the Primary FSE for new visits.
      entry.tech = String(user.fse || user.username || '').trim();
      if (!entry.tech) throw new Error('Your FSM account has no assigned FSE identity.');
      var primaryTech = String(entry.tech || '').trim().toLowerCase();
      var supporting = String(entry.supportingFses || '')
        .split(',')
        .map(function(v){ return String(v || '').trim(); })
        .filter(function(v, i, arr){
          if (!v || v.toLowerCase() === primaryTech) return false;
          return arr.map(function(x){ return String(x || '').trim().toLowerCase(); }).indexOf(v.toLowerCase()) === i;
        });
      entry.supportingFses = supporting.join(', ');
      if (entry.site) entry.site = canonicalSiteNameV2_(entry.site);

      var existingEntries = sheetObjects_(sheet);
      var duplicateEntryId = existingEntries.some(function(r){ return String(r.id || '') === String(entry.id || ''); });
      if (duplicateEntryId) throw new Error('This field visit was already saved. Refresh Field Logs before trying again.');
      prepareVisitServiceForm_(entry, null);
      var row = headers.map(function(h) {
        return entry[h] !== undefined ? visitEntryCell_(entry[h]) : '';
      });

      sheet.appendRow(row);
      appendAudit_(user, 'CREATE', 'Field Log', entry.id, (entry.site || '') + ' · ' + (entry.category || ''), null, entry, 'Field visit logged');
      return json_({status: 'ok', id: entry.id, serviceFormSaved:!!entry.serviceFormFileId});
    }

    if (action === 'updateEntry') {
      ensureEntriesServiceFormColumns_();
      ensureEntriesSupportingFsesColumn_();
      ensureEntriesAttachmentCountColumn_();
      var updateSheet = ss.getSheetByName('Entries');
      var updatedEntry = body.entry || {};
      var updateId = String(body.id || updatedEntry.id || '').trim();
      if (!updateId) throw new Error('Field log ID is required.');
      requireFseFieldLogWrite_(user);
      var beforeEntry = getRowObjectById_(updateSheet, updateId);
      if (!beforeEntry) throw new Error('Entry not found.');
      requirePrimaryFseFieldLogOwner_(user, beforeEntry);
      // Preserve the original record identity and Primary FSE.
      updatedEntry.id = updateId;
      updatedEntry.tech = beforeEntry.tech;
      var updatePrimary = String(updatedEntry.tech || '').trim().toLowerCase();
      updatedEntry.supportingFses = String(updatedEntry.supportingFses || '').split(',').map(function(v){return String(v||'').trim();}).filter(function(v,i,arr){if(!v||v.toLowerCase()===updatePrimary)return false;return arr.map(function(x){return String(x||'').trim().toLowerCase();}).indexOf(v.toLowerCase())===i;}).join(', ');
      if (updatedEntry.site) updatedEntry.site = canonicalSiteNameV2_(updatedEntry.site);
      prepareVisitServiceForm_(updatedEntry, beforeEntry);
      updateRowById_(updateSheet, updateId, updatedEntry);
      var afterEntry = getRowObjectById_(updateSheet, updateId);
      appendAudit_(user, 'UPDATE', 'Field Log', updateId, (afterEntry && afterEntry.site ? afterEntry.site : '') + ' · ' + (afterEntry && afterEntry.category ? afterEntry.category : ''), beforeEntry, afterEntry, 'Field visit edited');
      return json_({status:'ok', id:updateId, serviceFormSaved:!!updatedEntry.serviceFormFileId});
    }

    if (action === 'archiveEntry') {
      requireFseFieldLogWrite_(user);
      var archiveSheet = ss.getSheetByName('Entries');
      var beforeArchive = getRowObjectById_(archiveSheet, body.id);
      if (!beforeArchive) throw new Error('Entry not found.');
      requirePrimaryFseFieldLogOwner_(user, beforeArchive);
      // Void only the allowed fields; never accept arbitrary record replacements.
      updateRowById_(archiveSheet, body.id, {
        status:'Voided', voided:true, voidedAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      });
      var afterArchive = getRowObjectById_(archiveSheet, body.id);
      appendAudit_(user, 'VOID', 'Field Log', body.id, afterArchive ? String(afterArchive.site || '') : '', beforeArchive, afterArchive, 'Field visit voided / archived');
      return json_({status: 'ok'});
    }

    if (action === 'deleteEntry') {
      requireSession_(body.token, 'management');
      var deleteEntrySheet = ss.getSheetByName('Entries');
      var beforeDeleteEntry = getRowObjectById_(deleteEntrySheet, body.id);
      deleteAllVisitAttachments_(String(body.id || ''));
      removeRowById(deleteEntrySheet, body.id);
      appendAudit_(user, 'DELETE', 'Field Log', body.id, beforeDeleteEntry ? String(beforeDeleteEntry.site || '') : '', beforeDeleteEntry, null, 'Field visit permanently deleted');
      return json_({status: 'ok'});
    }

    if (action === 'saveSiteRecord') {
      requireSession_(body.token, 'management');
      var sr = body.record || {};
      var id = String(sr.id || '').trim() || ('SITE-' + Utilities.getUuid().slice(0, 8).toUpperCase());
      var name = canonicalSiteNameV2_(String(sr.name || '').trim());
      if (!name) throw new Error('Site name is required.');
      var siteCode = String(sr.siteCode || canonicalSiteCodeV2_(name) || '').trim();
      var status = String(sr.status || 'Active').trim();
      var openedDate = String(sr.openedDate || '').trim();
      var closedDate = status === 'Closed' ? String(sr.closedDate || '').trim() : '';
      if (status === 'Closed' && !closedDate) throw new Error('Closing date is required.');
      if (openedDate && closedDate && closedDate < openedDate) throw new Error('Closing date cannot be before opening date.');
      var registryCheck = sheetObjects_(getSitesLifecycleSheet_());
      var duplicateSite = registryCheck.some(function(r){ return String(r.id || '') !== id && normalizeSiteKeyV2_(canonicalSiteNameV2_(r.name)) === normalizeSiteKeyV2_(name); });
      if (duplicateSite) throw new Error('This site already exists in the Site Directory. Use the existing site record instead.');
      var siteRegistrySheet = getSitesLifecycleSheet_();
      var beforeSiteRecord = getRowObjectById_(siteRegistrySheet, id);

      upsertRowById_(siteRegistrySheet, id, [
        id, name, status, openedDate, closedDate,
        String(sr.remarks || '').trim(), new Date(), siteCode
      ]);

      var legacySites = ss.getSheetByName('Sites');
      var values = legacySites.getDataRange().getValues().map(function(r){
        return String(r[0] || '').trim().toLowerCase();
      });
      if (values.indexOf(name.toLowerCase()) === -1) legacySites.appendRow([name]);
      var afterSiteRecord = getRowObjectById_(siteRegistrySheet, id);
      appendAudit_(user, beforeSiteRecord ? 'UPDATE' : 'CREATE', 'Site', id, name, beforeSiteRecord, afterSiteRecord, beforeSiteRecord ? 'Site record updated' : 'Site record created');

      return json_({status:'ok', id:id});
    }


    if (action === 'deleteSiteRecord') {
      requireSession_(body.token, 'management');

      var siteId = String(body.id || '').trim();
      if (!siteId) throw new Error('Site record ID is required.');

      var registry = getSitesLifecycleSheet_();
      var rows = sheetObjects_(registry);
      var record = null;
      for (var dsri = 0; dsri < rows.length; dsri++) {
        if (String(rows[dsri].id || '') === siteId) {
          record = rows[dsri];
          break;
        }
      }
      if (!record) throw new Error('Site record not found.');

      var siteName = String(record.name || '').trim();
      if (!siteName) throw new Error('Site name is missing.');

      var refs = siteReferenceSummary_(siteName);
      if (refs.total > 0) {
        var usedBy = [];
        if (refs.entries) usedBy.push(refs.entries + ' field visit' + (refs.entries === 1 ? '' : 's'));
        if (refs.cabinets) usedBy.push(refs.cabinets + ' cabinet' + (refs.cabinets === 1 ? '' : 's'));
        if (refs.inventory) usedBy.push(refs.inventory + ' inventory record' + (refs.inventory === 1 ? '' : 's'));
        if (refs.movements) usedBy.push(refs.movements + ' movement' + (refs.movements === 1 ? '' : 's'));
        throw new Error('Cannot delete this site because it is already used by ' + usedBy.join(', ') + '. Mark it Closed instead.');
      }

      removeRowById(registry, siteId);

      // Only remove the legacy Sites value when no other registry record uses this name.
      var remaining = sheetObjects_(registry);
      var sameNameStillExists = remaining.some(function(r){
        return String(r.name || '').trim().toLowerCase() === siteName.toLowerCase();
      });

      if (!sameNameStillExists) {
        var legacySitesSheet = ss.getSheetByName('Sites');
        if (legacySitesSheet) removeValueFromSheetCaseInsensitive_(legacySitesSheet, siteName);
      }
      appendAudit_(user, 'DELETE', 'Site', siteId, siteName, record, null, 'Unused Site Directory record deleted');

      return json_({status:'ok'});
    }

    if (action === 'addSite') {
      requireSession_(body.token, 'management');
      var siteName = canonicalSiteNameV2_(String(body.name || '').trim());
      if (!siteName) throw new Error('Site name is required.');
      var lifecycleExisting = sheetObjects_(getSitesLifecycleSheet_());
      var sameCanonical = lifecycleExisting.some(function(r){ return normalizeSiteKeyV2_(canonicalSiteNameV2_(r.name)) === normalizeSiteKeyV2_(siteName); });
      if (sameCanonical) throw new Error('This site already exists in the Site Directory.');
      ss.getSheetByName('Sites').appendRow([siteName]);
      var newSiteId = 'SITE-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      getSitesLifecycleSheet_().appendRow([
        newSiteId, siteName, 'Active', '', '', '', new Date(), canonicalSiteCodeV2_(siteName)
      ]);
      appendAudit_(user, 'CREATE', 'Site', newSiteId, siteName, null, {id:newSiteId,name:siteName,status:'Active',siteCode:canonicalSiteCodeV2_(siteName)}, 'Site added');
      return json_({status: 'ok'});
    }

    if (action === 'removeSite') {
      requireSession_(body.token, 'management');
      removeValueFromSheet(
        ss.getSheetByName('Sites'),
        body.name
      );
      return json_({status: 'ok'});
    }

    if (action === 'addFse') {
      requireSession_(body.token, 'management');
      ss.getSheetByName('FSEs').appendRow([body.name]);
      appendAudit_(user, 'CREATE', 'FSE', String(body.name || ''), String(body.name || ''), null, {name:body.name}, 'FSE added to directory');
      return json_({status: 'ok'});
    }

    if (action === 'removeFse') {
      requireSession_(body.token, 'management');
      removeValueFromSheet(
        ss.getSheetByName('FSEs'),
        body.name
      );
      appendAudit_(user, 'DELETE', 'FSE', String(body.name || ''), String(body.name || ''), {name:body.name}, null, 'FSE removed from directory');
      return json_({status: 'ok'});
    }

    if (action === 'saveInventory') {
      requireSession_(body.token, 'management');
      var inventorySheet = getInventorySheet_();
      var record = body.record || {};
      var inventoryId = String(record.id || '').trim();
      if (!inventoryId) {
        inventoryId = 'INV-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      }
      var beforeInventory = getRowObjectById_(inventorySheet, inventoryId);
      var inventoryRow = [
        inventoryId,
        canonicalSiteNameV2_(record.site),
        Number(record.quantity || 0),
        String(record.deploymentStatus || '').trim(),
        String(record.operationalStatus || '').trim(),
        String(record.remarks || '').trim(),
        new Date()
      ];
      if (!inventoryRow[1] || inventoryRow[2] < 1) {
        throw new Error('Site/location and quantity are required.');
      }
      upsertInventoryRow_(inventorySheet, inventoryId, inventoryRow);
      var afterInventory = getRowObjectById_(inventorySheet, inventoryId);
      appendAudit_(user, beforeInventory ? 'UPDATE' : 'CREATE', 'Inventory', inventoryId, String(afterInventory ? afterInventory.site || '' : record.site || ''), beforeInventory, afterInventory, beforeInventory ? 'Inventory record updated' : 'Inventory record created');
      return json_({status: 'ok', id: inventoryId});
    }

    if (action === 'deleteInventory') {
      requireSession_(body.token, 'management');
      var delInventorySheet = getInventorySheet_();
      var beforeDeleteInventory = getRowObjectById_(delInventorySheet, body.id);
      removeRowById(delInventorySheet, body.id);
      appendAudit_(user, 'DELETE', 'Inventory', body.id, beforeDeleteInventory ? String(beforeDeleteInventory.site || '') : '', beforeDeleteInventory, null, 'Inventory record deleted');
      return json_({status: 'ok'});
    }

    if (action === 'saveCabinet') {
      requireSession_(body.token, 'management');
      var cabinetsSheet = getCabinetsSheet_();
      var c = body.record || {};
      var rowId = String(c.id || '').trim();
      if (!rowId) {
        rowId = 'CAB-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      }
      var cabinetId = String(c.cabinetId || '').trim();
      var site = canonicalSiteNameV2_(c.site);
      var beforeCabinet = getRowObjectById_(cabinetsSheet, rowId);
      var permanentNumber = beforeCabinet
        ? normalizePermanentCabinetNumber_(beforeCabinet.permanentNumber)
        : nextPermanentCabinetNumber_(cabinetsSheet);
      if (!permanentNumber) permanentNumber = nextPermanentCabinetNumber_(cabinetsSheet);
      if (!cabinetId || !site) {
        throw new Error('Cabinet ID and site/location are required.');
      }
      ensureUniqueCabinetId_(cabinetsSheet, cabinetId, rowId);
      ensureUniqueCabinetKey_(cabinetsSheet, 6, c.token, rowId, 'Opexa / Game Token');
      ensureUniqueCabinetKey_(cabinetsSheet, 7, c.teamviewerId, rowId, 'TeamViewer ID');
      ensureUniqueCabinetKey_(cabinetsSheet, 8, c.mpuSerial, rowId, 'MPU Serial');
      ensureUniqueCabinetKey_(cabinetsSheet, 9, c.cabinetSerial, rowId, 'Cabinet Serial');
      ensureUniqueCabinetKey_(cabinetsSheet, 11, c.bvSerial, rowId, 'BV Serial');
      ensureUniqueCabinetKey_(cabinetsSheet, 13, c.printerSerial, rowId, 'Printer Serial');
      var cabRow = [
        rowId,
        cabinetId,
        site,
        String(c.label || '').trim(),
        String(c.status || '').trim(),
        String(c.token || '').trim(),
        String(c.teamviewerId || '').trim(),
        String(c.mpuSerial || '').trim(),
        String(c.cabinetSerial || '').trim(),
        String(c.bvModel || '').trim(),
        String(c.bvSerial || '').trim(),
        String(c.printerModel || '').trim(),
        String(c.printerSerial || '').trim(),
        String(c.networkNote || '').trim(),
        String(c.remarks || '').trim(),
        new Date(),
        permanentNumber
      ];
      upsertCabinetRow_(cabinetsSheet, rowId, cabRow);
      var afterCabinet = getRowObjectById_(cabinetsSheet, rowId);
      appendAudit_(user, beforeCabinet ? 'UPDATE' : 'CREATE', 'Cabinet', rowId, cabinetId + (site ? ' · ' + site : ''), beforeCabinet, afterCabinet, beforeCabinet ? 'Cabinet profile updated' : 'Cabinet profile created');
      return json_({status: 'ok', id: rowId, permanentNumber: permanentNumber});
    }

    if (action === 'deleteCabinet') {
      requireSession_(body.token, 'management');
      var delCabSheet = getCabinetsSheet_();
      var beforeDeleteCabinet = getRowObjectById_(delCabSheet, body.id);
      removeRowById(delCabSheet, body.id);
      appendAudit_(user, 'DELETE', 'Cabinet', body.id, beforeDeleteCabinet ? String(beforeDeleteCabinet.cabinetId || '') : '', beforeDeleteCabinet, null, 'Cabinet profile deleted');
      return json_({status: 'ok'});
    }

    if (action === 'saveSparePart') {
      requireSession_(body.token, 'management');
      var p = body.record || {};
      var sh = getSparePartsSheet_();
      var id = String(p.id || '').trim() || ('SP-' + Utilities.getUuid().slice(0, 8).toUpperCase());
      var beforeSpare = getRowObjectById_(sh, id);
      var row = [
        id,
        String(p.partName || '').trim(),
        String(p.category || '').trim(),
        String(p.brandModel || '').trim(),
        String(p.serialNo || '').trim(),
        Number(p.quantity || 0),
        Number(p.minStock || 0),
        String(p.location || '').trim(),
        String(p.status || 'Available').trim(),
        String(p.remarks || '').trim(),
        new Date()
      ];
      if (!row[1]) throw new Error('Part name is required.');
      upsertRowById_(sh, id, row);
      var afterSpare = getRowObjectById_(sh, id);
      appendAudit_(user, beforeSpare ? 'UPDATE' : 'CREATE', 'Spare Part', id, String(p.partName || ''), beforeSpare, afterSpare, beforeSpare ? 'Spare-part record updated' : 'Spare-part record created');
      return json_({status:'ok', id:id});
    }

    if (action === 'deleteSparePart') {
      requireSession_(body.token, 'management');
      var delSpareSheet = getSparePartsSheet_();
      var beforeDeleteSpare = getRowObjectById_(delSpareSheet, body.id);
      removeRowById(delSpareSheet, body.id);
      appendAudit_(user, 'DELETE', 'Spare Part', body.id, beforeDeleteSpare ? String(beforeDeleteSpare.partName || '') : '', beforeDeleteSpare, null, 'Spare-part record deleted');
      return json_({status:'ok'});
    }

    if (action === 'useSparePart') {
      // Any authenticated field user may consume a spare during a field visit.
      var user = requireSession_(body.token);
      var u = body.record || {};
      var partId = String(u.partId || '').trim();
      var cabinetRowId = String(u.cabinetRowId || '').trim();
      var qty = Number(u.quantity || 1);
      if (!partId || !cabinetRowId || qty <= 0) throw new Error('Part, cabinet and valid quantity are required.');

      var partsSheet = getSparePartsSheet_();
      var part = getRowObjectById_(partsSheet, partId);
      if (!part) throw new Error('Spare part not found.');
      var available = Number(part.quantity || 0);
      if (available < qty) throw new Error('Not enough stock. Available: ' + available);

      var cabinetsSheet = getCabinetsSheet_();
      var cab = getCabinetByRowId_(cabinetsSheet, cabinetRowId);
      if (!cab) throw new Error('Cabinet profile not found.');

      var newQty = available - qty;
      partsSheet.getRange(part.__row, 6).setValue(newQty);
      partsSheet.getRange(part.__row, 11).setValue(new Date());

      var usedSheet = getCabinetPartsSheet_();
      var usedId = 'CPU-' + Utilities.getUuid().slice(0,8).toUpperCase();
      var usedDate = String(u.usedDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')).trim();
      var usedBy = String(u.usedBy || user.name || user.username || '').trim();

      usedSheet.appendRow([
        usedId,
        cabinetRowId,
        String(cab.cabinetId || '').trim(),
        partId,
        String(part.partName || '').trim(),
        String(part.category || '').trim(),
        String(part.brandModel || '').trim(),
        String(part.serialNo || '').trim(),
        qty,
        String(u.actionType || 'Installed / Used').trim(),
        String(u.previousPart || u.removedSerial || '').trim(),
        String(u.visitId || '').trim(),
        usedDate,
        usedBy,
        String(u.remarks || '').trim(),
        new Date()
      ]);

      var removedId = '';
      var actionType = String(u.actionType || '').trim();
      var removedSerial = String(u.removedSerial || '').trim();
      var removedName = String(u.removedPartName || part.partName || '').trim();
      var disposition = String(u.removedDisposition || '').trim();

      if ((actionType === 'Replacement' || actionType === 'Temporary Replacement') &&
          (removedSerial || disposition || String(u.previousPart || '').trim())) {
        var removedSheet = getRemovedPartsSheet_();
        removedId = 'RP-' + Utilities.getUuid().slice(0,8).toUpperCase();
        removedSheet.appendRow([
          removedId,
          usedId,
          cabinetRowId,
          String(cab.cabinetId || '').trim(),
          removedName,
          String(u.removedCategory || part.category || '').trim(),
          String(u.removedModel || part.brandModel || '').trim(),
          removedSerial || String(u.previousPart || '').trim(),
          usedDate,
          usedBy,
          disposition || 'For Repair',
          disposition === 'For Disposal' ? 'For Disposal' : (disposition || 'For Repair'),
          '',
          '',
          '',
          '',
          '',
          '',
          String(u.removedLocation || '').trim(),
          String(u.removedRemarks || u.remarks || '').trim(),
          new Date()
        ]);
      }

      appendAudit_(user, 'USE', 'Spare Part', partId, String(part.partName || ''), {quantity:available}, {quantity:newQty,cabinetId:String(cab.cabinetId || ''),usageId:usedId,removedPartId:removedId}, 'Spare part used / installed on cabinet');
      return json_({status:'ok', remaining:newQty, usageId:usedId, removedPartId:removedId});
    }

    if (action === 'updateRemovedPart') {
      requireSession_(body.token, 'management');
      var r = body.record || {};
      var removedSheet2 = getRemovedPartsSheet_();
      var removedId2 = String(r.id || '').trim();
      if (!removedId2) throw new Error('Removed part ID is required.');

      var removed = getRowObjectById_(removedSheet2, removedId2);
      if (!removed) throw new Error('Removed part record not found.');

      var headers2 = removedSheet2.getRange(1,1,1,removedSheet2.getLastColumn()).getValues()[0];
      var updates = {
        status: r.status,
        disposition: r.disposition,
        repairVendor: r.repairVendor,
        repairDate: r.repairDate,
        repairNotes: r.repairNotes,
        location: r.location,
        remarks: r.remarks,
        updatedAt: new Date()
      };
      Object.keys(updates).forEach(function(key){
        if (updates[key] === undefined) return;
        var idx = headers2.indexOf(key);
        if (idx >= 0) removedSheet2.getRange(removed.__row, idx + 1).setValue(updates[key]);
      });
      var afterRemoved = getRowObjectById_(removedSheet2, removedId2);
      appendAudit_(user, 'UPDATE', 'Removed Part', removedId2, String(removed.partName || removed.serialNo || ''), removed, afterRemoved, 'Removed-part lifecycle updated');
      return json_({status:'ok'});
    }

    if (action === 'returnRemovedPartToStock') {
      var returnUser = requireSession_(body.token, 'management');
      var rr = body.record || {};
      var removedSheet3 = getRemovedPartsSheet_();
      var rid = String(rr.id || '').trim();
      if (!rid) throw new Error('Removed part ID is required.');

      var oldPart = getRowObjectById_(removedSheet3, rid);
      if (!oldPart) throw new Error('Removed part record not found.');
      if (String(oldPart.status || '') === 'Returned to Stock') {
        throw new Error('This part has already been returned to stock.');
      }

      var stockSheet = getSparePartsSheet_();
      var stockId = '';
      var serial = String(oldPart.serialNo || '').trim();
      var existingStock = serial ? findRowObjectByValue_(stockSheet, 'serialNo', serial) : null;

      if (existingStock) {
        stockId = String(existingStock.id || '');
        stockSheet.getRange(existingStock.__row, 6).setValue(Number(existingStock.quantity || 0) + 1);
        stockSheet.getRange(existingStock.__row, 8).setValue(String(rr.location || oldPart.location || existingStock.location || '').trim());
        stockSheet.getRange(existingStock.__row, 9).setValue('Available');
        stockSheet.getRange(existingStock.__row, 11).setValue(new Date());
      } else {
        stockId = 'SP-' + Utilities.getUuid().slice(0, 8).toUpperCase();
        stockSheet.appendRow([
          stockId,
          String(oldPart.partName || 'Recovered Part').trim(),
          String(oldPart.category || 'Other').trim(),
          String(oldPart.brandModel || '').trim(),
          serial,
          1,
          0,
          String(rr.location || oldPart.location || '').trim(),
          'Available',
          'Returned from repair / removed-part lifecycle. Source cabinet: ' + String(oldPart.cabinetId || ''),
          new Date()
        ]);
      }

      var hdr = removedSheet3.getRange(1,1,1,removedSheet3.getLastColumn()).getValues()[0];
      var values = {
        status: 'Returned to Stock',
        disposition: 'Returned to Stock',
        stockPartId: stockId,
        returnedDate: String(rr.returnedDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')),
        returnedBy: String(rr.returnedBy || returnUser.name || returnUser.username || ''),
        location: String(rr.location || oldPart.location || ''),
        updatedAt: new Date()
      };
      Object.keys(values).forEach(function(key){
        var idx = hdr.indexOf(key);
        if (idx >= 0) removedSheet3.getRange(oldPart.__row, idx + 1).setValue(values[key]);
      });

      var afterReturnedPart = getRowObjectById_(removedSheet3, rid);
      appendAudit_(returnUser, 'RETURN', 'Removed Part', rid, String(oldPart.partName || oldPart.serialNo || ''), oldPart, afterReturnedPart, 'Removed part returned to available stock');
      return json_({status:'ok', stockPartId:stockId});
    }

    if (action === 'saveMovement') {
      var actor = requireSession_(body.token, 'management');
      var m = body.record || {};
      var cabinetRowId = String(m.cabinetRowId || '').trim();
      if (!cabinetRowId) {
        throw new Error('Cabinet is required.');
      }

      var cabinets = getCabinetsSheet_();
      var cabinetInfo = getCabinetByRowId_(cabinets, cabinetRowId);
      if (!cabinetInfo) {
        throw new Error('Cabinet profile was not found.');
      }

      var movementDate = String(m.movementDate || '').trim();
      var movementType = String(m.movementType || '').trim();
      var fromLocation = String(cabinetInfo.site || '').trim();
      var toLocation = canonicalSiteNameV2_(m.toLocation);
      var statusBefore = String(cabinetInfo.status || '').trim();
      var statusAfter = String(m.statusAfter || statusBefore).trim();
      var handledBy = String(m.handledBy || actor.name || actor.username || '').trim();
      var referenceNo = String(m.referenceNo || '').trim();
      var remarks = String(m.remarks || '').trim();
      var allocationBefore = String(cabinetInfo.cabinetId || '').trim();
      var permanentNumber = normalizePermanentCabinetNumber_(cabinetInfo.permanentNumber);
      if (!permanentNumber) {
        ensureCabinetPermanentNumbers_(cabinets);
        cabinetInfo = getCabinetByRowId_(cabinets, cabinetRowId);
        permanentNumber = normalizePermanentCabinetNumber_(cabinetInfo && cabinetInfo.permanentNumber);
      }
      if (!permanentNumber) throw new Error('Permanent cabinet number could not be assigned.');
      var allocationAfter = String(m.allocationAfter || '').trim();

      if (!movementDate || !movementType) {
        throw new Error('Movement date and movement type are required.');
      }

      if (movementType !== 'Status Change' && !toLocation) {
        throw new Error('Destination / new location is required.');
      }

      if (!toLocation) {
        toLocation = fromLocation;
      }

      var warehouseMove = isWarehouseLocationV2_(toLocation) || movementType === 'Warehouse Return' || statusAfter === 'Warehouse / Stock';
      var locationChanged = normalizeSiteKeyV2_(toLocation) !== normalizeSiteKeyV2_(fromLocation);

      if (movementType === 'Status Change' && !locationChanged) {
        allocationAfter = allocationBefore;
      } else if (warehouseMove) {
        allocationAfter = allocationIdForPermanentNumber_('STOCK', permanentNumber);
        statusAfter = 'Warehouse / Stock';
      } else {
        var autoPrefix = allocationPrefixForSiteV2_(cabinets, toLocation);
        if (autoPrefix) {
          allocationAfter = allocationIdForPermanentNumber_(autoPrefix, permanentNumber);
        } else {
          if (!allocationAfter) {
            throw new Error('Enter the destination cabinet name and keep Cabinet #' + permanentNumber + ' as the ending number.');
          }
          if (!allocationKeepsPermanentNumber_(allocationAfter, permanentNumber)) {
            throw new Error('Cabinet #' + permanentNumber + ' is permanent. The destination cabinet name must end in ' + permanentNumber + '.');
          }
        }
      }

      if (!allocationAfter) {
        throw new Error('Allocation after movement could not be generated.');
      }

      if (movementType !== 'Status Change' && !allocationKeepsPermanentNumber_(allocationAfter, permanentNumber)) {
        throw new Error('Cabinet #' + permanentNumber + ' is permanent. Allocation names must keep the same number.');
      }

      ensureUniqueCabinetId_(cabinets, allocationAfter, cabinetRowId);

      var movementId = 'MOV-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      var movementSheet = getCabinetMovementsSheet_();

      movementSheet.appendRow([
        movementId,
        cabinetRowId,
        allocationBefore,
        movementDate,
        movementType,
        fromLocation,
        toLocation,
        statusBefore,
        statusAfter,
        handledBy,
        referenceNo,
        remarks,
        new Date(),
        allocationBefore,
        allocationAfter
      ]);

      updateCabinetAllocationLocationStatus_(cabinets, cabinetRowId, allocationAfter, toLocation, statusAfter);
      appendAudit_(
        actor,
        'MOVE',
        'Cabinet',
        cabinetRowId,
        allocationBefore + (allocationAfter !== allocationBefore ? ' → ' + allocationAfter : ''),
        {cabinetId:allocationBefore,permanentNumber:permanentNumber,site:fromLocation,status:statusBefore},
        {cabinetId:allocationAfter,permanentNumber:permanentNumber,site:toLocation,status:statusAfter,movementId:movementId,movementType:movementType},
        'Cabinet movement recorded'
      );

      return json_({
        status: 'ok',
        id: movementId,
        cabinetId: allocationAfter,
        allocationBefore: allocationBefore,
        allocationAfter: allocationAfter,
        permanentNumber: permanentNumber,
        site: toLocation,
        cabinetStatus: statusAfter
      });
    }

    throw new Error('Unknown action.');

  } catch (err) {
    return json_({
      status: 'error',
      error: err.message
    });
  }
}




function accountSignatureProperty_(user) {
  if (!user || !user.username || ['fse','management'].indexOf(user.role) === -1) throw new Error('A signed-in account is required.');
  return 'FSM_ACCOUNT_SIGNATURE_' + encodeURIComponent(String(user.username).trim().toLowerCase());
}
function readAccountSignature_(user) {
  var id = PropertiesService.getScriptProperties().getProperty(accountSignatureProperty_(user));
  if (!id) return null;
  // A read failure is an error, not an invitation to overwrite a saved signature.
  return JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'));
}
function saveAccountSignature_(user, value) {
  var key = accountSignatureProperty_(user), image = String(value && value.image || '');
  if (image.length > 150000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image)) throw new Error('A valid PNG signature is required.');
  var name = String(user.fse || user.name || user.username).trim();
  var fullNames = {erwin:'Erwin Santos',popoy:'Lennard Manabat',ian:'Ian Ronquillo'};
  var signature = {image:image,name:fullNames[name.toLowerCase()] || name,signedAt:new Date().toISOString()};
  var root = getVisitAttachmentRootFolder_(), folders = root.getFoldersByName('Account Signatures');
  var folder = folders.hasNext() ? folders.next() : root.createFolder('Account Signatures');
  var file = folder.createFile('account-signature-' + Utilities.getUuid() + '.json', JSON.stringify(signature), 'application/json');
  PropertiesService.getScriptProperties().setProperty(key, file.getId());
  return signature;
}

function ensureEntriesServiceFormColumns_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Entries');
  if (!sheet || sheet.getLastRow() === 0) throw new Error('Entries sheet is missing its headers.');
  ['serviceFormFileId','siteSelection'].forEach(function(name){ ensureHeader_(sheet, name); });
}

function visitEntryCell_(value) {
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
}

function prepareVisitServiceForm_(entry, before) {
  // Never accept arbitrary Drive file IDs from clients.
  entry.serviceFormFileId = before ? String(before.serviceFormFileId || '') : '';
  if (Object.prototype.hasOwnProperty.call(entry, 'serviceForm')) {
    var form = entry.serviceForm;
    if (typeof form === 'string' && form) form = JSON.parse(form);
    if (form && (typeof form !== 'object' || Array.isArray(form))) throw new Error('Invalid service form.');
    if (form) {
      var text = JSON.stringify(form);
      if (text.length > 650000) throw new Error('Service form is too large. Please sign again.');
      // A new immutable snapshot avoids changing an existing form if the row write fails.
      var file = getVisitAttachmentFolder_(entry.id || before.id)
        .createFile('service-form-' + Utilities.getUuid() + '.json', text, 'application/json');
      entry.serviceFormFileId = file.getId();
    } else entry.serviceFormFileId = '';
  }
  // Keep signature payloads out of spreadsheet cells and audit snapshots.
  delete entry.serviceForm;
  if (typeof entry.audit === 'string') {
    try { entry.audit = JSON.parse(entry.audit); } catch (e) { entry.audit = []; }
  }
  if (Array.isArray(entry.audit)) entry.audit = entry.audit.map(function(item){
    var copy = Object.assign({}, item); delete copy.serviceForm; return copy;
  });
}

function hydrateVisitServiceForm_(entry) {
  var fileId = String(entry.serviceFormFileId || '');
  if (!fileId) return;
  try {
    entry.serviceForm = JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8'));
  } catch (e) {
    entry.serviceFormLoadError = 'The saved service form could not be loaded. Please refresh or contact management.';
    console.error('Service form read failed for visit ' + entry.id + ': ' + e.message);
  }
}

// Run once from the Apps Script editor to recover older forms, when the old
// API successfully retained their complete payload in AuditTrail.afterJson.
function recoverServiceFormsFromAudit() {
  ensureEntriesServiceFormColumns_();
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName('Entries');
  var visits = sheetObjects_(sheet), history = sheetObjects_(getAuditTrailSheet_());
  var latest = {};
  history.forEach(function(event){
    if (event.entityType !== 'Field Log' || !event.afterJson) return;
    try {
      var entry = JSON.parse(event.afterJson);
      if (entry && Object.prototype.hasOwnProperty.call(entry, 'serviceForm')) latest[String(entry.id)] = entry;
    } catch (e) {}
  });
  var recovered = 0;
  visits.forEach(function(visit){
    var saved = latest[String(visit.id)];
    if (visit.serviceFormFileId || !saved || !saved.serviceForm) return;
    var update = {id:visit.id, serviceForm:saved.serviceForm};
    prepareVisitServiceForm_(update, visit);
    updateRowById_(sheet, visit.id, update);
    recovered++;
  });
  console.log('Recovered service forms: ' + recovered);
  return recovered;
}

function ensureEntriesAttachmentCountColumn_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Entries');
  if (!sheet) return;
  if (sheet.getLastRow() === 0) return;
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
    .map(function(v){ return String(v || '').trim(); });
  if (headers.indexOf('attachmentCount') === -1) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('attachmentCount');
  }
}

function getVisitAttachmentsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('VisitAttachments');
  var headers = ['id','visitId','fileId','fileName','mimeType','sizeBytes','uploadedBy','uploadedAt','provider','webViewLink'];
  if (!sh) {
    sh = ss.insertSheet('VisitAttachments');
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else {
    headers.forEach(function(header){ ensureHeader_(sh, header); });
  }
  return sh;
}

function appendVisitAttachmentObject_(sheet, obj) {
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0]
    .map(function(v){ return String(v || '').trim(); });
  sheet.appendRow(headers.map(function(header){
    return obj[header] !== undefined ? obj[header] : '';
  }));
}


function getVisitAttachmentRootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = String(props.getProperty('FSM_VISIT_ATTACHMENTS_ROOT_ID') || '').trim();
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {}
  }
  var folder = DriveApp.createFolder('FSM Visit Attachments');
  props.setProperty('FSM_VISIT_ATTACHMENTS_ROOT_ID', folder.getId());
  return folder;
}

function getVisitAttachmentFolder_(visitId) {
  visitId = String(visitId || '').trim();
  if (!visitId) throw new Error('Visit ID is required.');
  var root = getVisitAttachmentRootFolder_();
  var safeName = visitId.replace(/[^A-Za-z0-9._-]/g, '_');
  var folders = root.getFoldersByName(safeName);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(safeName);
}

function sanitizeAttachmentFileName_(name) {
  name = String(name || '').replace(/[\x00-\x1F<>:"\/\\|?*]+/g, '_').trim();
  if (!name) return '';
  if (name.length > 160) name = name.slice(0, 160);
  return name;
}

function requireVisitAttachmentAccess_(user, visitId, forWrite) {
  visitId = String(visitId || '').trim();
  if (!visitId) throw new Error('Visit ID is required.');
  var entrySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Entries');
  var entry = getRowObjectById_(entrySheet, visitId);
  if (!entry) throw new Error('Field visit not found.');
  // Viewing an attachment follows the same team-wide read rules as Field Logs.
  // Only the Primary FSE may upload or modify attachments for this visit.
  if (forWrite) requirePrimaryFseFieldLogOwner_(user, entry);
  return entry;
}

function syncVisitAttachmentCount_(visitId) {
  ensureEntriesAttachmentCountColumn_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var entrySheet = ss.getSheetByName('Entries');
  var attachmentSheet = getVisitAttachmentsSheet_();
  var count = sheetObjects_(attachmentSheet).filter(function(r){
    return String(r.visitId || '') === String(visitId || '');
  }).length;

  if (entrySheet && entrySheet.getLastRow() >= 2) {
    var headers = entrySheet.getRange(1,1,1,entrySheet.getLastColumn()).getDisplayValues()[0]
      .map(function(v){ return String(v || '').trim(); });
    var countCol = headers.indexOf('attachmentCount') + 1;
    var idCol = headers.indexOf('id') + 1;
    if (countCol && idCol) {
      var ids = entrySheet.getRange(2,idCol,entrySheet.getLastRow()-1,1).getDisplayValues();
      for (var i=0;i<ids.length;i++) {
        if (String(ids[i][0]) === String(visitId)) {
          entrySheet.getRange(i+2,countCol).setValue(count);
          break;
        }
      }
    }
  }
  return count;
}

function deleteAllVisitAttachments_(visitId) {
  visitId = String(visitId || '').trim();
  if (!visitId) return;
  var sh = getVisitAttachmentsSheet_();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function(v){ return String(v || '').trim(); });
  var visitIdx = headers.indexOf('visitId');
  var fileIdx = headers.indexOf('fileId');
  var rowsToDelete = [];
  for (var i=1;i<data.length;i++) {
    if (String(data[i][visitIdx] || '') !== visitId) continue;
    try { DriveApp.getFileById(String(data[i][fileIdx] || '')).setTrashed(true); } catch (e) {}
    rowsToDelete.push(i+1);
  }
  rowsToDelete.sort(function(a,b){ return b-a; }).forEach(function(row){ sh.deleteRow(row); });
}


function updateRowById_(sheet, id, entry) {
  var data = sheet.getDataRange().getValues();

  if (!data.length) {
    throw new Error('Entries sheet is empty.');
  }

  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      var updatedRow = headers.map(function(h, col) {
        return entry[h] !== undefined ? visitEntryCell_(entry[h]) : data[i][col];
      });

      sheet
        .getRange(i + 1, 1, 1, headers.length)
        .setValues([updatedRow]);
      return;
    }
  }

  throw new Error('Entry not found.');
}


function countSiteMatchesInSheet_(sheet, columnNames, siteName) {
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var data = sheet.getDataRange().getValues();
  if (!data.length) return 0;

  var headers = data[0].map(function(h){ return String(h || '').trim(); });
  var wanted = columnNames.map(function(h){ return String(h || '').toLowerCase(); });
  var indexes = [];

  headers.forEach(function(h, i){
    if (wanted.indexOf(h.toLowerCase()) !== -1) indexes.push(i);
  });

  if (!indexes.length) return 0;

  var target = String(siteName || '').trim().toLowerCase();
  var count = 0;

  for (var r = 1; r < data.length; r++) {
    var matched = indexes.some(function(i){
      return String(data[r][i] || '').trim().toLowerCase() === target;
    });
    if (matched) count++;
  }
  return count;
}

function siteReferenceSummary_(siteName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var entries = countSiteMatchesInSheet_(ss.getSheetByName('Entries'), ['site'], siteName);
  var cabinets = countSiteMatchesInSheet_(ss.getSheetByName('Cabinets'), ['site'], siteName);
  var inventory = countSiteMatchesInSheet_(ss.getSheetByName('Inventory'), ['site'], siteName);
  var movements = countSiteMatchesInSheet_(
    ss.getSheetByName('CabinetMovements'),
    ['fromLocation','toLocation'],
    siteName
  );

  return {
    entries: entries,
    cabinets: cabinets,
    inventory: inventory,
    movements: movements,
    total: entries + cabinets + inventory + movements
  };
}

function removeValueFromSheetCaseInsensitive_(sheet, value) {
  var data = sheet.getDataRange().getValues();
  var target = String(value || '').trim().toLowerCase();

  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][0] || '').trim().toLowerCase() === target) {
      sheet.deleteRow(i + 1);
    }
  }
}

function removeRowById(sheet, id) {
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function removeValueFromSheet(sheet, value) {
  var data = sheet.getDataRange().getValues();

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === value) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}



// ===== Site Directory V2 =====
// Canonical site identity + aliases used by SiteRegistry, Inventory, Cabinets,
// Entries and Cabinet Movements. Inventory-only locations such as Carmona Cavite
// remain unchanged unless explicitly mapped here.
var SITE_DIRECTORY_V2 = [
  {code:'BRANT', name:'BINGO REPUBLIC ANTIQUE', aliases:['Bingo Republic - Antique']},
  {code:'BRNAGA', name:'BINGO REPUBLIC NAGA', aliases:['Bingo Republic - Naga']},
  {code:'BRCAL', name:'BINGO REPUBLIC DEPARO', aliases:['Bingo Republic - Caloocan','BINGO REPUBLIC CALOOCAN','BRCALOOCAN','BRCAL']},
  {code:'BRRQC', name:'Big A Gaming Corp. Quezon City', aliases:['IEST Kamias (IWP)','Big A Gaming Corp Quezon City']},
  {code:'OECPANG', name:'Radiant Bay Games and Entertainment Corporation - Angono', aliases:[]},
  {code:'ECPLIPA', name:'Radiant Bay Games and Entertainment Corporation - Lipa', aliases:[]},
  {code:'TREGSC', name:'TREGS Electronic Gaming Station Inc. - Sta Cruz', aliases:[]},
  {code:'TREGTUR', name:'TREGS Electronic Gaming Station Inc. - Turbina', aliases:[]},
  {code:'OT2BYPAS', name:'TREGS Electronic Gaming Station Inc. - Calamba (Lamesa Bypass)', aliases:[]},
  {code:'OT8MAR', name:'Triple 8 Entertainment Company Inc. - Venezia', aliases:['Triple 8 Entertainment Company Inc. - Venezia Marikina']},
  {code:'olutarlc', name:'LuckyU Inc. - Tarlac (EzBet)', aliases:['Lucky U Inc Tarlac','LuckyU Tarlac','OLUTAR']},
  {code:'oshangel', name:'SHL Amusement & Gaming, Inc. - Angeles (former Don Meleton)', aliases:['SHL Amusement & Gaming Inc. - Angeles Pampanga','SHLANG']},
  {code:'opgrzl', name:'PINOYGAMES- Valleyfair, Taytay', aliases:['Pinoy Games Gaming & Amusement Corp','PGTAY']},
  {code:'OT8SJD', name:'Venezia Bingo Botique SJDM', aliases:['Triple 8 Entertainment Company Inc. - Venezia SJDM','OT8SJDM']},
  {code:'REINWAY', name:'REINWAY CORP.', aliases:[]}
];

function normalizeSiteKeyV2_(value) {
  return String(value || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function siteDirectoryV2_(value) {
  var key = normalizeSiteKeyV2_(value);
  if (!key) return null;
  for (var i = 0; i < SITE_DIRECTORY_V2.length; i++) {
    var item = SITE_DIRECTORY_V2[i];
    if (normalizeSiteKeyV2_(item.name) === key || normalizeSiteKeyV2_(item.code) === key) return item;
    for (var j = 0; j < item.aliases.length; j++) {
      if (normalizeSiteKeyV2_(item.aliases[j]) === key) return item;
    }
  }
  return null;
}

function canonicalSiteNameV2_(value) {
  var raw = String(value || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  var item = siteDirectoryV2_(raw);
  return item ? item.name : raw;
}

function canonicalSiteCodeV2_(value) {
  var item = siteDirectoryV2_(value);
  return item ? item.code : '';
}

function ensureHeader_(sheet, header) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = headers.indexOf(header);
  if (idx >= 0) return idx + 1;
  sheet.getRange(1, lastCol + 1).setValue(header);
  return lastCol + 1;
}

function migrateSiteColumnV2_(sheet, columnName) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = headers.indexOf(columnName);
  if (col < 0) return 0;
  var range = sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1);
  var vals = range.getValues();
  var changed = 0;
  vals.forEach(function(r) {
    var before = String(r[0] || '').trim();
    var after = canonicalSiteNameV2_(before);
    if (after && after !== before) { r[0] = after; changed++; }
  });
  if (changed) range.setValues(vals);
  return changed;
}

function setupSiteDirectoryV2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var registry = getSitesLifecycleSheet_();
  var codeCol = ensureHeader_(registry, 'siteCode');
  var registryData = registry.getDataRange().getValues();
  var headers = registryData[0];
  var nameCol = headers.indexOf('name');
  var idCol = headers.indexOf('id');

  // Canonicalize existing registry rows and attach stable codes.
  for (var r = 1; r < registryData.length; r++) {
    var currentName = String(registryData[r][nameCol] || '').trim();
    if (!currentName) continue;
    var canonical = canonicalSiteNameV2_(currentName);
    registry.getRange(r + 1, nameCol + 1).setValue(canonical);
    var code = canonicalSiteCodeV2_(canonical);
    if (code) registry.getRange(r + 1, codeCol).setValue(code);
  }

  // Add canonical operational sites that are present in the supplied master list
  // but are missing from SiteRegistry. Carmona Cavite is intentionally not added:
  // it remains an inventory/location value, not a master operational site.
  var existing = sheetObjects_(registry);
  var existingNames = {};
  existing.forEach(function(x){ existingNames[normalizeSiteKeyV2_(x.name)] = true; });
  SITE_DIRECTORY_V2.forEach(function(item){
    var key = normalizeSiteKeyV2_(item.name);
    if (!existingNames[key]) {
      var row = ['SITE-' + Utilities.getUuid().slice(0, 8).toUpperCase(), item.name, 'Active', '', '', '', new Date()];
      while (row.length < codeCol) row.push('');
      row[codeCol - 1] = item.code;
      registry.appendRow(row);
      existingNames[key] = true;
    }
  });

  // Remove duplicate SiteRegistry rows that now resolve to the same canonical site.
  var refreshed = registry.getDataRange().getValues();
  headers = refreshed[0]; nameCol = headers.indexOf('name');
  var seen = {};
  for (var rr = refreshed.length - 1; rr >= 1; rr--) {
    var nm = canonicalSiteNameV2_(refreshed[rr][nameCol]);
    var ky = normalizeSiteKeyV2_(nm);
    if (seen[ky]) registry.deleteRow(rr + 1);
    else seen[ky] = true;
  }

  // Canonicalize legacy Sites and remove duplicates.
  var legacy = ss.getSheetByName('Sites');
  if (legacy && legacy.getLastRow()) {
    var lvals = legacy.getRange(1,1,legacy.getLastRow(),1).getValues();
    var keep = [], lseen = {};
    lvals.forEach(function(row){
      var name = canonicalSiteNameV2_(row[0]);
      var key = normalizeSiteKeyV2_(name);
      if (key && !lseen[key]) { lseen[key] = true; keep.push([name]); }
    });
    legacy.clearContents();
    if (keep.length) legacy.getRange(1,1,keep.length,1).setValues(keep);
  }

  // Normalize historical/current references without deleting operational data.
  var counts = {};
  counts.inventory = migrateSiteColumnV2_(ss.getSheetByName('Inventory'), 'site');
  counts.cabinets = migrateSiteColumnV2_(ss.getSheetByName('Cabinets'), 'site');
  counts.entries = migrateSiteColumnV2_(ss.getSheetByName('Entries'), 'site');
  counts.movementFrom = migrateSiteColumnV2_(ss.getSheetByName('CabinetMovements'), 'fromLocation');
  counts.movementTo = migrateSiteColumnV2_(ss.getSheetByName('CabinetMovements'), 'toLocation');

  // Human-readable alias map for future maintenance.
  var aliasSheet = ss.getSheetByName('SiteAliases');
  if (!aliasSheet) aliasSheet = ss.insertSheet('SiteAliases');
  aliasSheet.clearContents();
  aliasSheet.getRange(1,1,1,3).setValues([['alias','siteCode','officialSiteName']]);
  var aliasRows = [];
  SITE_DIRECTORY_V2.forEach(function(item){
    aliasRows.push([item.name,item.code,item.name]);
    aliasRows.push([item.code,item.code,item.name]);
    item.aliases.forEach(function(alias){ aliasRows.push([alias,item.code,item.name]); });
  });
  if (aliasRows.length) aliasSheet.getRange(2,1,aliasRows.length,3).setValues(aliasRows);
  aliasSheet.setFrozenRows(1);

  return {status:'ok', migrated:counts, canonicalSites:SITE_DIRECTORY_V2.length};
}

function getSitesLifecycleSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('SiteRegistry');
  if (!sh) {
    sh = ss.insertSheet('SiteRegistry');
    sh.appendRow(['id','name','status','openedDate','closedDate','remarks','updatedAt','siteCode']);
    sh.setFrozenRows(1);
  } else {
    ensureHeader_(sh, 'siteCode');
  }
  return sh;
}

function setupSiteLifecycle() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getSitesLifecycleSheet_();
  if (sh.getLastRow() > 1) return;

  var legacy = ss.getSheetByName('Sites');
  if (!legacy) return;

  var names = legacy.getDataRange().getValues()
    .map(function(r){ return String(r[0] || '').trim(); })
    .filter(function(v){ return v !== ''; });

  var seen = {};
  var rows = [];
  names.forEach(function(name){
    var key = name.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    name = canonicalSiteNameV2_(name);
    rows.push([
      'SITE-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      name, 'Active', '', '', '', new Date(), canonicalSiteCodeV2_(name)
    ]);
  });

  if (rows.length) sh.getRange(2,1,rows.length,8).setValues(rows);
}

function getInventorySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Inventory');
  if (!sh) {
    sh = ss.insertSheet('Inventory');
    sh.appendRow(['id', 'site', 'quantity', 'deploymentStatus', 'operationalStatus', 'remarks', 'updatedAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function upsertInventoryRow_(sheet, id, row) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}

function setupInventorySheet() {
  var sh = getInventorySheet_();
  if (sh.getLastRow() > 1) return;
  var now = new Date();
  var seed = [
    ['INV-001', 'Big A Gaming Corp. Quezon City', 8, 'Deployed', 'Non-Operational', '', now],
    ['INV-002', 'Radiant Bay Games and Entertainment Corporation - Lipa', 5, 'Deployed', 'Operational', '', now],
    ['INV-003', 'Radiant Bay Games and Entertainment Corporation - Angono', 4, 'Deployed', 'Operational', '', now],
    ['INV-004', 'TREGS Electronic Gaming Station Inc. - Sta Cruz', 5, 'Deployed', 'Operational', '', now],
    ['INV-005', 'TREGS Electronic Gaming Station Inc. - Turbina', 4, 'Deployed', 'Operational', '', now],
    ['INV-006', 'TREGS Electronic Gaming Station Inc. - Calamba (Lamesa Bypass)', 4, 'Deployed', 'Operational', '', now],
    ['INV-007', 'Triple 8 Entertainment Company Inc. - Venezia Marikina', 9, 'Deployed', 'Operational', '', now],
    ['INV-008', 'Bingo Republic - Caloocan', 20, 'Deployed', 'Operational', '', now],
    ['INV-009', 'Bingo Republic - Naga', 12, 'Deployed', 'Operational', '', now],
    ['INV-010', 'Bingo Republic - Antique', 8, 'Deployed', 'Operational', '', now],
    ['INV-011', 'SHL Amusement & Gaming Inc. - Angeles Pampanga', 5, 'Deployed', 'Operational', '', now],
    ['INV-012', 'Lucky U Inc Tarlac', 6, 'Deployed', 'Operational', '', now],
    ['INV-013', 'Triple 8 Entertainment Company Inc. - Venezia SJDM', 7, 'Deployed', 'Operational', '', now],
    ['INV-014', 'Pinoy Games Gaming & Amusement Corp', 5, 'Deployed', 'Operational', '', now],
    ['INV-015', 'Ready to Deploy', 4, 'Ready to Deploy', 'Ready', '', now],
    ['INV-016', 'Other / To classify', 5, 'Other', 'For Assessment', 'Remaining balance from the current total of 111. Update the actual location/status when known.', now]
  ];
  sh.getRange(2, 1, seed.length, 7).setValues(seed);
}

function normalizePermanentCabinetNumber_(value) {
  var digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  var n = Number(digits);
  if (!n || n < 1) return '';
  return String(n).padStart(3, '0');
}

function ensureCabinetPermanentNumbers_(sheet) {
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0]
    .map(function(v){ return String(v || '').trim(); });
  var col = headers.indexOf('permanentNumber') + 1;

  if (!col) {
    col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue('permanentNumber');
  }

  if (sheet.getLastRow() < 2) return col;

  var count = sheet.getLastRow() - 1;
  var raw = sheet.getRange(2, col, count, 1).getDisplayValues();
  var used = {};
  var normalized = [];
  var maxAssigned = 0;

  for (var i = 0; i < count; i++) {
    var n = normalizePermanentCabinetNumber_(raw[i][0]);
    if (n && !used[n]) {
      used[n] = true;
      normalized[i] = n;
      maxAssigned = Math.max(maxAssigned, Number(n));
    } else {
      normalized[i] = '';
    }
  }

  var next = 1;
  for (var j = 0; j < count; j++) {
    if (normalized[j]) continue;
    while (used[String(next).padStart(3, '0')]) next++;
    var assigned = String(next).padStart(3, '0');
    normalized[j] = assigned;
    used[assigned] = true;
    maxAssigned = Math.max(maxAssigned, next);
    next++;
  }

  sheet.getRange(2, col, count, 1).setNumberFormat('@').setValues(
    normalized.map(function(v){ return [v]; })
  );

  var props = PropertiesService.getScriptProperties();
  var currentCounter = Number(props.getProperty('CABINET_PERMANENT_COUNTER') || 0);
  if (maxAssigned > currentCounter) {
    props.setProperty('CABINET_PERMANENT_COUNTER', String(maxAssigned));
  }
  return col;
}

function nextPermanentCabinetNumber_(sheet) {
  var col = ensureCabinetPermanentNumbers_(sheet);
  var props = PropertiesService.getScriptProperties();
  var counter = Number(props.getProperty('CABINET_PERMANENT_COUNTER') || 0);

  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getDisplayValues();
    values.forEach(function(r){
      var n = Number(normalizePermanentCabinetNumber_(r[0]) || 0);
      if (n > counter) counter = n;
    });
  }

  counter++;
  props.setProperty('CABINET_PERMANENT_COUNTER', String(counter));
  return String(counter).padStart(3, '0');
}

function getCabinetsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Cabinets');
  var headers = ['id','cabinetId','site','label','status','token','teamviewerId','mpuSerial','cabinetSerial','bvModel','bvSerial','printerModel','printerSerial','networkNote','remarks','updatedAt','permanentNumber'];
  if (!sh) {
    sh = ss.insertSheet('Cabinets');
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  ensureCabinetPermanentNumbers_(sh);
  return sh;
}

function setupCabinetsSheet() {
  getCabinetsSheet_();
}

function ensureUniqueCabinetId_(sheet, cabinetId, currentRowId) {
  if (sheet.getLastRow() < 2) return;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  var wanted = String(cabinetId).trim().toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    var rowId = String(rows[i][0]);
    var existingCabinetId = String(rows[i][1]).trim().toLowerCase();
    if (existingCabinetId === wanted && rowId !== String(currentRowId)) {
      throw new Error('Cabinet ID already exists.');
    }
  }
}

function ensureUniqueCabinetKey_(sheet, columnNumber, value, currentRowId, label) {
  var wanted = String(value || '').trim().toLowerCase();
  if (!wanted || sheet.getLastRow() < 2) return;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  var vals = sheet.getRange(2, columnNumber, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(ids[i][0]) !== String(currentRowId) && String(vals[i][0] || '').trim().toLowerCase() === wanted) {
      throw new Error(label + ' already exists on another cabinet.');
    }
  }
}

function upsertCabinetRow_(sheet, id, row) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}




function getAuditTrailSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('AuditTrail');
  var headers = [
    'id','timestamp','actorUsername','actorName','actorRole',
    'action','entityType','entityId','label','details','beforeJson','afterJson'
  ];
  if (!sh) {
    sh = ss.insertSheet('AuditTrail');
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function auditSanitize_(value) {
  if (value === undefined || value === null) return value;
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  if (Array.isArray(value)) return value.map(auditSanitize_);
  if (typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function(key){
      if (key === '__row') return;
      if (/password|hash|salt|secret|token/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = auditSanitize_(value[key]);
      }
    });
    return out;
  }
  return value;
}

function auditJson_(value) {
  if (value === undefined || value === null || value === '') return '';
  try {
    return JSON.stringify(auditSanitize_(value));
  } catch (e) {
    return String(value);
  }
}

function appendAudit_(actor, action, entityType, entityId, label, beforeValue, afterValue, details) {
  try {
    actor = actor || {};
    if(entityType === 'Field Log' && beforeValue && afterValue){
      var assignmentChanges=[];
      ['tech','supportingFses'].forEach(function(field){
        var before=String(beforeValue[field]||'').trim();
        var after=String(afterValue[field]||'').trim();
        if(before!==after) assignmentChanges.push((field==='tech'?'Primary FSE':'Supporting FSEs')+': '+(before||'None')+' → '+(after||'None'));
      });
      if(assignmentChanges.length) details=String(details||'Visit edited')+' · Reassigned · '+assignmentChanges.join('; ');
    }
    getAuditTrailSheet_().appendRow([
      'AUD-' + Utilities.getUuid().slice(0, 10).toUpperCase(),
      new Date(),
      String(actor.username || '').trim(),
      String(actor.name || actor.displayName || actor.username || '').trim(),
      String(actor.role || '').trim(),
      String(action || '').trim().toUpperCase(),
      String(entityType || '').trim(),
      String(entityId || '').trim(),
      String(label || '').trim(),
      String(details || '').trim(),
      auditJson_(beforeValue),
      auditJson_(afterValue)
    ]);
  } catch (auditErr) {
    console.error('Audit logging failed: ' + auditErr.message);
  }
}

function sheetObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).filter(function(r){return r[0] !== '';}).map(function(r){
    var o={}; headers.forEach(function(h,i){o[h]=r[i];}); return o;
  });
}

function upsertRowById_(sheet, id, row) {
  var last = sheet.getLastRow();
  if (last >= 2) {
    var ids = sheet.getRange(2,1,last-1,1).getValues();
    for (var i=0;i<ids.length;i++) {
      if (String(ids[i][0]) === String(id)) {
        sheet.getRange(i+2,1,1,row.length).setValues([row]);
        return;
      }
    }
  }
  sheet.appendRow(row);
}

function getRowObjectById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var headers=data[0];
  for (var i=1;i<data.length;i++) {
    if (String(data[i][0])===String(id)) {
      var o={}; headers.forEach(function(h,j){o[h]=data[i][j];}); o.__row=i+1; return o;
    }
  }
  return null;
}

function getAgendaSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Agenda');
  var headers = ['id','week','text','owner','createdAt','updatedAt'];

  if (!sh) {
    sh = ss.insertSheet('Agenda');
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    return sh;
  }

  // Keep existing Agenda data, but make sure the expected columns exist.
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var currentHeaders = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(v){ return String(v || '').trim(); });

  headers.forEach(function(header){
    if (currentHeaders.indexOf(header) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(header);
      currentHeaders.push(header);
    }
  });

  sh.setFrozenRows(1);
  return sh;
}

function getSparePartsSheet_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('SpareParts');
  var headers=['id','partName','category','brandModel','serialNo','quantity','minStock','location','status','remarks','updatedAt'];
  if(!sh){sh=ss.insertSheet('SpareParts');sh.appendRow(headers);sh.setFrozenRows(1);} else if(sh.getLastRow()===0){sh.appendRow(headers);sh.setFrozenRows(1);}
  return sh;
}
function setupSparePartsSheet(){getSparePartsSheet_();}

function getCabinetPartsSheet_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('CabinetParts');
  var headers=['id','cabinetRowId','cabinetId','partId','partName','category','brandModel','serialNo','quantity','actionType','previousPart','visitId','usedDate','usedBy','remarks','createdAt'];
  if(!sh){sh=ss.insertSheet('CabinetParts');sh.appendRow(headers);sh.setFrozenRows(1);} else if(sh.getLastRow()===0){sh.appendRow(headers);sh.setFrozenRows(1);}
  return sh;
}
function setupCabinetPartsSheet(){getCabinetPartsSheet_();}


function getRemovedPartsSheet_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('RemovedParts');
  var headers=[
    'id','sourceUsageId','cabinetRowId','cabinetId','partName','category','brandModel','serialNo',
    'removedDate','removedBy','disposition','status','repairVendor','repairDate','repairNotes',
    'stockPartId','returnedDate','returnedBy','location','remarks','updatedAt'
  ];
  if(!sh){
    sh=ss.insertSheet('RemovedParts');
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if(sh.getLastRow()===0){
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}
function setupRemovedPartsSheet(){getRemovedPartsSheet_();}

function findRowObjectByValue_(sheet, headerName, value) {
  var data=sheet.getDataRange().getValues();
  if(data.length<2)return null;
  var headers=data[0];
  var col=headers.indexOf(headerName);
  if(col<0)return null;
  for(var i=1;i<data.length;i++){
    if(String(data[i][col]||'').trim().toLowerCase()===String(value||'').trim().toLowerCase()){
      var o={};headers.forEach(function(h,j){o[h]=data[i][j];});o.__row=i+1;return o;
    }
  }
  return null;
}

function getCabinetMovementsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('CabinetMovements');
  var headers = [
    'id',
    'cabinetRowId',
    'cabinetId',
    'movementDate',
    'movementType',
    'fromLocation',
    'toLocation',
    'statusBefore',
    'statusAfter',
    'handledBy',
    'referenceNo',
    'remarks',
    'createdAt',
    'allocationBefore',
    'allocationAfter'
  ];

  if (!sh) {
    sh = ss.insertSheet('CabinetMovements');
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else {
    headers.forEach(function(header){ ensureHeader_(sh, header); });
  }

  return sh;
}

function setupCabinetMovementsSheet() {
  getCabinetMovementsSheet_();
}

function getCabinetByRowId_(sheet, rowId) {
  if (sheet.getLastRow() < 2) return null;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(rowId)) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = rows[i][j];
      }
      obj.__row = i + 2;
      return obj;
    }
  }

  return null;
}

function updateCabinetLocationStatus_(sheet, rowId, site, status) {
  var cabinet = getCabinetByRowId_(sheet, rowId);
  if (!cabinet) {
    throw new Error('Cabinet profile was not found.');
  }
  sheet.getRange(cabinet.__row, 3).setValue(site);
  sheet.getRange(cabinet.__row, 5).setValue(status);
  sheet.getRange(cabinet.__row, 16).setValue(new Date());
}

function updateCabinetAllocationLocationStatus_(sheet, rowId, cabinetId, site, status) {
  var cabinet = getCabinetByRowId_(sheet, rowId);
  if (!cabinet) throw new Error('Cabinet profile was not found.');
  // Permanent identity stays in column 1 (CAB-...). Only current allocation changes.
  sheet.getRange(cabinet.__row, 2).setValue(cabinetId);
  sheet.getRange(cabinet.__row, 3).setValue(site);
  sheet.getRange(cabinet.__row, 5).setValue(status);
  sheet.getRange(cabinet.__row, 16).setValue(new Date());
}

function isWarehouseLocationV2_(value) {
  var key = normalizeSiteKeyV2_(value);
  return key.indexOf('carmona') >= 0 || key.indexOf('warehouse') >= 0 || key === 'stock' || key.indexOf('warehouse stock') >= 0;
}

function cabinetAllocationPrefix_(cabinetId) {
  var id = String(cabinetId || '').trim();
  if (!id) return '';
  return id.replace(/[\s_-]*\d+\s*$/, '').trim() || id;
}

function allocationPrefixForSiteV2_(sheet, site) {
  if (isWarehouseLocationV2_(site)) return 'STOCK';
  var target = normalizeSiteKeyV2_(canonicalSiteNameV2_(site));
  var rows = sheetObjects_(sheet);
  var counts = {};
  rows.forEach(function(row){
    if (normalizeSiteKeyV2_(canonicalSiteNameV2_(row.site)) !== target) return;
    var id = String(row.cabinetId || '').trim();
    if (!id || /^STOCK\s*0*\d+$/i.test(id)) return;
    var prefix = cabinetAllocationPrefix_(id);
    if (prefix) counts[prefix] = (counts[prefix] || 0) + 1;
  });
  var prefixes = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a] || a.localeCompare(b); });
  if (prefixes.length) return prefixes[0];
  return String(canonicalSiteCodeV2_(site) || '').trim().toUpperCase();
}

function allocationIdForPermanentNumber_(prefix, permanentNumber) {
  prefix = String(prefix || '').trim();
  permanentNumber = normalizePermanentCabinetNumber_(permanentNumber);
  if (!prefix || !permanentNumber) return '';
  return prefix + permanentNumber;
}

function allocationKeepsPermanentNumber_(allocationId, permanentNumber) {
  permanentNumber = normalizePermanentCabinetNumber_(permanentNumber);
  if (!permanentNumber) return false;
  var match = String(allocationId || '').trim().match(/(\d+)\s*$/);
  return !!match && normalizePermanentCabinetNumber_(match[1]) === permanentNumber;
}



function setupEnhancedEntryCategories() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Entries');
  if (!sh) throw new Error('Entries sheet was not found.');

  var lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error('Entries sheet has no headers.');

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('issueType') === -1) {
    sh.getRange(1, lastCol + 1).setValue('issueType');
  }

  return 'Enhanced categories are ready.';
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


function ensureEntriesSupportingFsesColumn_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Entries');
  if (!sheet) throw new Error('Entries sheet not found.');
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('supportingFses') === -1) {
    sheet.getRange(1, lastCol + 1).setValue('supportingFses');
  }
}


// Exact assignment matching after Unicode/case/whitespace normalization.
// Never falls back to username or grants access to all visits.
// Field Logs are shared for reading, but Primary FSE ownership is enforced
// server-side for all edits. Supporting engineers can review and discuss.
function requireFseFieldLogWrite_(user) {
  if (!user || user.role !== 'fse') {
    throw new Error('Only an authenticated Field Support Engineer may modify Field Logs.');
  }
}
function requirePrimaryFseFieldLogOwner_(user, entry) {
  requireFseFieldLogWrite_(user);
  var own = fseNameKey_(user.fse || user.username);
  var primary = fseNameKey_(entry && (entry.tech || entry.technician || entry.Technician || entry.fse || entry.FSE));
  if (!own || !primary || own !== primary) {
    throw new Error('This Field Log belongs to another FSE. You may view it but cannot change it.');
  }
}
function fseNameKey_(value){return String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();}
function fseOwnsVisit_(user,row){
 var assigned=fseNameKey_(user.fse||user.displayName||user.username);if(!assigned)return false;
 var technician=row.tech||row.technician||row.Technician||row.fse||row.FSE||row.assignedTechnician||'';
 if(fseNameKey_(technician)===assigned)return true;
 var source=row.supportingFses||row.supportingFSEs||row.withFses||row.supporting||'';
 var names=Array.isArray(source)?source:String(source).split(/[,;\n]+/);
 return names.some(function(name){return fseNameKey_(name)===assigned;});
}
