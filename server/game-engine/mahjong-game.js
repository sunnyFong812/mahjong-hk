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
  }

  // ========== 牌牆初始化 ==========
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

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ========== 遊戲開始 ==========
  start() {
    // 發牌：莊家(0) 17張，閒家16張
    for (let i = 0; i < 4; i++) {
      const cnt = i === 0 ? 17 : 16;
      for (let j = 0; j < cnt; j++) {
        if (this.wall.length > 0) {
          this.hands[i].push(this.wall.pop());
        }
      }
      this.hands[i].sort((a, b) => a.localeCompare(b));
    }
    
    this.currentPlayer = 0;
    this.pendingReaction = false;
    
    return {
      hands: this.hands,
      discards: this.discards,
      currentPlayer: 0,
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
    
    // 檢查 [num-2, num-1] 的組合
    if (num >= 3 && hand.includes(`${num-2}${suit}`) && hand.includes(`${num-1}${suit}`)) return true;
    // 檢查 [num-1, num+1] 的組合
    if (num >= 2 && num <= 8 && hand.includes(`${num-1}${suit}`) && hand.includes(`${num+1}${suit}`)) return true;
    // 檢查 [num+1, num+2] 的組合
    if (num <= 7 && hand.includes(`${num+1}${suit}`) && hand.includes(`${num+2}${suit}`)) return true;
    
    return false;
  }

  // ========== 食糊判定核心 ==========
  encodeTile(tile) {
    if (tile.includes('m')) return parseInt(tile); // 1m -> 1
    if (tile.includes('p')) return parseInt(tile) + 10; // 1p -> 11
    if (tile.includes('s')) return parseInt(tile) + 20; // 1s -> 21
    
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
    // 如果序列長度為0，表示成功拆分
    if (seq.length === 0) return true;
    
    // 如果長度不是3的倍數，不可能成功
    if (seq.length % 3 !== 0) return false;
    
    const first = seq[0];
    const firstCount = seq.filter(v => v === first).length;
    
    // 情況1: 嘗試組成刻子 (AAA)
    if (firstCount >= 3) {
      const newSeq = [...seq];
      for (let i = 0; i < 3; i++) {
        const idx = newSeq.indexOf(first);
        if (idx !== -1) newSeq.splice(idx, 1);
      }
      if (this.canFormMelds(newSeq)) return true;
    }
    
    // 情況2: 嘗試組成順子 (ABC) - 字牌不能組成順子
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
    // 取得玩家手牌，並加入要胡的牌
    const currentHand = this.hands[playerPosition];
    const testHand = [...currentHand];
    
    if (tile) {
      testHand.push(tile);
    }
    
    // 手牌數必須是 2 mod 3 (如 14, 17, 20)
    if (testHand.length % 3 !== 2) return false;
    
    // 編碼並排序
    const encodedHand = this.encodeHand(testHand);
    encodedHand.sort((a, b) => a - b);
    
    // 試所有可能的對子 (將眼)
    for (let i = 0; i < encodedHand.length - 1; i++) {
      if (encodedHand[i] === encodedHand[i + 1]) {
        const remaining = [...encodedHand];
        remaining.splice(i, 2);
        
        if (this.canFormMelds(remaining)) {
          console.log(`✅ 玩家 ${playerPosition} 可以食糊！`);
          return true;
        }
        
        // 跳過相同的牌
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

  hand.splice(idx, 1);
  this.discards[playerPosition].push(tile);
  this.lastDiscard = { tile, player: playerPosition };

  // ✅ 如果之前有 pending reaction，打完牌就清返
  this.pendingReaction = false;

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
    result.reactions = reactions;
    this.pendingReaction = true; // 有 reaction，暫停
  } else {
    this.currentPlayer = (playerPosition + 1) % 4;
    result.currentPlayer = this.currentPlayer;
    this.pendingReaction = false;
  }

  return result;
}
  handlePong(playerPosition, tile, targetPosition) {
    const hand = this.hands[playerPosition];
    const matching = hand.filter(t => t === tile);
    if (matching.length < 2) return { error: 'cannot pong' };
    
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
    
    this.melds[playerPosition].push({
      type: 'PONG',
      tile,
      from: targetPosition
    });
    
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
    this.currentPlayer = (playerPosition + 1) % 4;
    this.pendingReaction = false;
    
    return {
      type: 'PASS',
      player: playerPosition,
      currentPlayer: this.currentPlayer
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
