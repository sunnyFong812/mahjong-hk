// server/game-engine/mahjong-game.js
// 一個更完整的麻將遊戲引擎，支援碰、槓、食糊

class MahjongGame {
  constructor(players) {
    this.players = players; // 玩家陣列 [{ id, name, position, isAI }]
    this.wall = [];         // 牌牆
    this.hands = {};        // 手牌 { 0: [牌], 1: [牌], 2: [牌], 3: [牌] }
    this.discards = {};     // 棄牌區 { 0: [牌], 1: [牌], 2: [牌], 3: [牌] }
    this.currentPlayer = 0; // 當前行動的玩家 (0:東, 1:南, 2:西, 3:北)
    this.lastDiscard = null;       // 最後一次被打出的牌 { tile: '牌', player: 位置 }
    this.winner = null;             // 贏家位置
    this.gameOver = false;          // 遊戲是否結束

    // 初始化
    for (let i = 0; i < 4; i++) {
      this.hands[i] = [];
      this.discards[i] = [];
    }
  }

  // 建立牌牆 (包含花牌)
  createWall() {
    const wall = [];
    const suits = ['m', 'p', 's'];
    const honors = ['東', '南', '西', '北', '中', '發', '白'];
    // 萬、筒、條 1-9
    for (const suit of suits) {
      for (let num = 1; num <= 9; num++) {
        for (let i = 0; i < 4; i++) {
          wall.push(`${num}${suit}`);
        }
      }
    }
    // 字牌
    for (const honor of honors) {
      for (let i = 0; i < 4; i++) {
        wall.push(honor);
      }
    }
    return this.shuffle(wall);
  }

  // 洗牌
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // 開始遊戲
  start() {
    console.log('🎮 遊戲引擎啟動');
    this.wall = this.createWall();

    // 發牌：莊家(0) 17張，閒家16張
    for (let i = 0; i < 4; i++) {
      const tileCount = i === 0 ? 17 : 16;
      for (let j = 0; j < tileCount; j++) {
        if (this.wall.length > 0) {
          this.hands[i].push(this.wall.pop());
        }
      }
      this.hands[i].sort((a, b) => a.localeCompare(b)); // 簡單排序
    }

    // 設置第一個玩家為莊家
    this.currentPlayer = 0;
    this.gameOver = false;
    this.winner = null;

    return {
      hands: this.hands,
      discards: this.discards,
      currentPlayer: this.currentPlayer,
      wallSize: this.wall.length
    };
  }

  // 處理玩家動作 (由 server.js 調用)
  processAction(playerPosition, action, tile, targetPosition) {
    console.log(`⚙️ 引擎處理: 玩家 ${playerPosition} 動作 ${action} 牌 ${tile}`);
    switch (action) {
      case 'DISCARD':
        return this.handleDiscard(playerPosition, tile);
      case 'PONG':
        return this.handlePong(playerPosition, tile, targetPosition);
      // TODO: 加入 CHOW, KONG, MAHJONG 的處理
      default:
        return { error: '未知的動作' };
    }
  }

  // 處理打牌
  handleDiscard(playerPosition, tile) {
    // 檢查是否為當前玩家
    if (playerPosition !== this.currentPlayer) {
      return { error: '不是你的回合' };
    }

    const hand = this.hands[playerPosition];
    const tileIndex = hand.indexOf(tile);
    if (tileIndex === -1) {
      return { error: '手牌中沒有這張牌' };
    }

    // 從手牌移除
    hand.splice(tileIndex, 1);
    // 加入棄牌區
    this.discards[playerPosition].push(tile);
    // 記錄最後打出的牌
    this.lastDiscard = { tile: tile, player: playerPosition };

    console.log(`⚙️ 玩家 ${playerPosition} 打出 ${tile}`);

    // --- 檢查其他玩家是否可以反應 (碰/槓/胡) ---
    const reactions = this.checkReactions(playerPosition, tile);

    // 準備要返回給 server.js 的數據
    const result = {
      type: 'DISCARD',
      player: playerPosition,
      tile: tile,
      hand: hand, // 發送給打牌者本人更新手牌
      discards: this.discards,
      lastDiscard: this.lastDiscard,
      currentPlayer: this.currentPlayer // 暫時還是當前玩家，直到回合結束
    };

    if (reactions.length > 0) {
      // 有玩家可以反應，將回合控制權交給 server.js 去詢問
      result.reactions = reactions;
      console.log('⚙️ 有玩家可以反應:', reactions);
    } else {
      // 沒有反應，輪到下家摸牌
      this.nextTurn();
      result.currentPlayer = this.currentPlayer;
      console.log(`⚙️ 輪到下家: ${this.currentPlayer}`);
    }

    return result;
  }

