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
  }

  createWall() {
    const wall = [];
    const suits = ['m', 'p', 's'];
    const honors = ['東', '南', '西', '北', '中', '發', '白'];
    for (const s of suits) {
      for (let n = 1; n <= 9; n++) {
        for (let i = 0; i < 4; i++) wall.push(`${n}${s}`);
      }
    }
    for (const h of honors) {
      for (let i = 0; i < 4; i++) wall.push(h);
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

  start() {
    for (let i = 0; i < 4; i++) {
      const cnt = i === 0 ? 17 : 16;
      for (let j = 0; j < cnt; j++) this.hands[i].push(this.wall.pop());
      this.hands[i].sort((a, b) => a.localeCompare(b));
    }
    this.currentPlayer = 0;
    return {
      hands: this.hands,
      discards: this.discards,
      currentPlayer: 0,
      wallSize: this.wall.length
    };
  }

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

  canMahjong(playerPosition, tile) {
    // 暫時唔俾人胡，等遊戲可以流轉
    return false;
  }

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
      if (actions.length) reactions.push({ player: i, actions });
    }
    return reactions;
  }

  handleDiscard(playerPosition, tile) {
    if (playerPosition !== this.currentPlayer) return { error: 'not your turn' };
    const hand = this.hands[playerPosition];
    const idx = hand.indexOf(tile);
    if (idx === -1) return { error: 'no tile' };
    hand.splice(idx, 1);
    this.discards[playerPosition].push(tile);
    this.lastDiscard = { tile, player: playerPosition };
    const reactions = this.checkReactions(playerPosition, tile);
    const result = {
      type: 'DISCARD',
      player: playerPosition,
      tile,
      hand,
      discards: this.discards,
      lastDiscard: this.lastDiscard,
      currentPlayer: this.currentPlayer
    };
    if (reactions.length) {
      result.reactions = reactions;
    } else {
      this.currentPlayer = (playerPosition + 1) % 4;
      result.currentPlayer = this.currentPlayer;
    }
    return result;
  }

  handlePong(playerPosition, tile, targetPosition) {
  const hand = this.hands[playerPosition];
  
  // 檢查有冇足夠嘅相同牌
  const indices = [];
  for (let i = 0; i < hand.length; i++) {
    if (hand[i] === tile) {
      indices.push(i);
      if (indices.length === 2) break;
    }
  }

  if (indices.length < 2) {
    return { error: '不能碰，手牌中少於兩張相同的牌' };
  }

  // ✅ 安全移除：由後往前刪，唔會影響 index
  const newHand = [...hand];
  for (let i = indices.length - 1; i >= 0; i--) {
    newHand.splice(indices[i], 1);
  }

  this.hands[playerPosition] = newHand.sort((a, b) => a.localeCompare(b));

  // ✅ 記錄副露
  if (!this.melds) this.melds = { 0: [], 1: [], 2: [], 3: [] };
  this.melds[playerPosition].push({
    type: 'PONG',
    tile: tile,
    from: targetPosition
  });

  console.log(`⚙️ 玩家 ${playerPosition} 碰了 ${targetPosition} 的 ${tile}`);
  console.log(`📊 碰後手牌 (${this.hands[playerPosition].length} 張):`, this.hands[playerPosition]);

  this.currentPlayer = playerPosition;
  this.lastDiscard = null;

  return {
    type: 'PONG',
    player: playerPosition,
    tile: tile,
    from: targetPosition,
    hand: this.hands[playerPosition],
    melds: this.melds[playerPosition],
    currentPlayer: this.currentPlayer
  };
}
  processAction(playerPosition, action, tile, targetPosition) {
    switch (action) {
      case 'DISCARD': return this.handleDiscard(playerPosition, tile);
      case 'PONG': return this.handlePong(playerPosition, tile, targetPosition);
      default: return { error: 'unknown action' };
    }
  }

  nextTurn() {
    this.currentPlayer = (this.currentPlayer + 1) % 4;
  }
}

module.exports = MahjongGame;
