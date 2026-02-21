const { createDeck, shuffle, sortHand } = require('./tiles');
const WinChecker = require('./win-checker');
const ScoreCalculator = require('./scoring-hk');

class MahjongGame {
  constructor(players) {
    this.players = players;
    this.wall = [];
    this.hands = {};
    this.melds = {};
    this.discards = {};
    this.flowers = {};
    this.currentPlayer = 0; // 0:東, 1:南, 2:西, 3:北
    self.drawCount = 0;
    this.lastDiscard = null;
    this.lastDiscardPlayer = null;
    this.gameOver = false;
    this.winner = null;
    this.scores = {};
    this.winChecker = new WinChecker();
    this.scoreCalculator = new ScoreCalculator();
    this.roundWind = '東'; // 圈風
    
    // 初始化
    players.forEach((p, i) => {
      this.hands[i] = [];
      this.melds[i] = [];
      this.discards[i] = [];
      this.flowers[i] = [];
      this.scores[p.id] = 0;
    });
  }
  
  start() {
    // 創建牌牆
    this.wall = createDeck(true); // 包含花牌
    this.wall = shuffle(this.wall);
    
    // 發牌
    this.deal();
    
    // 處理花牌補牌
    this.handleFlowers();
    
    // 莊家（東）先打牌
    this.currentPlayer = 0;
    
    return this.getGameState();
  }
  
  deal() {
    // 莊家拿14張，閒家13張
    for (let i = 0; i < 4; i++) {
      const tileCount = i === 0 ? 14 : 13;
      for (let j = 0; j < tileCount; j++) {
        this.hands[i].push(this.wall.pop());
      }
      this.hands[i] = sortHand(this.hands[i]);
    }
  }
  
  handleFlowers() {
    // 處理花牌：摸到花牌要補牌
    for (let i = 0; i < 4; i++) {
      while (true) {
        const flowerIndex = this.hands[i].findIndex(t => 
          t === '春' || t === '夏' || t === '秋' || t === '冬' ||
          t === '梅' || t === '蘭' || t === '竹' || t === '菊'
        );
        
        if (flowerIndex === -1) break;
        
        // 移除花牌
        const flower = this.hands[i].splice(flowerIndex, 1)[0];
        this.flowers[i].push(flower);
        
        // 補牌
        if (this.wall.length > 0) {
          this.hands[i].push(this.wall.pop());
          this.hands[i] = sortHand(this.hands[i]);
        }
      }
    }
  }
  
  processAction(playerPosition, action, tile, targetPosition) {
    switch(action) {
      case 'DISCARD':
        return this.handleDiscard(playerPosition, tile);
      case 'PONG':
        return this.handlePong(playerPosition, tile, targetPosition);
      case 'CHOW':
        return this.handleChow(playerPosition, tile, targetPosition);
      case 'KONG':
        return this.handleKong(playerPosition, tile, targetPosition);
      case 'MAHJONG':
        return this.handleMahjong(playerPosition, tile, targetPosition);
      default:
        return null;
    }
  }
  
  handleDiscard(playerPosition, tile) {
    // 檢查是否為當前玩家
    if (playerPosition !== this.currentPlayer) {
      return { error: '不是你的回合' };
    }
    
    // 檢查手牌是否有這張牌
    const tileIndex = this.hands[playerPosition].indexOf(tile);
    if (tileIndex === -1) {
      return { error: '手牌沒有這張牌' };
    }
    
    // 移除牌
    this.hands[playerPosition].splice(tileIndex, 1);
    
    // 加入棄牌區
    this.discards[playerPosition].push(tile);
    this.lastDiscard = tile;
    this.lastDiscardPlayer = playerPosition;
    
    // 檢查其他玩家是否可以吃碰槓胡
    const reactions = this.checkReactions(playerPosition, tile);
    
    if (reactions.length > 0) {
      // 有玩家可以反應，暫停回合
      return {
        type: 'DISCARD',
        player: playerPosition,
        tile: tile,
        hand: this.hands[playerPosition],
        reactions: reactions,
        currentPlayer: this.currentPlayer
      };
    } else {
      // 沒有反應，輪到下家
      this.nextPlayer();
      
      // 下家摸牌
      const drawnTile = this.drawTile(this.currentPlayer);
      
      return {
        type: 'DISCARD',
        player: playerPosition,
        tile: tile,
        hand: this.hands[playerPosition],
        nextPlayer: this.currentPlayer,
        drawnTile: drawnTile,
        discards: this.discards,
        currentPlayer: this.currentPlayer
      };
    }
  }
  