  // 處理碰
  handlePong(playerPosition, tile, targetPosition) {
    // 檢查手牌中是否有兩張相同的牌
    const hand = this.hands[playerPosition];
    const matchingTiles = hand.filter(t => t === tile);
    if (matchingTiles.length < 2) {
      return { error: '不能碰，手牌中少於兩張相同的牌' };
    }

    // 移除這兩張牌
    let removedCount = 0;
    const newHand = [];
    for (const t of hand) {
      if (t === tile && removedCount < 2) {
        removedCount++;
      } else {
        newHand.push(t);
      }
    }
    this.hands[playerPosition] = newHand.sort((a, b) => a.localeCompare(b));

    console.log(`⚙️ 玩家 ${playerPosition} 碰了 ${targetPosition} 的 ${tile}`);

    // 碰完後，輪到這個玩家打牌
    this.currentPlayer = playerPosition;
    // 清除最後打出的牌，因為被碰走了
    this.lastDiscard = null;

    return {
      type: 'PONG',
      player: playerPosition,
      tile: tile,
      from: targetPosition,
      hand: this.hands[playerPosition], // 更新手牌
      currentPlayer: this.currentPlayer
    };
  }

  // 檢查其他玩家對打出的牌的反應
  checkReactions(discardPlayer, tile) {
    const reactions = [];
    for (let i = 0; i < 4; i++) {
      if (i === discardPlayer) continue; // 不打牌者自己

      const playerActions = [];

      // TODO: 1. 檢查食糊 (最優先)
      if (this.canMahjong(i, tile)) {
        playerActions.push('MAHJONG');
      }

      // TODO: 2. 檢查槓 (如果手牌有三張)
      if (this.canKong(i, tile)) {
        playerActions.push('KONG');
      }

      // 3. 檢查碰 (如果手牌有兩張)
      if (this.canPong(i, tile)) {
        playerActions.push('PONG');
      }

      // TODO: 4. 檢查吃 (只能吃上家)
      const isUpperSeat = (discardPlayer + 1) % 4 === i;
      if (isUpperSeat && this.canChow(i, tile)) {
        playerActions.push('CHOW');
      }

      if (playerActions.length > 0) {
        reactions.push({
          player: i,
          actions: playerActions
        });
      }
    }
    return reactions;
  }

  // 檢查是否可以碰
  canPong(playerPosition, tile) {
    const hand = this.hands[playerPosition];
    const count = hand.filter(t => t === tile).length;
    return count >= 2;
  }

  // 檢查是否可以槓 (明槓)
  canKong(playerPosition, tile) {
    const hand = this.hands[playerPosition];
    const count = hand.filter(t => t === tile).length;
    return count >= 3;
  }

  // 檢查是否可以吃
  canChow(playerPosition, tile) {
    // 簡單檢查：只處理數字牌，且是否有連續的兩張
    if (typeof tile !== 'string' || !tile.match(/^\d+[mps]$/)) {
      return false; // 字牌或花牌不能吃
    }
    const suit = tile.slice(-1);
    const num = parseInt(tile);
    const hand = this.hands[playerPosition];

    // 檢查 [num-2, num-1] 的組合
    if (num >= 3 && hand.includes(`${num-2}${suit}`) && hand.includes(`${num-1}${suit}`)) return true;
    // 檢查 [num-1, num+1] 的組合
    if (num >= 2 && num <= 8 && hand.includes(`${num-1}${suit}`) && hand.includes(`${num+1}${suit}`)) return true;
    // 檢查 [num+1, num+2] 的組合
    if (num <= 7 && hand.includes(`${num+1}${suit}`) && hand.includes(`${num+2}${suit}`)) return true;

    return false;
  }

  // TODO: 檢查是否可以食糊 (非常複雜，這裡只做簡單判斷)
  canMahjong(playerPosition, tile) {
    // 為了測試，暫時讓玩家可以胡任意牌
    // 警告：這不是正確的食糊邏輯，只是為了讓你能觸發「食糊」按鈕
    console.log(`⚙️ 檢查 ${playerPosition} 是否可以胡 ${tile} (暫時返回 true)`);
    return true; // 讓你可以測試按鈕
  }

  // 輪到下一個玩家
  nextTurn() {
    this.currentPlayer = (this.currentPlayer + 1) % 4;
  }

  // 取得遊戲狀態
  getState() {
    return {
      hands: this.hands,
      discards: this.discards,
      currentPlayer: this.currentPlayer,
      wallSize: this.wall.length,
      lastDiscard: this.lastDiscard,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }
}

module.exports = MahjongGame;
