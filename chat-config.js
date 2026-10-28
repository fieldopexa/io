// Firebase Web SDK configuration from Firebase Console > Project settings > Your apps.
// This is public web-app configuration, not a Firebase Admin service-account key.
// Firestore access is restricted by the published firestore.rules file.
window.FSM_CHAT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBckNf_qQUMCRXP9qw9YboUWwmsgmAyDxs",
  authDomain: "opexa-fsm-chat.firebaseapp.com",
  projectId: "opexa-fsm-chat",
  storageBucket: "opexa-fsm-chat.firebasestorage.app",
  messagingSenderId: "559812878681",
  appId: "1:559812878681:web:90aa39609c026216f76c48"
};

// Optional: public Web Push (VAPID) key from Firebase Console > Project Settings > Cloud Messaging.
// Leave blank until the administrator enables background push. This is NOT the private service-account key.
window.FSM_CHAT_WEB_PUSH_VAPID_KEY = '';