  handlePong(playerPosition, tile, targetPosition) {
    // 檢查是否可以碰
    const hand = this.hands[playerPosition];
    const pair = hand.filter(t => t === tile);
    
    if (pair.length < 2) {
      return { error: '不能碰' };
    }
    
    // 移除兩張相同的牌
    let removed = 0;
    const newHand = [];
    for (const t of hand) {
      if (t === tile && removed < 2) {
        removed++;
      } else {
        newHand.push(t);
      }
    }
    this.hands[playerPosition] = sortHand(newHand);
    
    // 記錄碰
    this.melds[playerPosition].push({
      type: 'pong',
      tiles: [tile, tile, tile],
      from: targetPosition,
      isDark: false
    });
    
    // 輪到這個玩家打牌
    this.currentPlayer = playerPosition;
    
    return {
      type: 'PONG',
      player: playerPosition,
      tile: tile,
      from: targetPosition,
      hand: this.hands[playerPosition],
      currentPlayer: this.currentPlayer,
      melds: this.melds
    };
  }
  
  handleChow(playerPosition, tile, targetPosition) {
    // 檢查是否可以吃（只能吃上家）
    const isUpperSeat = (targetPosition + 1) % 4 === playerPosition;
    if (!isUpperSeat) {
      return { error: '只能吃上家' };
    }
    
    // 檢查是否有連續的兩張牌
    const hand = this.hands[playerPosition];
    const suit = tile.match(/[mps]/) ? tile.match(/[mps]/)[0] : null;
    
    if (!suit) {
      return { error: '不能吃字牌' };
    }
    
    const num = parseInt(tile);
    const possibleTiles = [];
    
    // 檢查 num-2, num-1 的組合
    if (num >= 3) {
      const t1 = `${num-2}${suit}`;
      const t2 = `${num-1}${suit}`;
      if (hand.includes(t1) && hand.includes(t2)) {
        possibleTiles.push([t1, t2]);
      }
    }
    
    // 檢查 num-1, num+1 的組合
    if (num >= 2 && num <= 8) {
      const t1 = `${num-1}${suit}`;
      const t2 = `${num+1}${suit}`;
      if (hand.includes(t1) && hand.includes(t2)) {
        possibleTiles.push([t1, t2]);
      }
    }
    
    // 檢查 num+1, num+2 的組合
    if (num <= 7) {
      const t1 = `${num+1}${suit}`;
      const t2 = `${num+2}${suit}`;
      if (hand.includes(t1) && hand.includes(t2)) {
        possibleTiles.push([t1, t2]);
      }
    }
    
    if (possibleTiles.length === 0) {
      return { error: '不能吃' };
    }
    
    // 簡化：使用第一個組合
    const [t1, t2] = possibleTiles[0];
    
    // 移除這兩張牌
    let newHand = [...hand];
    newHand.splice(newHand.indexOf(t1), 1);
    newHand.splice(newHand.indexOf(t2), 1);
    this.hands[playerPosition] = sortHand(newHand);
    
    // 記錄吃
    this.melds[playerPosition].push({
      type: 'chow',
      tiles: [t1, t2, tile],
      from: targetPosition
    });
    
    // 輪到這個玩家打牌
    this.currentPlayer = playerPosition;
    
    return {
      type: 'CHOW',
      player: playerPosition,
      tiles: [t1, t2, tile],
      from: targetPosition,
      hand: this.hands[playerPosition],
      currentPlayer: this.currentPlayer,
      melds: this.melds
    };
  }
  
  handleKong(playerPosition, tile, targetPosition) {
    // 實現槓的邏輯
    // 返回結果
  }
  
