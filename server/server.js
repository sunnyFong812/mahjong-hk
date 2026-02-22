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

app.get('/api/test', (req, res) => {
  res.json({ message: '伺服器正常運作' });
});

// 房間管理
const rooms = {};

// AI 玩家名稱列表
const AI_NAMES = [
  '🤖 AI 東', '🤖 AI 南', '🤖 AI 西', '🤖 AI 北',
  '🀄️ 麻雀精', '🎲 牌聖', '🧠 深藍', '⚡ 快打'
];

// 建立 AI 玩家
function createAIPlayer(roomId, position) {
  return {
    id: `ai_${roomId}_${position}_${Date.now()}`,
    name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)],
    position: position,
    isAI: true,
    ready: true,  // AI 自動準備
    aiLevel: Math.floor(Math.random() * 3) + 1 // 1-3 級難度
  };
}

// AI 決策邏輯
function aiMakeDecision(room, aiPlayer) {
  // 根據 AI 等級決定思考時間
  const thinkTime = aiPlayer.aiLevel === 1 ? 1000 : // 簡單：1秒
                    aiPlayer.aiLevel === 2 ? 2000 : // 中等：2秒
                    3000; // 困難：3秒
  
  setTimeout(() => {
    const game = room.game;
    if (!game) return;
    
    // 隨機決定動作（簡化版）
    const actions = ['DISCARD'];
    const hand = game.hands[aiPlayer.position];
    
    if (hand && hand.length > 0) {
      // 隨機打出一張牌
      const randomIndex = Math.floor(Math.random() * hand.length);
      const tileToDiscard = hand[randomIndex];
      
      // 透過 socket 觸發 AI 動作
      io.to(room.id).emit('aiAction', {
        player: aiPlayer.position,
        action: 'DISCARD',
        tile: tileToDiscard
      });
      
      // 實際執行動作
      const result = game.processAction(aiPlayer.position, 'DISCARD', tileToDiscard);
      if (result) {
        io.to(room.id).emit('gameUpdate', result);
      }
    }
  }, thinkTime);
}

io.on('connection', (socket) => {
  console.log('✅ 新連線:', socket.id);
  
  socket.on('joinRoom', (data) => {
    try {
      const { roomId, playerName } = data;
      
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: [],
          gameState: 'waiting',
          created: Date.now(),
          game: null,
          aiPlayers: []
        };
      }
      
      const room = rooms[roomId];
      
      // 檢查房間是否已滿
      if (room.players.length >= 4) {
        socket.emit('roomError', '房間已滿');
        return;
      }
      
      // 檢查名字是否重複
      if (room.players.some(p => !p.isAI && p.name === playerName)) {
        socket.emit('roomError', '名字已被使用');
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
      
      // 通知房間內所有玩家
      io.to(roomId).emit('roomUpdate', {
        players: room.players.map(p => ({
          name: p.name,
          ready: p.ready,
          position: p.position,
          isAI: p.isAI || false
        })),
        gameState: room.gameState,
        roomId: roomId,
        playerCount: room.players.length
      });
      
      console.log(`👤 ${playerName} 加入房間 ${roomId}，位置 ${player.position}`);
      
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
      
      // 檢查是否需要補 AI
      checkAndAddAIPlayers(room);
    }
  });
  
  // 開始遊戲
  socket.on('startGame', (data) => {
    const { roomId } = data;
    const room = rooms[roomId];
    if (!room) return;
    
    startGame(room);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ 斷開連線:', socket.id);
    
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
        
        console.log(`👋 ${player.name} 離開房間 ${roomId}`);
        
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
  
  // AI 動作監聽
  socket.on('aiAction', (data) => {
    const { roomId, playerPosition, action, tile } = data;
    const room = rooms[roomId];
    if (!room || !room.game) return;
    
    const result = room.game.processAction(playerPosition, action, tile);
    if (result) {
      io.to(roomId).emit('gameUpdate', result);
      
      // 如果遊戲繼續，下一個 AI 玩家決定動作
      if (!result.gameOver && room.game.currentPlayer !== undefined) {
        const nextPlayer = room.players.find(p => p.position === room.game.currentPlayer);
        if (nextPlayer && nextPlayer.isAI) {
          aiMakeDecision(room, nextPlayer);
        }
      }
    }
  });
});

// 檢查並補充 AI 玩家
function checkAndAddAIPlayers(room) {
  const humanPlayers = room.players.filter(p => !p.isAI);
  const readyHumans = humanPlayers.filter(p => p.ready);
  
  // 如果所有真人玩家都準備了，補齊 AI
  if (humanPlayers.length > 0 && readyHumans.length === humanPlayers.length) {
    const currentCount = room.players.length;
    
    // 補到4人
    for (let i = currentCount; i < 4; i++) {
      const aiPlayer = createAIPlayer(room.id, i);
      room.players.push(aiPlayer);
      console.log(`🤖 AI 加入房間 ${room.id}，位置 ${i}`);
    }
    
    // 通知所有玩家 AI 加入
    io.to(room.id).emit('roomUpdate', {
      players: room.players.map(p => ({
        name: p.name,
        ready: p.ready,
        position: p.position,
        isAI: p.isAI || false
      })),
      gameState: room.gameState,
      roomId: room.id,
      hasAI: true
    });
    
    // 自動開始遊戲
    setTimeout(() => {
      startGame(room);
    }, 2000);
  }
}

// 開始遊戲
function startGame(room) {
  console.log(`🎮 房間 ${room.id} 遊戲開始，有 ${room.players.filter(p => p.isAI).length} 個 AI`);
  
  const MahjongGame = require('./game-engine/mahjong-game');
  room.game = new MahjongGame(room.players);
  room.gameState = 'playing';
  
  const initialData = room.game.start();
  
  // 通知所有玩家
  room.players.forEach(player => {
    if (player.isAI) {
      // AI 唔需要手牌資料，但記錄佢存在
      console.log(`🤖 AI ${player.name} 開始遊戲`);
    } else {
      io.to(player.id).emit('gameStart', {
        position: player.position,
        hand: initialData.hands[player.position],
        wind: initialData.winds[player.position],
        scores: initialData.scores,
        currentPlayer: initialData.currentPlayer,
        discards: initialData.discards,
        hasAI: true
      });
    }
  });
  
  io.to(room.id).emit('publicGameState', {
    discards: initialData.discards,
    currentPlayer: initialData.currentPlayer,
    wallSize: initialData.wallSize,
    hasAI: true
  });
  
  // 如果第一個玩家係 AI，觸發 AI 決策
  const firstPlayer = room.players.find(p => p.position === initialData.currentPlayer);
  if (firstPlayer && firstPlayer.isAI) {
    aiMakeDecision(room, firstPlayer);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== 🀄️ 港式麻雀伺服器 (AI 版) ===');
  console.log(`📱 本地: http://localhost:${PORT}`);
  console.log(`🌐 Render: https://mahjong-hk.onrender.com`);
  console.log('🤖 AI 功能已啟用 - 人數不足自動補 AI');
  console.log('================================\n');
});