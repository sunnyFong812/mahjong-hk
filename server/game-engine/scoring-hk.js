// 港式台牌番數計算模組
const { isHonor, isTerminal, getSuit, getNumber } = require('./tiles');

// 港式台牌番數表
const HK_SCORING = {
  // 一般番種
  general: {
    無花: 1,
    爛花: 1,
    正花: 2,
    無字: 1,
    無字花: 8,
    假獨: 1,
    獨獨: 2,
    對碰: 2,
    將眼: 2,
    正風: 1,
    自摸: 1,
    爛風: 1,
    門前清: 5,
    正位: 1,
    門前清自摸: 10,
    三元牌: 2,
    聽牌: 5,
    一發: 5,
    食聽牌: 5,
    聽牌自摸: 10
  },

  // 數字組合
  numbers: {
    缺五: 5,
    斷么九: 5,
    四歸一: [5, 10],
    四歸二: [10, 20],
    四歸四: [30, 60],
    雜龍: [10, 15],
    清龍: [15, 20],
    小於五: 60,
    大於五: 60,
    全帶X: 60,
    混帶X: [20, 30, 40],
    小於5: 40,
    大於5: 40
  },

  // 順子組合
  sequences: {
    全姊妹: 20,
    般高: [5, 10],
    三般高: [20, 30],
    四段高: [40, 60],
    相逢: [3, 5],
    三相逢: [10, 20],
    四同順: [25, 50],
    五同順: [40, 80],
    三色三步高: [5, 10],
    三色四步高: [15, 20],
    三色五步高: [30, 40],
    一色三步高: [10, 20],
    一色四步高: [30, 40],
    一色五步高: [60, 80]
  },

  // 牌型
  patterns: {
    雞糊: 30,
    鴨糊: 15,
    平糊: 5,
    大平糊: 15,
    對對糊: 40,
    坎坎糊: 120,
    廿二羅漢: 180,
    全求人: 30,
    半求人: 15,
    缺一門: 5,
    五門齊: [10, 15],
    七門齊: [15, 20],
    混一色: 40,
    清一色: 100,
    字一色: 150,
    三元: [30, 60],
    三風: [20, 40],
    四喜: [60, 120]
  },

  // 特殊情況
  special: {
    搶槓: 5,
    四只內: 40,
    槓摸: [5, 20, 40, 80, 160],
    七只內: 20,
    花摸: [1, 3, 10, 20, 40, 70, 100, 140],
    十只內: 10,
    混花槓摸: [10, 20, 40, 70, 100, 140],
    海底撈月: 20,
    河底撈魚: 15,
    一炮雙響: 10,
    一炮三響: 20,
    絕絕: 5,
    八絕: 10,
    天聽: 40,
    地聽: 35,
    天糊: 120,
    地糊: 100,
    人糊: 80
  },

  // 刻子組合
  pongs: {
    同刻: 5,
    三同刻: [10, 20],
    連刻: 5,
    三連刻: [10, 20],
    四連刻: [30, 50],
    五連刻: [60, 90],
    六連刻: 160,
    二暗坎: 5,
    三暗坎: 10,
    四暗坎: 20,
    五暗坎: 40
  },

  // 花牌組合
  flowers: {
    一台草: 2,
    一台花: 5,
    七搶一: 30,
    一搶七: 30,
    八仙過海: 40
  },

  // 么九組合
  terminals: {
    老少上: [3, 5],
    老少碰: 5,
    混帶么: 30,
    全帶么: 60,
    清么九: 200,
    十三么: [120, 140],
    十六不搭: [60, 70]
  },

  // 哩咕哩咕
  liku: {
    哩咕哩咕: [40, 50],
    同款連對: [5, 10, 20, 40, 80],
    通天雜龍: 100,
    通天清龍: 300
  }
};

class ScoreCalculator {
  constructor() {
    this.scoring = HK_SCORING;
  }
  
