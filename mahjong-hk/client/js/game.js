// 遊戲主邏輯
let gameRenderer;
let gameState = null;
let myPosition = -1;
let myHand = [];
let myMelds = [];
let myFlowers = [];
let currentPlayer = -1;
let lastDiscard = null;
let availableActions = [];

function startGame(data) {
    console.log('遊戲開始', data);
    
    myPosition = data.position;
    myHand = data.hand;
    myMelds = [];
    myFlowers = [];
    currentPlayer = data.currentPlayer;
    
    gameState = {
        hands: {},
        melds: {},
        discards: data.discards || {},
        flowers: {},
        winds: { [myPosition]: data.wind },
        scores: data.scores,
        currentPlayer: data.currentPlayer,
        lastDiscard: data.lastDiscard,
        wallSize: data.wallSize || 68
    };
    
    gameState.hands[myPosition] = myHand;
    
    // 切換到遊戲畫面
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    
    // 初始化渲染器
    gameRenderer = new MahjongRenderer('game-canvas');
    
    // 開始遊戲循環
    requestAnimationFrame(gameLoop);
    
    // 更新UI
    updateGameInfo();
}

function gameLoop() {
    if (gameRenderer && gameState) {
        gameRenderer.renderGame(gameState, myPosition);
    }
    requestAnimationFrame(gameLoop);
}

function updatePublicState(data) {
    if (!gameState) return;
    
    gameState.discards = data.discards;
    gameState.currentPlayer = data.currentPlayer;
    gameState.wallSize = data.wallSize;
    
    updateGameInfo();
}

function handleGameUpdate(data) {
    console.log('遊戲更新', data);
    
    if (!gameState) return;
    
    switch(data.type) {
        case 'DISCARD':
            handleDiscardUpdate(data);
            break;
        case 'PONG':
            handlePongUpdate(data);
            break;
        case 'CHOW':
            handleChowUpdate(data);
            break;
        case 'KONG':
            handleKongUpdate(data);
            break;
        case 'MAHJONG':
            handleMahjongUpdate(data);
            break;
    }
    
    // 更新當前玩家
    if (data.currentPlayer !== undefined) {
        currentPlayer = data.currentPlayer;
        gameState.currentPlayer = currentPlayer;
    }
    
    // 更新手牌
    if (data.hand !== undefined && data.player === myPosition) {
        myHand = data.hand;
        gameState.hands[myPosition] = myHand;
    }
    
    // 更新副露
    if (data.melds) {
        gameState.melds = data.melds;
    }
    
    // 更新棄牌區
    if (data.discards) {
        gameState.discards = data.discards;
    }
    
    // 更新最後打的牌
    if (data.tile && data.player !== undefined) {
        lastDiscard = {
            tile: data.tile,
            player: data.player
        };
        gameState.lastDiscard = lastDiscard;
    }
    
    // 檢查是否需要顯示動作按鈕
    if (data.reactions && data.player !== myPosition) {
        checkMyReactions(data.reactions);
    }
    
    // 如果是我的回合，更新動作按鈕
    if (currentPlayer === myPosition) {
        updateActionButtons();
    }
    
    updateGameInfo();
}

function handleDiscardUpdate(data) {
    console.log(`玩家 ${data.player} 打出 ${data.tile}`);
    
    // 如果有抽牌，更新手牌
    if (data.drawnTile && data.player === myPosition) {
        myHand.push(data.drawnTile);
        myHand.sort((a, b) => a.localeCompare(b));
    }
}

function handlePongUpdate(data) {
    console.log(`玩家 ${data.player} 碰了 ${data.tile}`);
    
    if (data.player === myPosition) {
        // 更新我的手牌和副露
        myMelds.push({
            type: 'pong',
            tiles: [data.tile, data.tile, data.tile],
            from: data.from
        });
    }
}

function handleChowUpdate(data) {
    console.log(`玩家 ${data.player} 吃了 ${data.tiles}`);
    
    if (data.player === myPosition) {
        // 更新我的手牌和副露
        myMelds.push({
            type: 'chow',
            tiles: data.tiles,
            from: data.from
        });
    }
}

function handleKongUpdate(data) {
    console.log(`玩家 ${data.player} 槓了`);
}

function handleMahjongUpdate(data) {
    console.log(`玩家 ${data.player} 食糊！`);
    
    // 顯示食糊彈窗
    showWinModal(data);
}

function checkMyReactions(reactions) {
    // 檢查是否有我可以做的動作
    const myReaction = reactions.find(r => r.player === myPosition);
    
    if (myReaction) {
        availableActions = myReaction.actions;
        updateActionButtons();
        
        // 如果只有食糊選項，自動食糊
        if (availableActions.length === 1 && availableActions[0] === 'MAHJONG') {
            setTimeout(() => {
                sendAction('MAHJONG');
            }, 500);
        }
    } else {
        // 沒有我可以做的動作，自動過
        setTimeout(() => {
            sendAction('PASS');
        }, 1000);
    }
}

function updateActionButtons() {
    const isMyTurn = currentPlayer === myPosition;
    
    document.getElementById('btn-chow').disabled = !isMyTurn && !availableActions.includes('CHOW');
    document.getElementById('btn-pong').disabled = !isMyTurn && !availableActions.includes('PONG');
    document.getElementById('btn-kong').disabled = !isMyTurn && !availableActions.includes('KONG');
    document.getElementById('btn-mahjong').disabled = !isMyTurn && !availableActions.includes('MAHJONG');
    document.getElementById('btn-pass').disabled = !isMyTurn && !(availableActions.length > 0);
    
    // 如果是我的回合，啟用打牌功能
    if (isMyTurn) {
        enableTileSelection();
    }
}

function updateGameInfo() {
    const windDisplay = document.getElementById('wind-display');
    const scoresDisplay = document.getElementById('scores-display');
    const wallDisplay = document.getElementById('wall-size');
    
    if (gameState) {
        const winds = ['東', '南', '西', '北'];
        windDisplay.innerHTML = `圈風: ${gameState.roundWind || '東'} | 門風: ${winds[myPosition]}`;
        
        let scoresText = '分數: ';
        if (gameState.scores) {
            scoresText += Object.values(gameState.scores).join(' | ');
        }
        scoresDisplay.textContent = scoresText;
        
        wallDisplay.textContent = `剩餘牌: ${gameState.wallSize || 0}`;
    }
}

function enableTileSelection() {
    // 在renderer中實現牌選中功能
    if (gameRenderer) {
        gameRenderer.enableTileSelection((tile) => {
            sendAction('DISCARD', tile);
        });
    }
}

function sendAction(action, tile, targetPosition) {
    if (!socket || !currentRoom) return;
    
    socket.emit('playerAction', {
        roomId: currentRoom,
        action: action,
        tile: tile,
        targetPosition: targetPosition || lastDiscard?.player
    });
    
    // 清空可用動作
    availableActions = [];
    updateActionButtons();
}

function showWinModal(data) {
    const modal = document.getElementById('win-modal');
    const details = document.getElementById('win-details');
    const total = document.getElementById('win-total');
    
    let html = '';
    data.fanDetails.forEach(detail => {
        html += `<div class="win-detail-item">${detail.name}: ${detail.fan}番</div>`;
    });
    
    details.innerHTML = html;
    total.textContent = `總共 ${data.totalFan} 番`;
    
    modal.style.display = 'flex';
}

function closeWinModal() {
    document.getElementById('win-modal').style.display = 'none';
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    connectSocket();
});