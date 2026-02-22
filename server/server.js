const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const MahjongGame = require('./game-engine/mahjong-game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['polling', 'websocket']
});

app.use(express.static(path.join(__dirname, '../client')));
app.get('/health', (req, res) => res.send('OK'));

const rooms = {};
const AI_NAMES = ['🤖 阿強', '🤖 阿倫', '🤖 阿東', '🤖 阿北'];

function createAIPlayer(roomId, pos) {
  return {
    id: `ai_${roomId}_${pos}_${Date.now()}`,
    name: AI_NAMES[pos % AI_NAMES.length],
    position: pos,
    isAI: true,
    ready: true
  };
}

function aiMove(room, aiPlayer) {
  const game = room.game;
  if (!game || game.gameOver) return;
  if (game.currentPlayer !== aiPlayer.position) return;

  const hand = game.hands[aiPlayer.position];
  if (!hand || hand.length === 0) return;

  const tile = hand[Math.floor(Math.random() * hand.length)];
  console.log(`🤖 AI ${aiPlayer.name} 打出 ${tile}`);

  const result = game.processAction(aiPlayer.position, 'DISCARD', tile);
  if (result) {
    io.to(room.id).emit('gameUpdate', result);

    if (!game.gameOver && game.currentPlayer !== undefined) {
      const next = room.players.find(p => p.position === game.currentPlayer);
      if (next?.isAI) setTimeout(() => aiMove(room, next), 600);
    }
  }
}

function startGame(room) {
  console.log(`🎮 房間 ${room.id} 遊戲開始`);
  room.game = new MahjongGame(room.players);
  const init = room.game.start();

  room.players.forEach(p => {
    if (!p.isAI) {
      io.to(p.id).emit('gameStart', {
        position: p.position,
        hand: init.hands[p.position],
        wind: ['東', '南', '西', '北'][p.position],
        currentPlayer: init.currentPlayer,
        discards: init.discards,
        wallSize: init.wallSize
      });
    }
  });

  io.to(room.id).emit('publicGameState', {
    discards: init.discards,
    currentPlayer: init.currentPlayer,
    wallSize: init.wallSize
  });

  const first = room.players.find(p => p.position === 0);
  if (first?.isAI) setTimeout(() => aiMove(room, first), 800);
}

io.on('connection', (socket) => {
  console.log('✅ 連線:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = { id: roomId, players: [], game: null };
    const room = rooms[roomId];
    if (room.players.length >= 4) return socket.emit('roomError', '已滿');

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
      roomId:roomId,
      players: room.players.map(p => ({
        name: p.name, ready: p.ready, position: p.position, isAI: p.isAI
      }))
    });
    console.log(`👤 ${playerName} 加入 ${roomId}`);
  });

  socket.on('playerReady', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const p = room.players.find(p => p.id === socket.id);
    if (!p || p.isAI) return;

    p.ready = !p.ready;
    io.to(roomId).emit('roomUpdate', {
      roomId:roomId,
      players: room.players.map(p => ({
        name: p.name, ready: p.ready, position: p.position, isAI: p.isAI
      }))
    });

    const humans = room.players.filter(p => !p.isAI);
    if (humans.length && humans.every(h => h.ready)) {
      console.log('準備補ai，目前玩家人數:', room.players.length);
      
      while (room.players.length < 4) {
        const ai = createAIPlayer(roomId, room.players.length);
        console.log('嘗試加入AI'， ai);
        room.players.push(ai);
      }
      startGame(room);
    }
  });

  socket.on('playerAction', ({ roomId, action, tile }) => {
    const room = rooms[roomId];
    if (!room?.game) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const result = room.game.processAction(player.position, action, tile);
    if (result) {
      io.to(roomId).emit('gameUpdate', result);

      if (!room.game.gameOver && room.game.currentPlayer !== undefined) {
        const next = room.players.find(p => p.position === room.game.currentPlayer);
        if (next?.isAI) setTimeout(() => aiMove(room, next), 600);
      }
    }
  });

  socket.on('disconnect', () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        io.to(rid).emit('roomUpdate', {
          players: room.players.map(p => ({
            name: p.name, ready: p.ready, position: p.position, isAI: p.isAI
          }))
        });
        if (room.players.length === 0) delete rooms[rid];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== 🀄️ 港式麻雀（5c89b31 改良版）===');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log('🎮 碰、槓、糊已加入，人機正常');
});
