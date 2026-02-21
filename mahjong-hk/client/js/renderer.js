class MahjongRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.tileImages = {};
        this.selectedTileIndex = -1;
        this.onTileClick = null;
        
        // 牌桌尺寸
        this.tableWidth = 1200;
        this.tableHeight = 700;
        
        // 牌尺寸
        this.tileWidth = 35;
        this.tileHeight = 45;
        
        // 加載圖片（如果沒有圖片，使用文字渲染）
        this.useImages = false;
    }
    
    renderGame(gameState, myPosition) {
        this.clearCanvas();
        this.renderTable();
        this.renderPlayers(gameState, myPosition);
        this.renderDiscards(gameState.discards);
        this.renderMelds(gameState.melds, myPosition);
        this.renderHand(gameState.hands[myPosition], 400, 600);
        this.renderGameInfo(gameState);
        
        // 如果有食糊信息，顯示
        if (gameState.winInfo) {
            this.renderWinInfo(gameState.winInfo);
        }
    }
    
    renderTable() {
        // 牌桌背景
        this.ctx.fillStyle = '#2a6f2a';
        this.ctx.fillRect(0, 0, this.tableWidth, this.tableHeight);
        
        // 桌布紋理
        this.ctx.strokeStyle = '#1a4f1a';
        this.ctx.lineWidth = 2;
        
        // 畫格子
        for (let i = 0; i < this.tableWidth; i += 50) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#1a4f1a';
            this.ctx.lineWidth = 0.5;
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.tableHeight);
            this.ctx.stroke();
        }
        
        for (let i = 0; i < this.tableHeight; i += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.tableWidth, i);
            this.ctx.stroke();
        }
        
        // 中間圓圈
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#d4a373';
        this.ctx.lineWidth = 3;
        this.ctx.arc(600, 350, 150, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    renderPlayers(gameState, myPosition) {
        const positions = [
            { name: '下家', x: 900, y: 450, angle: 0 }, // 南
            { name: '對家', x: 600, y: 150, angle: 180 }, // 西
            { name: '上家', x: 300, y: 450, angle: 0 }  // 北
        ];
        
        const winds = ['東', '南', '西', '北'];
        
        // 渲染其他玩家
        for (let i = 1; i <= 3; i++) {
            const pos = (myPosition + i) % 4;
            const renderPos = positions[i-1];
            const player = gameState.players ? gameState.players[pos] : null;
            
            // 玩家名稱和風位
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 4;
            
            const playerName = player ? player.name : '等待中';
            this.ctx.fillText(`${winds[pos]} ${playerName}`, renderPos.x - 50, renderPos.y - 40);
            
            // 手牌張數（背面）
            const handSize = gameState.hands && gameState.hands[pos] ? gameState.hands[pos].length : 13;
            this.renderBackTiles(renderPos.x, renderPos.y, handSize, renderPos.angle);
            
            // 當前玩家標記
            if (gameState.currentPlayer === pos) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = 'gold';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([5, 5]);
                this.ctx.strokeRect(renderPos.x - 20, renderPos.y - 30, handSize * 20 + 40, 60);
                this.ctx.setLineDash([]);
            }
            
            this.ctx.shadowBlur = 0;
        }
        
        // 渲染自己
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText(`${winds[myPosition]} ${playerName} (你)`, 400, 580);
    }
    
    renderBackTiles(x, y, count, angle) {
        for (let i = 0; i < count; i++) {
            // 牌背
            this.ctx.fillStyle = '#1a4f7a';
            this.ctx.fillRect(x + i * 20, y, 18, 25);
            
            // 邊框
            this.ctx.strokeStyle = '#0a2f4a';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + i * 20, y, 18, 25);
            
            // 花紋
            this.ctx.fillStyle = '#d4a373';
            this.ctx.beginPath();
            this.ctx.arc(x + i * 20 + 9, y + 12, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    renderHand(hand, startX, startY) {
        if (!hand || hand.length === 0) return;
        
        hand.sort((a, b) => a.localeCompare(b));
        
        for (let i = 0; i < hand.length; i++) {
            const tile = hand[i];
            const x = startX + i * (this.tileWidth + 2);
            const y = startY;
            
            // 牌面
            this.ctx.fillStyle = '#f8f9fa';
            this.ctx.fillRect(x, y, this.tileWidth, this.tileHeight);
            
            // 邊框
            this.ctx.strokeStyle = this.selectedTileIndex === i ? 'gold' : '#333';
            this.ctx.lineWidth = this.selectedTileIndex === i ? 3 : 1;
            this.ctx.strokeRect(x, y, this.tileWidth, this.tileHeight);
            
            // 牌面文字
            this.ctx.fillStyle = this.getTileColor(tile);
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(this.getTileDisplay(tile), x + 5, y + 28);
        }
        
        // 提示
        if (this.selectedTileIndex >= 0) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px Arial';
            this.ctx.fillText('點擊其他牌取消選擇，再點擊打牌', 400, 650);
        }
    }
    
    renderDiscards(discards) {
        if (!discards) return;
        
        const positions = [
            { x: 600, y: 500 }, // 下家棄牌
            { x: 350, y: 350 }, // 對家棄牌
            { x: 600, y: 200 }  // 上家棄牌
        ];
        
        let idx = 0;
        for (let i = 0; i < 4; i++) {
            if (i === 0) continue; // 跳過自己
            
            const playerDiscards = discards[i] || [];
            const pos = positions[idx++];
            
            // 顯示最近6張棄牌
            const recentDiscards = playerDiscards.slice(-6);
            
            recentDiscards.forEach((tile, j) => {
                const x = pos.x + j * 25;
                const y = pos.y;
                
                // 牌面
                this.ctx.fillStyle = '#f8f9fa';
                this.ctx.fillRect(x, y, 22, 30);
                this.ctx.strokeStyle = '#333';
                this.ctx.strokeRect(x, y, 22, 30);
                
                // 牌面文字
                this.ctx.fillStyle = this.getTileColor(tile);
                this.ctx.font = '12px Arial';
                this.ctx.fillText(this.getTileDisplay(tile), x + 3, y + 20);
            });
        }
    }
    
    renderMelds(melds, myPosition) {
        if (!melds) return;
        
        // 渲染自己的副露
        const myMelds = melds[myPosition] || [];
        for (let i = 0; i < myMelds.length; i++) {
            const meld = myMelds[i];
            const x = 100 + i * 120;
            const y = 500;
            
            if (meld.type === 'pong' || meld.type === 'kong') {
                // 刻子或槓
                for (let j = 0; j < (meld.type === 'kong' ? 4 : 3); j++) {
                    this.renderSmallTile(meld.tiles[0], x + j * 25, y);
                }
            } else if (meld.type === 'chow') {
                // 順子
                meld.tiles.forEach((tile, j) => {
                    this.renderSmallTile(tile, x + j * 25, y);
                });
            }
            
            // 標記來源
            if (meld.from !== undefined) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = '12px Arial';
                this.ctx.fillText(`從${['東','南','西','北'][meld.from]}來`, x, y - 15);
            }
        }
    }
    
    renderSmallTile(tile, x, y) {
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(x, y, 22, 30);
        this.ctx.strokeStyle = '#333';
        this.ctx.strokeRect(x, y, 22, 30);
        
        this.ctx.fillStyle = this.getTileColor(tile);
        this.ctx.font = '12px Arial';
        this.ctx.fillText(this.getTileDisplay(tile), x + 3, y + 20);
    }
    
    renderGameInfo(gameState) {
        // 牌牆大小
        if (gameState.wallSize !== undefined) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`剩餘牌: ${gameState.wallSize}`, 20, 100);
        }
        
        // 分數
        if (gameState.scores) {
            let y = 130;
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px Arial';
            
            for (const [playerId, score] of Object.entries(gameState.scores)) {
                this.ctx.fillText(`${playerId}: ${score}`, 20, y);
                y += 25;
            }
        }
        
        // 當前玩家
        if (gameState.currentPlayer !== undefined) {
            const winds = ['東', '南', '西', '北'];
            const currentWind = winds[gameState.currentPlayer];
            
            this.ctx.fillStyle = 'gold';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.fillText(`當前玩家: ${currentWind}家`, 20, 50);
        }
        
        // 最後打的牌
        if (gameState.lastDiscard) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`最後打出: ${this.getTileDisplay(gameState.lastDiscard.tile)}`, 20, 80);
        }
    }
    
    renderWinInfo(winInfo) {
        // 半透明背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(400, 200, 400, 300);
        
        this.ctx.fillStyle = 'gold';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillText('食糊！', 550, 250);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        
        winInfo.fanDetails.forEach((detail, index) => {
            this.ctx.fillText(`${detail.name}: ${detail.fan}番`, 450, 300 + index * 25);
        });
        
        this.ctx.fillStyle = 'yellow';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillText(`總共: ${winInfo.totalFan}番`, 550, 450);
    }
    
    getTileColor(tile) {
        if (!tile) return '#333';
        
        if (tile.includes('m')) return '#d32f2f'; // 萬子紅色
        if (tile.includes('p')) return '#2e7d32'; // 筒子綠色
        if (tile.includes('s')) return '#1976d2'; // 條子藍色
        
        // 字牌
        if (['東', '南', '西', '北'].includes(tile)) return '#7b1fa2'; // 風牌紫色
        if (['中', '發', '白'].includes(tile)) return '#f57c00'; // 箭牌橙色
        
        return '#333';
    }
    
    getTileDisplay(tile) {
        if (!tile) return '';
        
        if (tile.includes('m')) return tile.replace('m', '萬');
        if (tile.includes('p')) return tile.replace('p', '筒');
        if (tile.includes('s')) return tile.replace('s', '條');
        
        return tile;
    }
    
    enableTileSelection(callback) {
        this.onTileClick = callback;
        
        // 添加點擊事件
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 檢查是否點擊到手牌區域
            const hand = gameState?.hands[myPosition];
            if (!hand) return;
            
            const startX = 400;
            const startY = 600;
            
            for (let i = 0; i < hand.length; i++) {
                const tileX = startX + i * (this.tileWidth + 2);
                
                if (x >= tileX && x <= tileX + this.tileWidth &&
                    y >= startY && y <= startY + this.tileHeight) {
                    
                    if (this.selectedTileIndex === i) {
                        // 再次點擊同一張牌，打出
                        if (this.onTileClick) {
                            this.onTileClick(hand[i]);
                            this.selectedTileIndex = -1;
                        }
                    } else {
                        // 選擇新牌
                        this.selectedTileIndex = i;
                    }
                    break;
                }
            }
        });
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.tableWidth, this.tableHeight);
    }
}