// 食糊判定模組
const { getSuit, getNumber, isHonor, sortHand } = require('./tiles');

class WinChecker {
  // 檢查是否食糊
  checkWin(hand, melds = [], winningTile = null) {
    const allTiles = [...hand];
    if (winningTile) allTiles.push(winningTile);
    
    // 排序手牌
    const sortedTiles = sortHand([...allTiles]);
    
    // 檢查特殊牌型：十三么、十六不搭等
    const specialResult = this.checkSpecialHands(sortedTiles);
    if (specialResult.isWin) {
      return specialResult;
    }
    
    // 檢查七對子
    if (this.isSevenPairs(sortedTiles)) {
      return { isWin: true, type: 'seven_pairs' };
    }
    
    // 常規牌型：4組面子+1對眼
    return this.checkRegularHand(sortedTiles, melds);
  }
  
  // 檢查常規牌型
  checkRegularHand(tiles, melds) {
    // 如果有副露，直接檢查剩下的手牌
    if (melds && melds.length > 0) {
      return this.checkWithMelds(tiles, melds);
    }
    
    // 沒有副露，需要從手牌中找出所有可能的組合
    return this.findWaysToWin(tiles);
  }
  
  // 有副露的情況
  checkWithMelds(tiles, melds) {
    // 已經有4組面子，只需要檢查手牌是否為一對
    if (melds.length === 4) {
      if (tiles.length === 2 && tiles[0] === tiles[1]) {
        return { isWin: true, type: 'regular', melds: melds };
      }
      return { isWin: false };
    }
    
    // 少於4組面子，需要從手牌中找出剩下的組合
    const remainingMelds = 4 - melds.length;
    return this.findMeldsFromHand(tiles, remainingMelds, melds);
  }
  
  // 從手牌中找出所有可能的組合
  findWaysToWin(tiles) {
    // 嘗試每一對作為將眼
    const tileCount = this.countTiles(tiles);
    
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tileCount[tile] >= 2) {
        // 移除這一對
        const remainingTiles = this.removeTiles(tiles, [tile, tile]);
        
        // 檢查剩下的牌是否能組成4組面子
        const result = this.findMelds(remainingTiles, 4, []);
        if (result.success) {
          return {
            isWin: true,
            type: 'regular',
            pair: tile,
            melds: result.melds
          };
        }
      }
    }
    
    return { isWin: false };
  }
  
  // 遞歸找出所有面子組合
  findMelds(tiles, needed, currentMelds) {
    if (needed === 0) {
      return tiles.length === 0 ? { success: true, melds: currentMelds } : { success: false };
    }
    
    if (tiles.length < 3) {
      return { success: false };
    }
    
    const sortedTiles = sortHand([...tiles]);
    
    // 嘗試找刻子
    if (sortedTiles[0] === sortedTiles[1] && sortedTiles[1] === sortedTiles[2]) {
      const newTiles = sortedTiles.slice(3);
      const newMelds = [...currentMelds, { type: 'pong', tiles: [sortedTiles[0], sortedTiles[0], sortedTiles[0]] }];
      const result = this.findMelds(newTiles, needed - 1, newMelds);
      if (result.success) return result;
    }
    
    // 嘗試找順子（只有數字牌才能組成順子）
    if (!isHonor(sortedTiles[0])) {
      const num1 = getNumber(sortedTiles[0]);
      const suit1 = getSuit(sortedTiles[0]);
      
      // 尋找 num1, num1+1, num1+2 的順子
      const tile2 = `${num1 + 1}${suit1}`;
      const tile3 = `${num1 + 2}${suit1}`;
      
      if (this.hasTile(sortedTiles, tile2) && this.hasTile(sortedTiles, tile3)) {
        const newTiles = this.removeTiles(sortedTiles, [sortedTiles[0], tile2, tile3]);
        const newMelds = [...currentMelds, { type: 'chow', tiles: [sortedTiles[0], tile2, tile3] }];
        const result = this.findMelds(newTiles, needed - 1, newMelds);
        if (result.success) return result;
      }
    }
    
    return { success: false };
  }
  
  // 檢查七對子
  isSevenPairs(tiles) {
    if (tiles.length !== 14) return false;
    
    const counts = {};
    tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
    
    const pairs = Object.values(counts).filter(c => c === 2);
    return pairs.length === 7;
  }
  
  // 檢查特殊牌型
  checkSpecialHands(tiles) {
    // 十三么
    if (this.isThirteenOrphans(tiles)) {
      return { isWin: true, type: 'thirteen_orphans' };
    }
    
    // 十六不搭
    if (this.isSixteenNotConnected(tiles)) {
      return { isWin: true, type: 'sixteen_not_connected' };
    }
    
    return { isWin: false };
  }
  
  // 十三么：13種么九牌各一張，再加其中一張
  isThirteenOrphans(tiles) {
    const orphans = [
      '1m', '9m', '1p', '9p', '1s', '9s',
      '東', '南', '西', '北', '中', '發', '白'
    ];
    
    if (tiles.length !== 14) return false;
    
    const counts = {};
    tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
    
    // 檢查是否每種么九牌至少有一張
    for (const orphan of orphans) {
      if (!counts[orphan] || counts[orphan] < 1) return false;
    }
    
    // 檢查是否有一張重複
    const hasDuplicate = Object.values(counts).some(c => c === 2);
    return hasDuplicate && Object.keys(counts).length === 13;
  }
  
  // 十六不搭
  isSixteenNotConnected(tiles) {
    // 簡化實現
    return false;
  }
  
  // 工具函數
  
  countTiles(tiles) {
    const counts = {};
    tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
    return counts;
  }
  
  hasTile(tiles, tile) {
    return tiles.includes(tile);
  }
  
  removeTiles(tiles, toRemove) {
    const result = [...tiles];
    for (const tile of toRemove) {
      const index = result.indexOf(tile);
      if (index !== -1) {
        result.splice(index, 1);
      }
    }
    return result;
  }
  
  // 聽牌檢查
  checkTenpai(hand, melds = []) {
    const waitTiles = [];
    const allPossibleTiles = this.generateAllTiles();
    
    for (const tile of allPossibleTiles) {
      const result = this.checkWin(hand, melds, tile);
      if (result.isWin) {
        waitTiles.push(tile);
      }
    }
    
    return waitTiles;
  }
  
  generateAllTiles() {
    const tiles = [];
    
    // 萬筒條 1-9
    for (const suit of ['m', 'p', 's']) {
      for (let num = 1; num <= 9; num++) {
        tiles.push(`${num}${suit}`);
      }
    }
    
    // 字牌
    const honors = ['東', '南', '西', '北', '中', '發', '白'];
    tiles.push(...honors);
    
    return tiles;
  }
}

module.exports = WinChecker;