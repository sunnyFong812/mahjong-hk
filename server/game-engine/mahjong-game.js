class MahjongGame {
  constructor(players) {
    this.players = players;
    this.wall = this.createWall();
    this.hands = { 0: [], 1: [], 2: [], 3: [] };
    this.discards = { 0: [], 1: [], 2: [], 3: [] };
    this.melds = { 0: [], 1: [], 2: [], 3: [] };
    this.currentPlayer = 0;
    this.lastDiscard = null;
    this.winner = null;
    this.gameOver = false;
    this.pendingReaction = false;
    this.dealer = 0; // 莊家位置
  }

  // ========== 牌牆初始化 ==========
  createWall() {
    const wall = [];
    const suits = ['m', 'p', 's'];
    const honors = ['東', '南', '西', '北', '中', '發', '白'];
    
    for (const suit of suits) {
      for (let num = 1; num <= 9; num++) {
        for (let i = 0; i < 4; i++) {
          wall.push(`${num}${suit}`);
        }
      }
    }
    
    for (const honor of honors) {
      for (let i = 0; i < 4; i++) {
        wall.push(honor);
      }
    }
    
    return this.shuffle(wall);
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ========== 摸牌 ==========
  drawTile(playerPosition) {
    if (this.wall.length === 0) {
      console.log('⚠️ 牌牆沒牌了！');
      return null;
    }
    
    const drawnTile = this.wall.pop();
    this.hands[playerPosition].push(drawnTile);
    this.hands[playerPosition].sort((a, b) => a.localeCompare(b));
    
    console.log(`🀄️ 玩家 ${playerPosition} 摸到 ${drawnTile}`);
    return drawnTile;
  }

  // ========== 遊戲開始 ==========
  start() {
    // 發牌：莊家(0) 17張，閒家16張
    for (let i = 0; i < 4; i++) {
      const cnt = i === this.dealer ? 17 : 16;
      for (let j = 0; j < cnt; j++) {
        if (this.wall.length > 0) {
          this.hands[i].push(this.wall.pop());
        }
      }
      this.hands[i].sort((a, b) => a.localeCompare(b));
    }
    
    this.currentPlayer = this.dealer;
    this.pendingReaction = false;
    
    return {
      hands: this.hands,
      discards: this.discards,
      currentPlayer: this.currentPlayer,
      wallSize: this.wall.length
    };
  }

  // ========== 碰、槓、吃、胡判斷 ==========
  canPong(playerPosition, tile) {
    return this.hands[playerPosition].filter(t => t === tile).length >= 2;
  }

  canKong(playerPosition, tile) {
    return this.hands[playerPosition].filter(t => t === tile).length >= 3;
  }

  canChow(playerPosition, tile) {
    if (typeof tile !== 'string' || !tile.match(/^\d+[mps]$/)) return false;
    
    const suit = tile.slice(-1);
    const num = parseInt(tile);
    const hand = this.hands[playerPosition];
    
    if (num >= 3 && hand.includes(`${num-2}${suit}`) && hand.includes(`${num-1}${suit}`)) return true;
    if (num >= 2 && num <= 8 && hand.includes(`${num-1}${suit}`) && hand.includes(`${num+1}${suit}`)) return true;
    if (num <= 7 && hand.includes(`${num+1}${suit}`) && hand.includes(`${num+2}${suit}`)) return true;
    
    return false;
  }

  // ========== 食糊判定 ==========
  encodeTile(tile) {
    if (tile.includes('m')) return parseInt(tile);
    if (tile.includes('p')) return parseInt(tile) + 10;
    if (tile.includes('s')) return parseInt(tile) + 20;
    
    const honorMap = {
      '東': 31, '南': 33, '西': 35, '北': 37,
      '中': 39, '發': 41, '白': 43
    };
    return honorMap[tile] || 0;
  }

  encodeHand(hand) {
    return hand.map(tile => this.encodeTile(tile));
  }

  canFormMelds(seq) {
    if (seq.length === 0) return true;
    if (seq.length % 3 !== 0) return false;
    
    const first = seq[0];
    const firstCount = seq.filter(v => v === first).length;
    
    // 嘗試刻子
    if (firstCount >= 3) {
      const newSeq = [...seq];
      for (let i = 0; i < 3; i++) {
        const idx = newSeq.indexOf(first);
        if (idx !== -1) newSeq.splice(idx, 1);
      }
      if (this.canFormMelds(newSeq)) return true;
    }
    
    // 嘗試順子
    if (first < 30 && seq.includes(first + 1) && seq.includes(first + 2)) {
      const newSeq = [...seq];
      const idx1 = newSeq.indexOf(first);
      newSeq.splice(idx1, 1);
      const idx2 = newSeq.indexOf(first + 1);
      newSeq.splice(idx2, 1);
      const idx3 = newSeq.indexOf(first + 2);
      newSeq.splice(idx3, 1);
      
      if (this.canFormMelds(newSeq)) return true;
    }
    
    return false;
  }

  canMahjong(playerPosition, tile) {
    const currentHand = this.hands[playerPosition];
    const testHand = [...currentHand];
    
    if (tile) {
      testHand.push(tile);
    }
    
    if (testHand.length % 3 !== 2) return false;
    
    const encodedHand = this.encodeHand(testHand);
    encodedHand.sort((a, b) => a - b);
    
    for (let i = 0; i < encodedHand.length - 1; i++) {
      if (encodedHand[i] === encodedHand[i + 1]) {
        const remaining = [...encodedHand];
        remaining.splice(i, 2);
        
        if (this.canFormMelds(remaining)) {
          return true;
        }
        
        while (i + 1 < encodedHand.length && encodedHand[i] === encodedHand[i + 1]) {
          i++;
        }
      }
    }
    
    return false;
  }

  // ========== 檢查 reaction ==========
  checkReactions(discardPlayer, tile) {
    const reactions = [];
    
    for (let i = 0; i < 4; i++) {
      if (i === discardPlayer) continue;
      
      const actions = [];
      
      if (this.canMahjong(i, tile)) actions.push('MAHJONG');
      if (this.canKong(i, tile)) actions.push('KONG');
      if (this.canPong(i, tile)) actions.push('PONG');
      
      const isUpper = (discardPlayer + 1) % 4 === i;
      if (isUpper && this.canChow(i, tile)) actions.push('CHOW');
      
      if (actions.length) {
        reactions.push({ player: i, actions });
      }
    }
    
    return reactions;
  }

  // ========== 動作處理 ==========
  handleDiscard(playerPosition, tile) {
    if (playerPosition !== this.currentPlayer) {
      return { error: 'not your turn' };
    }
    
    const hand = this.hands[playerPosition];
    const idx = hand.indexOf(tile);
    if (idx === -1) return { error: 'no tile' };
    
    // 打牌
    hand.splice(idx, 1);
    this.discards[playerPosition].push(tile);
    this.lastDiscard = { tile, player: playerPosition };
    
    // 檢查 reaction
    const reactions = this.checkReactions(playerPosition, tile);
    
    const result = {
      type: 'DISCARD',
      player: playerPosition,
      tile,
      hand,
      discards: this.discards,
      lastDiscard: this.lastDiscard,
      currentPlayer: this.currentPlayer,
      melds: this.melds
    };
    
    if (reactions.length) {
      // 有 reaction，暫停回合
      result.reactions = reactions;
      this.pendingReaction = true;
    } else {
      // 沒 reaction，輪到下家摸牌
      this.nextTurn();
      
      // ✅ 摸牌！
      const drawnTile = this.drawTile(this.currentPlayer);
      
      result.currentPlayer = this.currentPlayer;
      result.drawnTile = drawnTile;
      result.nextPlayerHand = this.hands[this.currentPlayer];
      this.pendingReaction = false;
    }
    
    return result;
  }

  handlePong(playerPosition, tile, targetPosition) {
    const hand = this.hands[playerPosition];
    const matching = hand.filter(t => t === tile);
    if (matching.length < 2) return { error: 'cannot pong' };
    
    // 移除兩張牌
    let removed = 0;
    const newHand = [];
    for (const t of hand) {
      if (t === tile && removed < 2) {
        removed++;
      } else {
        newHand.push(t);
      }
    }
    this.hands[playerPosition] = newHand.sort((a, b) => a.localeCompare(b));
    
    // 記錄副露
    this.melds[playerPosition].push({
      type: 'PONG',
      tile,
      from: targetPosition
    });
    
    // 碰完後輪到自己
    this.currentPlayer = playerPosition;
    this.lastDiscard = null;
    this.pendingReaction = false;
    
    return {
      type: 'PONG',
      player: playerPosition,
      tile,
      from: targetPosition,
      hand: this.hands[playerPosition],
      melds: this.melds,
      currentPlayer: this.currentPlayer
    };
  }

  handleMahjong(playerPosition, tile) {
    if (!this.canMahjong(playerPosition, tile)) {
      return { error: 'cannot mahjong' };
    }
    
    this.gameOver = true;
    this.winner = playerPosition;
    
    return {
      type: 'MAHJONG',
      player: playerPosition,
      tile,
      gameOver: true,
      winner: playerPosition
    };
  }

  handlePass(playerPosition) {
    // 玩家選擇「過」，輪到下家摸牌
    this.nextTurn();
    
    // 下家摸牌
    const drawnTile = this.drawTile(this.currentPlayer);
    
    this.pendingReaction = false;
    
    return {
      type: 'PASS',
      player: playerPosition,
      currentPlayer: this.currentPlayer,
      drawnTile,
      nextPlayerHand: this.hands[this.currentPlayer]
    };
  }

  processAction(playerPosition, action, tile, targetPosition) {
    console.log(`⚙️ 引擎處理: 玩家 ${playerPosition} 動作 ${action} 牌 ${tile}`);
    
    switch (action) {
      case 'DISCARD':
        return this.handleDiscard(playerPosition, tile);
      case 'PONG':
        return this.handlePong(playerPosition, tile, targetPosition);
      case 'MAHJONG':
        return this.handleMahjong(playerPosition, tile);
      case 'PASS':
        return this.handlePass(playerPosition);
      default:
        return { error: 'unknown action' };
    }
  }

  nextTurn() {
    this.currentPlayer = (this.currentPlayer + 1) % 4;
  }

  getState() {
    return {
      hands: this.hands,
      discards: this.discards,
      melds: this.melds,
      currentPlayer: this.currentPlayer,
      lastDiscard: this.lastDiscard,
      wallSize: this.wall.length,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }
}

module.exports = MahjongGame;