  handleMahjong(playerPosition, tile, targetPosition) {
    const hand = this.hands[playerPosition];
    const melds = this.melds[playerPosition];
    
    // 檢查是否食糊
    const winResult = this.winChecker.checkWin(hand, melds, tile);
    
    if (!winResult.isWin) {
      return { error: '沒有食糊' };
    }
    
    // 計算番數
    const handInfo = {
      tiles: hand,
      melds: melds,
      flowers: this.flowers[playerPosition],
      isMenQianQing: melds.length === 0,
      isSelfDrawn: targetPosition === null || targetPosition === playerPosition,
      isRiichi: false, // 需要記錄是否聽牌
      isIppatsu: false,
      wind: this.getSeatWind(playerPosition)
    };
    
    const gameState = {
      roundWind: this.roundWind,
      isLastTile: this.wall.length === 0
    };
    
    const score = this.scoreCalculator.calculate(handInfo, gameState);
    
    // 更新分數
    const playerId = this.players[playerPosition].id;
    this.scores[playerId] += score.total;
    this.winner = playerPosition;
    this.gameOver = true;
    
    return {
      type: 'MAHJONG',
      player: playerPosition,
      from: targetPosition,
      winType: winResult.type,
      fanDetails: score.details,
      totalFan: score.total,
      scores: this.scores,
      gameOver: true
    };
  }
  
  drawTile(playerPosition) {
    if (this.wall.length === 0) return null;
    
    const tile = this.wall.pop();
    this.hands[playerPosition].push(tile);
    this.hands[playerPosition] = sortHand(this.hands[playerPosition]);
    
    // 檢查是否摸到花牌
    if (this.isFlower(tile)) {
      this.flowers[playerPosition].push(tile);
      // 移除花牌並補牌
      this.hands[playerPosition] = this.hands[playerPosition].filter(t => t !== tile);
      return this.drawTile(playerPosition); // 遞歸補牌
    }
    
    return tile;
  }
  
  checkReactions(discardPlayer, tile) {
    const reactions = [];
    
    for (let i = 0; i < 4; i++) {
      if (i === discardPlayer) continue;
      
      const playerReactions = [];
      
      // 檢查食糊
      const winResult = this.winChecker.checkWin(this.hands[i], this.melds[i], tile);
      if (winResult.isWin) {
        playerReactions.push('MAHJONG');
      }
      
      // 檢查碰
      if (this.canPong(this.hands[i], tile)) {
        playerReactions.push('PONG');
      }
      
      // 檢查槓
      if (this.canKong(this.hands[i], tile)) {
        playerReactions.push('KONG');
      }
      
      // 檢查吃（只能上家吃）
      const isUpperSeat = (discardPlayer + 1) % 4 === i;
      if (isUpperSeat && this.canChow(this.hands[i], tile)) {
        playerReactions.push('CHOW');
      }
      
      if (playerReactions.length > 0) {
        reactions.push({
          player: i,
          actions: playerReactions
        });
      }
    }
    
    return reactions;
  }
  
  canPong(hand, tile) {
    const count = hand.filter(t => t === tile).length;
    return count >= 2;
  }
  
  canChow(hand, tile) {
    // 檢查是否可以吃
    const suit = tile.match(/[mps]/) ? tile.match(/[mps]/)[0] : null;
    if (!suit) return false;
    
    const num = parseInt(tile);
    
    // 檢查是否有連續的兩張牌
    if (num >= 3 && hand.includes(`${num-2}${suit}`) && hand.includes(`${num-1}${suit}`)) {
      return true;
    }
    if (num >= 2 && num <= 8 && hand.includes(`${num-1}${suit}`) && hand.includes(`${num+1}${suit}`)) {
      return true;
    }
    if (num <= 7 && hand.includes(`${num+1}${suit}`) && hand.includes(`${num+2}${suit}`)) {
      return true;
    }
    
    return false;
  }
  
  canKong(hand, tile) {
    const count = hand.filter(t => t === tile).length;
    return count >= 3;
  }
  
  isFlower(tile) {
    return ['春', '夏', '秋', '冬', '梅', '蘭', '竹', '菊'].includes(tile);
  }
  
  nextPlayer() {
    this.currentPlayer = (this.currentPlayer + 1) % 4;
  }
  
  getSeatWind(position) {
    const winds = ['東', '南', '西', '北'];
    return winds[position];
  }
  
  getGameState() {
    const winds = {};
    for (let i = 0; i < 4; i++) {
      winds[i] = this.getSeatWind(i);
    }
    
    return {
      hands: this.hands,
      melds: this.melds,
      discards: this.discards,
      flowers: this.flowers,
      winds: winds,
      scores: this.scores,
      currentPlayer: this.currentPlayer,
      lastDiscard: this.lastDiscard,
      lastDiscardPlayer: this.lastDiscardPlayer,
      wallSize: this.wall.length,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }
}

module.exports = MahjongGame;