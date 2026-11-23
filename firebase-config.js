/**
 * =====================================================
 *  ROOMIE – Firebase Config
 * =====================================================
 * 1. Tạo project tại https://console.firebase.google.com
 * 2. Bật Realtime Database (Start in test mode)
 * 3. Project settings → Your apps → Web → copy config
 * 4. Dán vào bên dưới (thay toàn bộ object firebaseConfig)
 * 5. Rules nên để:
 *    {
 *      "rules": {
 *        ".read": true,
 *        ".write": true
 *      }
 *    }
 *    (Chỉ dùng cho DEMO)
 * =====================================================
 */

window.ROOMIE_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Đường dẫn dữ liệu dùng chung (mọi người vào đều thấy)
window.ROOMIE_DB_PATH = "roomie/cozy-house";
