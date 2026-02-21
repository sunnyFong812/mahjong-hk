// 自動偵測服務器地址
const SERVER_URL = (() => {
  // 如果係本地開發
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  
  // 如果係 Netlify 或其他平台，用 Render 嘅網址
  return 'https://mahjong-hk.onrender.com'; // 記住改做你嘅 Render 網址
})();

console.log('🔄 連接服務器:', SERVER_URL);

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
});

// 連接事件
socket.on('connect', () => {
  console.log('✅ 已連接到伺服器');
  updateConnectionStatus('connected', '已連接');
});

socket.on('connect_error', (error) => {
  console.error('❌ 連接錯誤:', error);
  updateConnectionStatus('error', '連接失敗');
});

socket.on('connected', (data) => {
  console.log('📦 伺服器確認:', data);
});

// 更新連接狀態顯示
function updateConnectionStatus(status, message) {
  const el = document.getElementById('connection-status');
  if (el) {
    el.className = `connection-status status-${status}`;
    el.textContent = `🔌 ${message}`;
  }
}

// 其他原有嘅 socket 事件處理...