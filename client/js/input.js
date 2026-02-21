// 輸入處理
document.addEventListener('DOMContentLoaded', () => {
    // 綁定動作按鈕
    document.getElementById('btn-chow').addEventListener('click', () => {
        if (availableActions.includes('CHOW') && lastDiscard) {
            sendAction('CHOW', lastDiscard.tile);
        }
    });
    
    document.getElementById('btn-pong').addEventListener('click', () => {
        if (availableActions.includes('PONG') && lastDiscard) {
            sendAction('PONG', lastDiscard.tile);
        }
    });
    
    document.getElementById('btn-kong').addEventListener('click', () => {
        if (availableActions.includes('KONG') && lastDiscard) {
            sendAction('KONG', lastDiscard.tile);
        } else {
            // 暗槓
            sendAction('KONG');
        }
    });
    
    document.getElementById('btn-mahjong').addEventListener('click', () => {
        if (availableActions.includes('MAHJONG')) {
            if (lastDiscard) {
                sendAction('MAHJONG', lastDiscard.tile);
            } else {
                sendAction('MAHJONG');
            }
        }
    });
    
    document.getElementById('btn-pass').addEventListener('click', () => {
        sendAction('PASS');
    });
    
    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
        if (!gameState) return;
        
        switch(e.key.toLowerCase()) {
            case '1':
            case 'c':
                document.getElementById('btn-chow').click();
                break;
            case '2':
            case 'p':
                document.getElementById('btn-pong').click();
                break;
            case '3':
            case 'k':
                document.getElementById('btn-kong').click();
                break;
            case '4':
            case 'm':
                document.getElementById('btn-mahjong').click();
                break;
            case '5':
            case ' ':
            case 'escape':
                document.getElementById('btn-pass').click();
                break;
        }
    });
});

// 工具函數
function getWindSymbol(position) {
    const winds = ['東', '南', '西', '北'];
    return winds[position] || '';
}

function formatScore(score) {
    return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function playSound(soundName) {
    // 可以加聲音效果
    console.log('播放聲音:', soundName);
}

// 錯誤處理
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('錯誤:', msg, '\n位置:', url, lineNo, columnNo);
    return false;
};