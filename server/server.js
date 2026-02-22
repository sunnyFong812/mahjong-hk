const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket']
});

// 提供靜態檔案
app.use(express.static(path.join(__dirname, '../client')));

// 健康檢查
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 房間管理
const rooms = {};

// AI 玩家名稱
const AI_NAMES = ['🤖 阿強', '🤖 阿倫', '🤖 阿東', '🤖 阿北'];

// 建立 AI 玩家
function createAIPlayer(roomId, position) {
  return {
    id: `ai_${roomId}_${position}_${Date.now()}`,
    name: AI_NAMES[position % AI_NAMES.length],
    position: position,
    isAI: true,
    ready: true
  };
}

// 建立牌牆
function createWall() {
  const wall = [];
  const suits = ['m', 'p', 's'];
  const honors = ['東', '南', '西', '北', '中', '發', '白'];
  
  // 萬筒條 1-9 x4
  for (const suit of suits) {
    for (let num = 1; num <= 9; num++) {
      for (let i = 0; i < 4; i++) {
        wall.push(`${num}${suit}`);
      }
    }
  }
  
  // 字牌 x4
  for (const honor of honors) {
    for (let i = 0; i < 4; i++) {
      wall.push(honor);
    }
  }
  
  // 洗牌
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  
  return wall;
}

// 開始遊戲
function startGame(room) {
  console.log(`🎮 房間 ${room.id} 遊戲開始`);
  
  const wall = createWall();
  const hands = {};
  const discards = { 0: [], 1: [], 2: [], 3: [] };
  
  // 發牌：莊家(0) 17張，閒家16張
  for (let i = 0; i < 4; i++) {
    hands[i] = [];
    const tileCount = i === 0 ? 17 : 16;
    for (let j = 0; j < tileCount; j++) {
      hands[i].push(wall.pop());
    }
    // 排序手牌
    hands[i].sort((a, b) => a.localeCompare(b));
  }
  
  room.gameState = {
    hands: hands,
    discards: discards,
    wall: wall,
    currentPlayer: 0, // 莊家先
    winds: ['東', '南', '西', '北']
  };
  
  // 通知所有真人玩家
  room.players.forEach(player => {
    if (!player.isAI) {
      console.log(`📤 發送 gameStart 給 ${player.name}`);
      io.to(player.id).emit('gameStart', {
        position: player.position,
        hand: hands[player.position],
        wind: room.gameState.winds[player.position],
        currentPlayer: 0,
        discards: discards,
        wallSize: wall.length
      });
    } else {
      console.log(`🤖 AI ${player.name} 開始遊戲`);
    }
  });
  
  // 廣播公共狀態
  io.to(room.id).emit('publicGameState', {
    discards: discards,
    currentPlayer: 0,
    wallSize: wall.length
  });
}

// 檢查並補充 AI
function checkAndAddAIPlayers(room) {
  const humanPlayers = room.players.filter(p => !p.isAI);
  const readyHumans = humanPlayers.filter(p => p.ready);
  
  if (humanPlayers.length > 0 && readyHumans.length === humanPlayers.length) {
    // 補 AI 到 4 人
    for (let i = room.players.length; i < 4; i++) {
      const aiPlayer = createAIPlayer(room.id, i);
      room.players.push(aiPlayer);
      console.log(`🤖 AI 加入房間 ${room.id}，位置 ${i}`);
    }
    
    // 通知更新
    io.to(room.id).emit('roomUpdate', {
      players: room.players.map(p => ({
        name: p.name,
        ready: p.ready,
        position: p.position,
        isAI: p.isAI || false
      })),
      gameState: 'playing',
      roomId: room.id
    });
    
    // 開始遊戲
    setTimeout(() => startGame(room), 1000);
  }
}

// ===== Socket 連接 =====
io.on('connection', (socket) => {
  console.log('✅ 新連線:', socket.id);
  
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        players: [],
        gameState: 'waiting'
      };
    }
    
    const room = rooms[roomId];
    
    if (room.players.length >= 4) {
      socket.emit('roomError', '房間已滿');
      return;
    }
    
    const player = {
      id: socket.id,
      name: playerName,
      position: room.players.length,
      ready: false,
      isAI: false
    };
    
    room.players.push(player);
    socket.join(roomId);
    
    io.to(roomId).emit('roomUpdate', {
      players: room.players.map(p => ({
        name: p.name,
        ready: p.ready,
        position: p.position,
        isAI: p.isAI || false
      })),
      gameState: room.gameState,
      roomId: roomId
    });
    
    console.log(`👤 ${playerName} 加入房間 ${roomId}，位置 ${player.position}`);
  });
  
  socket.on('playerReady', (data) => {
    const { roomId } = data;
    const room = rooms[roomId];
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player && !player.isAI) {
      player.ready = !player.ready;
      
      io.to(roomId).emit('roomUpdate', {
        players: room.players.map(p => ({
          name: p.name,
          ready: p.ready,
          position: p.position,
          isAI: p.isAI || false
        })),
        gameState: room.gameState
      });
      
      checkAndAddAIPlayers(room);
    }
  });
  
  socket.on('playerAction', (data) => {
    const { roomId, action, tile } = data;
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    
    if (action === 'DISCARD') {
      // 從手牌移除
      const hand = room.gameState.hands[player.position];
      const index = hand.indexOf(tile);
      if (index !== -1) {
        hand.splice(index, 1);
        
        // 加入棄牌區
        room.gameState.discards[player.position].push(tile);
        
        // 輪到下家
        room.gameState.currentPlayer = (player.position + 1) % 4;
        
        // 下家摸牌（如果是真人）
        const nextPlayer = room.players.find(p => p.position === room.gameState.currentPlayer);
        if (nextPlayer && !nextPlayer.isAI) {
          const drawnTile = room.gameState.wall.pop();
          room.gameState.hands[nextPlayer.position].push(drawnTile);
          room.gameState.hands[nextPlayer.position].sort((a, b) => a.localeCompare(b));
          
          // 通知下家摸到牌
          io.to(nextPlayer.id).emit('gameUpdate', {
            type: 'DRAW',
            player: nextPlayer.position,
            hand: room.gameState.hands[nextPlayer.position],
            drawnTile: drawnTile
          });
        }
        
        // 廣播更新
        io.to(roomId).emit('gameUpdate', {
          type: 'DISCARD',
          player: player.position,
          tile: tile,
          hand: room.gameState.hands[player.position],
          discards: room.gameState.discards,
          currentPlayer: room.gameState.currentPlayer
        });
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ 斷線:', socket.id);
    
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
            position: p.position,
            isAI: p.isAI || false
          })),
          gameState: room.gameState
        });
        
        console.log(`👋 ${player.name} 離開`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== 🀄️ 港式麻雀伺服器 ===');
  console.log(`📱 本地: http://localhost:${PORT}`);
  console.log('🎮 莊家 17 張，閒家 16 張');
  console.log('========================\n');
});