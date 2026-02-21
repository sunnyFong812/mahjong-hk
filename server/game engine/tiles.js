// 麻將牌定義
const TILE_SUITS = {
  CHARACTER: 'm',  // 萬子
  DOT: 'p',        // 筒子
  BAMBOO: 's',     // 條子
  HONOR: 'z'       // 字牌
};

const HONOR_TILES = {
  EAST: '東',
  SOUTH: '南',
  WEST: '西',
  NORTH: '北',
  RED: '中',
  GREEN: '發',
  WHITE: '白'
};

const FLOWER_TILES = {
  SPRING: '春',
  SUMMER: '夏',
  AUTUMN: '秋',
  WINTER: '冬',
  PLUM: '梅',
  ORCHID: '蘭',
  BAMBOO: '竹',
  CHRYSANTHEMUM: '菊'
};

// 創建一副牌
function createDeck(includeFlowers = false) {
  const deck = [];
  
  // 萬子 1-9，每款4張
  for (let i = 1; i <= 9; i++) {
    for (let j = 0; j < 4; j++) {
      deck.push(`${i}${TILE_SUITS.CHARACTER}`);
    }
  }
  
  // 筒子 1-9，每款4張
  for (let i = 1; i <= 9; i++) {
    for (let j = 0; j < 4; j++) {
      deck.push(`${i}${TILE_SUITS.DOT}`);
    }
  }
  
  // 條子 1-9，每款4張
  for (let i = 1; i <= 9; i++) {
    for (let j = 0; j < 4; j++) {
      deck.push(`${i}${TILE_SUITS.BAMBOO}`);
    }
  }
  
  // 字牌：東南西北中發白，每款4張
  const honors = [
    HONOR_TILES.EAST, HONOR_TILES.SOUTH, HONOR_TILES.WEST, HONOR_TILES.NORTH,
    HONOR_TILES.RED, HONOR_TILES.GREEN, HONOR_TILES.WHITE
  ];
  
  honors.forEach(honor => {
    for (let j = 0; j < 4; j++) {
      deck.push(honor);
    }
  });
  
  // 花牌（如果需要）
  if (includeFlowers) {
    const flowers = [
      FLOWER_TILES.SPRING, FLOWER_TILES.SUMMER, FLOWER_TILES.AUTUMN, FLOWER_TILES.WINTER,
      FLOWER_TILES.PLUM, FLOWER_TILES.ORCHID, FLOWER_TILES.BAMBOO, FLOWER_TILES.CHRYSANTHEMUM
    ];
    
    flowers.forEach(flower => {
      deck.push(flower);
    });
  }
  
  return deck;
}

// 洗牌
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 取得牌的花色
function getSuit(tile) {
  if (typeof tile !== 'string') return null;
  
  // 字牌
  if (Object.values(HONOR_TILES).includes(tile)) {
    return TILE_SUITS.HONOR;
  }
  
  // 花牌
  if (Object.values(FLOWER_TILES).includes(tile)) {
    return 'f';
  }
  
  // 數字牌
  const match = tile.match(/^(\d+)([mps])$/);
  return match ? match[2] : null;
}

// 取得牌的數字（如果是數字牌）
function getNumber(tile) {
  if (typeof tile !== 'string') return null;
  
  const match = tile.match(/^(\d+)[mps]$/);
  return match ? parseInt(match[1]) : null;
}

// 檢查是否為字牌
function isHonor(tile) {
  return Object.values(HONOR_TILES).includes(tile);
}

// 檢查是否為花牌
function isFlower(tile) {
  return Object.values(FLOWER_TILES).includes(tile);
}

// 檢查是否為么九牌
function isTerminal(tile) {
  const num = getNumber(tile);
  return num === 1 || num === 9 || isHonor(tile);
}

// 排序手牌
function sortHand(hand) {
  return hand.sort((a, b) => {
    const suitA = getSuit(a);
    const suitB = getSuit(b);
    const order = { 'm': 0, 'p': 1, 's': 2, 'z': 3, 'f': 4 };
    
    if (suitA !== suitB) {
      return (order[suitA] || 99) - (order[suitB] || 99);
    }
    
    // 相同花色
    if (suitA === TILE_SUITS.HONOR) {
      const honorOrder = {
        [HONOR_TILES.EAST]: 0,
        [HONOR_TILES.SOUTH]: 1,
        [HONOR_TILES.WEST]: 2,
        [HONOR_TILES.NORTH]: 3,
        [HONOR_TILES.RED]: 4,
        [HONOR_TILES.GREEN]: 5,
        [HONOR_TILES.WHITE]: 6
      };
      return (honorOrder[a] || 99) - (honorOrder[b] || 99);
    }
    
    return getNumber(a) - getNumber(b);
  });
}

// 取得牌的名稱（用於顯示）
function getTileDisplay(tile) {
  const suit = getSuit(tile);
  const num = getNumber(tile);
  
  if (suit === TILE_SUITS.CHARACTER) return `${num}萬`;
  if (suit === TILE_SUITS.DOT) return `${num}筒`;
  if (suit === TILE_SUITS.BAMBOO) return `${num}條`;
  return tile; // 字牌或花牌
}

module.exports = {
  TILE_SUITS,
  HONOR_TILES,
  FLOWER_TILES,
  createDeck,
  shuffle,
  getSuit,
  getNumber,
  isHonor,
  isFlower,
  isTerminal,
  sortHand,
  getTileDisplay
};