  calculate(handInfo, gameState) {
    const details = [];
    let total = 0;
    
    // 檢查一般番種
    const general = this.checkGeneral(handInfo, gameState);
    total += general.total;
    details.push(...general.details);
    
    // 檢查牌型
    const patterns = this.checkPatterns(handInfo);
    total += patterns.total;
    details.push(...patterns.details);
    
    // 檢查數字組合
    const numbers = this.checkNumbers(handInfo);
    total += numbers.total;
    details.push(...numbers.details);
    
    // 檢查順子組合
    const sequences = this.checkSequences(handInfo);
    total += sequences.total;
    details.push(...sequences.details);
    
    // 檢查刻子組合
    const pongs = this.checkPongs(handInfo);
    total += pongs.total;
    details.push(...pongs.details);
    
    // 檢查么九組合
    const terminals = this.checkTerminals(handInfo);
    total += terminals.total;
    details.push(...terminals.details);
    
    // 檢查特殊情況
    const special = this.checkSpecial(handInfo, gameState);
    total += special.total;
    details.push(...special.details);
    
    return {
      total,
      details: details.sort((a, b) => b.fan - a.fan)
    };
  }
  
  checkGeneral(handInfo, gameState) {
    const result = { total: 0, details: [] };
    
    // 門前清
    if (handInfo.isMenQianQing) {
      if (handInfo.isSelfDrawn) {
        result.total += this.scoring.general["門前清自摸"];
        result.details.push({ name: "門前清自摸", fan: this.scoring.general["門前清自摸"] });
      } else {
        result.total += this.scoring.general["門前清"];
        result.details.push({ name: "門前清", fan: this.scoring.general["門前清"] });
      }
    }
    
    // 自摸
    if (handInfo.isSelfDrawn) {
      result.total += this.scoring.general["自摸"];
      result.details.push({ name: "自摸", fan: this.scoring.general["自摸"] });
    }
    
    // 聽牌
    if (handInfo.isRiichi) {
      result.total += this.scoring.general["聽牌"];
      result.details.push({ name: "聽牌", fan: this.scoring.general["聽牌"] });
      
      if (handInfo.isSelfDrawn) {
        result.total += this.scoring.general["聽牌自摸"];
        result.details.push({ name: "聽牌自摸", fan: this.scoring.general["聽牌自摸"] });
      }
    }
    
    // 一發
    if (handInfo.isIppatsu) {
      result.total += this.scoring.general["一發"];
      result.details.push({ name: "一發", fan: this.scoring.general["一發"] });
    }
    
    // 花牌情況
    if (handInfo.flowers && handInfo.flowers.length === 0) {
      result.total += this.scoring.general["無花"];
      result.details.push({ name: "無花", fan: this.scoring.general["無花"] });
    }
    
    // 字牌情況
    const honorCount = handInfo.tiles.filter(t => isHonor(t)).length;
    if (honorCount === 0) {
      result.total += this.scoring.general["無字"];
      result.details.push({ name: "無字", fan: this.scoring.general["無字"] });
    }
    
    // 正風
    if (gameState && handInfo.wind) {
      const hasPungOfWind = this.hasWindPung(handInfo, gameState.roundWind, handInfo.wind);
      if (hasPungOfWind) {
        result.total += this.scoring.general["正風"];
        result.details.push({ name: "正風", fan: this.scoring.general["正風"] });
      }
    }
    
    return result;
  }
  
  checkPatterns(handInfo) {
    const result = { total: 0, details: [] };
    const { tiles, melds } = handInfo;
    
    // 對對糊
    if (this.isAllPongs(melds)) {
      result.total += this.scoring.patterns["對對糊"];
      result.details.push({ name: "對對糊", fan: this.scoring.patterns["對對糊"] });
    }
    
    // 混一色
    if (this.isHalfFlush(tiles, melds)) {
      result.total += this.scoring.patterns["混一色"];
      result.details.push({ name: "混一色", fan: this.scoring.patterns["混一色"] });
    }
    
    // 清一色
    if (this.isFullFlush(tiles, melds)) {
      result.total += this.scoring.patterns["清一色"];
      result.details.push({ name: "清一色", fan: this.scoring.patterns["清一色"] });
    }
    
    // 字一色
    if (this.isAllHonors(tiles, melds)) {
      result.total += this.scoring.patterns["字一色"];
      result.details.push({ name: "字一色", fan: this.scoring.patterns["字一色"] });
    }
    
    // 缺一門
    if (this.isMissingOneSuit(tiles, melds)) {
      result.total += this.scoring.patterns["缺一門"];
      result.details.push({ name: "缺一門", fan: this.scoring.patterns["缺一門"] });
    }
    
    return result;
  }
  
