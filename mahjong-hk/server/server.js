const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 設定 CORS - 移除無效嘅網址
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://mahjong-hk.onrender.com'
    // 暫時唔加 Netlify 網址，等之後再加
  ],
  credentials: true
}));

// 提供靜態檔案
app.use(express.static(path.join(__dirname, '../client')));

// 健康檢查（Render 需要）
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 測試路由
app.get('/api/test', (req, res) => {
  res.json({ message: '伺服器正常運作' });
});

const io = new Server(server, {
  cors: {
    origin: "*",  // 開發階段用 *，之後再收緊
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// 房間管理
const rooms = {};

io.on('connection', (socket) => {
  console.log('✅ 新連線:', socket.id, 'IP:', socket.handshake.address);
  
  // 發送確認
  socket.emit('connected', { 
    id: socket.id, 
    message: '成功連接到伺服器' 
  });
  
  socket.on('joinRoom', (data) => {
    try {
      const { roomId, playerName } = data;
      console.log(`👤 ${playerName} 嘗試加入房間 ${roomId}`);
      
      if (!rooms[roomId]) {
        rooms[roomId] = {
          players: [],
          gameState: 'waiting',
          created: Date.now()
        };
      }
      
      const room = rooms[roomId];
      
      // 檢查房間是否已滿
      if (room.players.length >= 4) {
        socket.emit('roomError', '房間已滿');
        return;
      }
      
      // 檢查名字是否重複
      if (room.players.some(p => p.name === playerName)) {
        socket.emit('roomError', '名字已被使用');
        return;
      }
      
      const player = {
        id: socket.id,
        name: playerName,
        position: room.players.length,
        ready: false
      };
      
      room.players.push(player);
      socket.join(roomId);
      
      // 通知房間內所有玩家
      io.to(roomId).emit('roomUpdate', {
        players: room.players.map(p => ({
          name: p.name,
          ready: p.ready,
          position: p.position
        })),
        gameState: room.gameState,
        roomId: roomId
      });
      
      console.log(`✅ ${playerName} 加入房間 ${roomId}，位置 ${player.position}`);
      
    } catch (error) {
      console.error('加入房間錯誤:', error);
      socket.emit('roomError', '系統錯誤');
    }
  });
  
  socket.on('playerReady', (data) => {
    const { roomId } = data;
    const room = rooms[roomId];
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.ready = !player.ready;
      
      io.to(roomId).emit('roomUpdate', {
        players: room.players.map(p => ({
          name: p.name,
          ready: p.ready,
          position: p.position
        })),
        gameState: room.gameState
      });
      
      // 檢查是否全部準備
      const readyCount = room.players.filter(p => p.ready).length;
      if (readyCount === 4 && room.gameState === 'waiting') {
        io.to(roomId).emit('gameCountdown', { seconds: 3 });
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ 斷開連線:', socket.id);
    
    // 從所有房間移除
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.id === socket.id);
      
      if (index !== -1) {
        const player = room.players[index];
        room.players.splice(index, 1);
        
        io.to(roomId).emit('roomUpdate', {
          players: room.players.map(p => ({
            name: p.name,
            ready: p.ready,
            position: p.position
          })),
          gameState: room.gameState
        });
        
        console.log(`👋 ${player.name} 離開房間 ${roomId}`);
        
        // 如果房間冇人，刪除房間（15分鐘後）
        if (room.players.length === 0) {
          setTimeout(() => {
            if (rooms[roomId] && rooms[roomId].players.length === 0) {
              delete rooms[roomId];
              console.log(`🗑️ 刪除空房間 ${roomId}`);
            }
          }, 15 * 60 * 1000);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== 🀄️ 港式麻雀伺服器 ===');
  console.log(`📱 本地: http://localhost:${PORT}`);
  console.log(`🌐 Render: https://mahjong-hk.onrender.com`);
  console.log(`🔍 健康檢查: /health`);
  console.log('========================\n');
});