  checkNumbers(handInfo) {
    const result = { total: 0, details: [] };
    const tiles = handInfo.tiles;
    
    // 缺五
    if (this.isMissingNumber(tiles, 5)) {
      result.total += this.scoring.numbers["缺五"];
      result.details.push({ name: "缺五", fan: this.scoring.numbers["缺五"] });
    }
    
    // 斷么九
    if (this.isMissingTerminals(tiles)) {
      result.total += this.scoring.numbers["斷么九"];
      result.details.push({ name: "斷么九", fan: this.scoring.numbers["斷么九"] });
    }
    
    // 小於五
    if (this.isAllLessThanFive(tiles)) {
      result.total += this.scoring.numbers["小於五"];
      result.details.push({ name: "小於五", fan: this.scoring.numbers["小於五"] });
    }
    
    // 大於五
    if (this.isAllGreaterThanFive(tiles)) {
      result.total += this.scoring.numbers["大於五"];
      result.details.push({ name: "大於五", fan: this.scoring.numbers["大於五"] });
    }
    
    return result;
  }
  
  checkPongs(handInfo) {
    const result = { total: 0, details: [] };
    const melds = handInfo.melds || [];
    
    if (melds.length === 0) return result;
    
    // 計算刻子類型
    const pongGroups = this.groupPongsByType(melds);
    
    // 兄弟刻
    if (pongGroups.brothers >= 2) {
      result.total += this.scoring.pongs["兄弟"];
      result.details.push({ name: "兄弟", fan: this.scoring.pongs["兄弟"] });
    }
    
    // 姊妹刻
    if (pongGroups.sisters >= 2) {
      result.total += this.scoring.pongs["姊妹"];
      result.details.push({ name: "姊妹", fan: this.scoring.pongs["姊妹"] });
    }
    
    // 暗坎
    const darkPongCount = melds.filter(m => m.type === 'pong' && m.isDark).length;
    if (darkPongCount >= 2) {
      const fanName = ['二暗坎', '三暗坎', '四暗坎', '五暗坎'][darkPongCount - 2];
      const fanValue = this.scoring.pongs[fanName];
      if (fanValue) {
        result.total += fanValue;
        result.details.push({ name: fanName, fan: fanValue });
      }
    }
    
    return result;
  }
  
  checkTerminals(handInfo) {
    const result = { total: 0, details: [] };
    const tiles = handInfo.tiles;
    const melds = handInfo.melds || [];
    
    // 混帶么
    if (this.isMixedTerminals(tiles, melds)) {
      result.total += this.scoring.terminals["混帶么"];
      result.details.push({ name: "混帶么", fan: this.scoring.terminals["混帶么"] });
    }
    
    // 全帶么
    if (this.isAllTerminals(tiles, melds)) {
      result.total += this.scoring.terminals["全帶么"];
      result.details.push({ name: "全帶么", fan: this.scoring.terminals["全帶么"] });
    }
    
    return result;
  }
  
  checkSpecial(handInfo, gameState) {
    const result = { total: 0, details: [] };
    
    // 海底撈月
    if (gameState && gameState.isLastTile) {
      if (handInfo.isSelfDrawn) {
        result.total += this.scoring.special["海底撈月"];
        result.details.push({ name: "海底撈月", fan: this.scoring.special["海底撈月"] });
      } else {
        result.total += this.scoring.special["河底撈魚"];
        result.details.push({ name: "河底撈魚", fan: this.scoring.special["河底撈魚"] });
      }
    }
    
    // 搶槓
    if (handInfo.isRobbingKong) {
      result.total += this.scoring.special["搶槓"];
      result.details.push({ name: "搶槓", fan: this.scoring.special["搶槓"] });
    }
    
    return result;
  }
  
  checkSequences(handInfo) {
    const result = { total: 0, details: [] };
    // 實現順子檢查邏輯
    return result;
  }
  
  // 輔助判斷函數
  
  isAllPongs(melds) {
    return melds && melds.length === 4 && melds.every(m => m.type === 'pong' || m.type === 'kong');
  }
  
  isHalfFlush(tiles, melds) {
    const allTiles = [...tiles];
    melds?.forEach(m => allTiles.push(...m.tiles));
    
    const suits = new Set(allTiles.map(t => {
      if (isHonor(t)) return 'z';
      return getSuit(t);
    }).filter(s => s));
    
    return suits.size === 2 && suits.has('z');
  }
  
  isFullFlush(tiles, melds) {
    const allTiles = [...tiles];
    melds?.forEach(m => allTiles.push(...m.tiles));
    
    const suits = new Set(allTiles.map(t => getSuit(t)).filter(s => s && s !== 'z'));
    return suits.size === 1;
  }
  
  isAllHonors(tiles, melds) {
    const allTiles = [...tiles];
    melds?.forEach(m => allTiles.push(...m.tiles));
    
    return allTiles.every(t => isHonor(t));
  }
  
  isMissingOneSuit(tiles, melds) {
    const allTiles = [...tiles];
    melds?.forEach(m => allTiles.push(...m.tiles));
    
    const suits = new Set(allTiles.map(t => getSuit(t)).filter(s => s && s !== 'z'));
    return suits.size === 2; // 只有兩種花色
  }
  
  isMissingNumber(tiles, num) {
    for (const tile of tiles) {
      if (getNumber(tile) === num) return false;
    }
    return true;
  }
  
  isMissingTerminals(tiles) {
    for (const tile of tiles) {
      if (isTerminal(tile)) return false;
    }
    return true;
  }
  
  isAllLessThanFive(tiles) {
    for (const tile of tiles) {
      const num = getNumber(tile);
      if (num && num >= 5) return false;
      if (isHonor(tile)) return false;
    }
    return true;
  }
  
  isAllGreaterThanFive(tiles) {
    for (const tile of tiles) {
      const num = getNumber(tile);
      if (num && num <= 5) return false;
      if (isHonor(tile)) return false;
    }
    return true;
  }
  
  hasWindPung(handInfo, roundWind, seatWind) {
    const melds = handInfo.melds || [];
    return melds.some(m => {
      if (m.type !== 'pong' && m.type !== 'kong') return false;
      const tile = m.tiles[0];
      return tile === roundWind || tile === seatWind;
    });
  }
  
  isMixedTerminals(tiles, melds) {
    const allTiles = [...tiles];
    melds?.forEach(m => allTiles.push(...m.tiles));
    
    // 至少有一個么九，但不是全部
    const hasTerminal = allTiles.some(t => isTerminal(t));
    const allTerminal = allTiles.every(t => isTerminal(t));
    
    return hasTerminal && !allTerminal;
  }
  
  isAllTerminals(tiles, melds) {
    const allTiles = [...tiles];
    melds?.forEach(m => allTiles.push(...m.tiles));
    
    return allTiles.every(t => isTerminal(t));
  }
  
  groupPongsByType(melds) {
    const pongs = melds.filter(m => m.type === 'pong' || m.type === 'kong');
    let brothers = 0;
    let sisters = 0;
    
    // 簡化實現，實際需要更複雜的邏輯
    for (let i = 0; i < pongs.length; i++) {
      for (let j = i + 1; j < pongs.length; j++) {
        const tile1 = pongs[i].tiles[0];
        const tile2 = pongs[j].tiles[0];
        
        if (getSuit(tile1) === getSuit(tile2)) {
          const num1 = getNumber(tile1);
          const num2 = getNumber(tile2);
          
          if (num1 && num2) {
            if (Math.abs(num1 - num2) === 1) {
              sisters++;
            } else if (Math.abs(num1 - num2) === 2) {
              brothers++;
            }
          }
        }
      }
    }
    
    return { brothers, sisters };
  }
}

module.exports = ScoreCalculator;
