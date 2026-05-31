const app = new PIXI.Application({
    width: 1200,
    height: 600,
    backgroundColor: 0x111111
});
document.getElementById('canvas-container').appendChild(app.view);

//DOM Elements
const uiScore = document.getElementById('ui-score');
const uiHp = document.getElementById('ui-hp');
const uiCoins = document.getElementById('ui-coins');
const mainMenu = document.getElementById('main-menu');
const shopMenu = document.getElementById('shop-menu');
const gameOverMenu = document.getElementById('game-over');
const finalScoreText = document.getElementById('final-score');
const earnedCoinsText = document.getElementById('earned-coins');

//-----Storage data-----\\
let globalCoins = parseInt(localStorage.getItem('coins')) || 0;
let upgrades = {
    hp: parseInt(localStorage.getItem('upg_hp')) || 0,
    dmg: parseInt(localStorage.getItem('upg_dmg')) || 0,
    spread: parseInt(localStorage.getItem('upg_spread')) || 0
};

const costs = { hp: 10, dmg: 15, spread: 50 };

function saveProgress() {
    localStorage.setItem('coins', globalCoins);
    localStorage.setItem('upg_hp', upgrades.hp);
    localStorage.setItem('upg_dmg', upgrades.dmg);
    localStorage.setItem('upg_spread', upgrades.spread);
}

//-----Texture loading-----\\
const texPlayerRun1 = PIXI.Texture.from('assets/player_1.png');
const texPlayerRun2 = PIXI.Texture.from('assets/player_2.png');
const texPlayerIdle1 = PIXI.Texture.from('assets/player_idle_1.png');
const texPlayerIdle2 = PIXI.Texture.from('assets/player_idle_2.png');

const texCrawlerRun1 = PIXI.Texture.from('assets/crawler_1.png');
const texCrawlerRun2 = PIXI.Texture.from('assets/crawler_2.png');
const texCrawlerIdle1 = PIXI.Texture.from('assets/crawler_idle_1.png');
const texCrawlerIdle2 = PIXI.Texture.from('assets/crawler_idle_2.png');

const texShooter1 = PIXI.Texture.from('assets/shooter_idle_1.png');
const texShooter2 = PIXI.Texture.from('assets/shooter_idle_2.png');

const texEnemyBullet = PIXI.Texture.from('assets/enemy_bullet.png');
const texBullet = PIXI.Texture.from('assets/bullet.png');
const texNest = PIXI.Texture.from('assets/nest.png');
const texPlatform = PIXI.Texture.from('assets/platform.png');
const texBgBack = PIXI.Texture.from('assets/bg_back.png');
const texBgMid = PIXI.Texture.from('assets/bg_mid.png');
const texGround = PIXI.Texture.from('assets/ground.png');

const graphics = new PIXI.Graphics();
graphics.beginFill(0xFFD700);
graphics.drawCircle(10, 10, 10);
const texCoin = app.renderer.generateTexture(graphics);

//Filter for harder enemies
const eliteFilter = new PIXI.filters.OutlineFilter(3, 0xFF0000);

//Scene Layers
const parallaxBack = new PIXI.TilingSprite(texBgBack, 1200, 600);
const parallaxMid = new PIXI.TilingSprite(texBgMid, 1200, 600);
const ground = new PIXI.TilingSprite(texGround, 1200, 50);
ground.y = 550;

const gameContainer = new PIXI.Container();
gameContainer.sortableChildren = true;
app.stage.addChild(parallaxBack, parallaxMid, ground, gameContainer);

//Player
const anims = {
    playerIdle: [texPlayerIdle1, texPlayerIdle2],
    playerRun: [texPlayerRun1, texPlayerRun2]
};

const player = new PIXI.AnimatedSprite(anims.playerIdle);
player.animationSpeed = 0.05;
player.play();
player.anchor.set(0.5, 0.5);
player.zIndex = 100;
gameContainer.addChild(player);

//-----Game Variables-----\\
const crawlers = [], nests = [], platforms = [], bullets = [], shooters = [], enemyBullets = [], droppedCoins = [];
const keys = {};

const gravity = 0.22;
const jumpForce = -8.0;
const moveAccel = 0.8;
const maxMoveSpeed = 5.5;
const friction = 0.82;

let frames = 0;
let score = 0;
let runCoins = 0;
let maxHp = 3 + upgrades.hp;
let hp = maxHp;
let isGameOver = true;
let gameStarted = false;
let lastPlatformY = ground.y;

let difficultyModifier = 0.8;
let currentScrollSpeed = 2.0;

let platTimer = 0;
let crawlerTimer = 0;
let nestTimer = 0;
let shakeTimer = 0;

//-----Input logic-----\\
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (isGameOver && e.code === 'Enter') {
        restartGame();
    }
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

//-----Menu logic-----\\
window.startGame = function() {
    mainMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    shopMenu.classList.add('hidden');
    resetGame();
};

window.openShop = function() {
    mainMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    shopMenu.classList.remove('hidden');
    updateShopUI();
};

window.closeShop = function() {
    shopMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
};

window.restartGame = function() {
    gameOverMenu.classList.add('hidden');
    resetGame();
};

window.buyUpgrade = function(type) {
    let cost = costs[type] * (upgrades[type] + 1);
    if (globalCoins >= cost) {
        globalCoins -= cost;
        upgrades[type]++;
        saveProgress();
        updateShopUI();
    }
};

//-----Helper functions-----\\
function updateShopUI() {
    document.getElementById('shop-coins').innerText = 'Your Coins: ' + globalCoins;
    document.getElementById('cost-hp').innerText = costs.hp * (upgrades.hp + 1);
    document.getElementById('cost-dmg').innerText = costs.dmg * (upgrades.dmg + 1);
    
    let spreadBtn = document.getElementById('cost-spread').parentElement;
    if (upgrades.spread >= 1) {
        spreadBtn.innerText = "Spread Shot Unlocked!";
        spreadBtn.disabled = true;
    } else {
        document.getElementById('cost-spread').innerText = costs.spread;
    }
}

function resetGame() {
    score = 0;
    runCoins = 0;
    frames = 0;
    maxHp = 3 + upgrades.hp;
    hp = maxHp;
    difficultyModifier = 0.8;
    platTimer = 0;
    crawlerTimer = 0;
    nestTimer = 0;
    lastPlatformY = ground.y;
    
    updateHUD();
    
    player.x = 100;
    player.y = 300;
    player.vy = 0;
    player.vx = 0;
    player.tint = 0xFFFFFF;
    player.tintTimer = 0;
    player.rotation = 0;

    [bullets, enemyBullets, crawlers, shooters, nests, platforms, droppedCoins].forEach(arr => {
        arr.forEach(s => gameContainer.removeChild(s));
        arr.length = 0;
    });

    isGameOver = false;
    gameStarted = true;
    player.play();
}

function updateHUD() {
    uiScore.innerText = 'Score: ' + score;
    uiHp.innerText = 'HP: ' + hp;
    uiCoins.innerText = 'Coins: ' + runCoins;
}

function takeDamage() {
    if (isGameOver) {
        return;
    }
    
    hp--;
    updateHUD();
    player.tint = 0xFF0000;
    player.tintTimer = 45;
    shakeTimer = 15;
    
    if (hp <= 0) {
        triggerGameOver();
    }
}

function healPlayer() {
    if (hp < maxHp) {
        hp++;
        updateHUD();
    }
    player.tint = 0x00FF00;
    player.tintTimer = 45;
}

function triggerGameOver() {
    isGameOver = true;
    player.tint = 0x555555;
    player.stop();
    globalCoins += runCoins;
    saveProgress();

    finalScoreText.innerText = 'Final Score: ' + score;
    earnedCoinsText.innerText = 'Coins Earned: ' + runCoins;
    gameOverMenu.classList.remove('hidden');
}

function checkCollision(obj1, obj2) {
    const b1 = obj1.getBounds();
    const b2 = obj2.getBounds();
    return b1.x < b2.x + b2.width && b1.x + b1.width > b2.x && b1.y < b2.y + b2.height && b1.y + b1.height > b2.y;
}

function spawnCoin(x, y) {
    const coin = new PIXI.Sprite(texCoin);
    coin.x = x;
    coin.y = y;
    coin.anchor.set(0.5);
    droppedCoins.push(coin);
    gameContainer.addChild(coin);
}

function processEnemyHit(enemyArray, index, bullet) {
    let e = enemyArray[index];
    e.hp -= bullet.dmg;
    e.tint = 0xFF0000;
    
    setTimeout(() => { 
        if (e) {
            e.tint = 0xFFFFFF;
        }
    }, 50);
    
    if (e.hp <= 0) {
        score += e.isElite ? 50 : 20;
        updateHUD();
        
        let dropChance = e.isElite ? 0.8 : 0.3;
        if (Math.random() < dropChance) {
            spawnCoin(e.x + e.width / 2, e.y + e.height / 2);
        }
        
        gameContainer.removeChild(e);
        enemyArray.splice(index, 1);
        return true;
    }
    return false;
}

//-----Game logic-----\\
app.ticker.add(() => {
    if (isGameOver || !gameStarted) {
        return;
    }
    frames++;

    if (shakeTimer > 0) {
        shakeTimer--;
        gameContainer.x = (Math.random() - 0.5) * 15;
        gameContainer.y = (Math.random() - 0.5) * 15;
    } else {
        gameContainer.x = 0;
        gameContainer.y = 0;
    }

    if (difficultyModifier < 2.5) {
        difficultyModifier += 0.0002;
    }
    currentScrollSpeed = 2.5 * difficultyModifier;

    parallaxBack.tilePosition.x -= currentScrollSpeed * 0.1;
    parallaxMid.tilePosition.x -= currentScrollSpeed * 0.6;
    ground.tilePosition.x -= currentScrollSpeed;

    if (player.tintTimer > 0) { 
        player.tintTimer--;
        if (player.tintTimer === 0) {
            player.tint = 0xFFFFFF;
        }
    }
    player.rotation = player.vy * 0.02;

    let onGround = false;
    if (!onGround && player.vy < 0 && !keys['ArrowUp'] && !keys['Space']) {
        player.vy += gravity * 1.8;
    } else {
        player.vy += gravity;
    }
    
    player.y += player.vy;

    let pBottom = player.y + (player.height / 2);
    let pLeft = player.x - (player.width / 2);
    let pRight = player.x + (player.width / 2);

    if (pBottom > ground.y) { 
        player.y = ground.y - (player.height / 2);
        player.vy = 0;
        onGround = true;
        player.rotation = 0;
    }

    platforms.forEach(plat => {
        if (player.vy >= 0 && pBottom >= plat.y && pBottom <= plat.y + player.vy + 2 && pRight > plat.x && pLeft < plat.x + plat.width) {
            player.y = plat.y - (player.height / 2);
            player.vy = 0;
            onGround = true;
            player.rotation = 0;
        }
    });

    if (keys['ArrowRight']) { 
        player.vx += moveAccel;
    } else if (keys['ArrowLeft']) { 
        player.vx -= moveAccel;
    } else { 
        player.vx *= friction;
    }

    if (player.vx > maxMoveSpeed) {
        player.vx = maxMoveSpeed;
    }
    if (player.vx < -maxMoveSpeed) {
        player.vx = -maxMoveSpeed;
    }
    if (Math.abs(player.vx) < 0.1) {
        player.vx = 0;
    }

    player.x += player.vx;

    if (player.x + (player.width / 2) > 600) { 
        player.x = 600 - (player.width / 2);
        player.vx = 0;
    }
    if (player.x - (player.width / 2) < 0) { 
        player.x = player.width / 2;
        player.vx = 0;
    }

    //Swap between animations
    if (Math.abs(player.vx) > 0.5 && onGround) {
        if (player.textures !== anims.playerRun) {
            player.textures = anims.playerRun;
            player.animationSpeed = 0.1;
            player.play();
        }
    } else if (onGround) {
        if (player.textures !== anims.playerIdle) {
            player.textures = anims.playerIdle;
            player.animationSpeed = 0.05;
            player.play();
        }
    } else {
        player.gotoAndStop(0);
    }

    if ((keys['ArrowUp'] || keys['Space']) && onGround) {
        player.vy = jumpForce;
    }

    if (keys['KeyZ'] && frames % 20 === 0) {
        let dmg = 1 + upgrades.dmg;
        if (upgrades.spread >= 1) {
            for (let v = -1.5; v <= 1.5; v += 1.5) {
                const b = new PIXI.Sprite(texBullet);
                b.x = player.x + 20;
                b.y = player.y + 5;
                b.vy = v;
                b.dmg = dmg;
                bullets.push(b);
                gameContainer.addChild(b);
            }
        } else {
            const b = new PIXI.Sprite(texBullet);
            b.x = player.x + 20;
            b.y = player.y + 5;
            b.vy = 0;
            b.dmg = dmg;
            bullets.push(b);
            gameContainer.addChild(b);
        }
    }

    //Spawner timers
    platTimer++;
    crawlerTimer++;
    nestTimer++;

    if (platTimer >= (150 / difficultyModifier)) {
        platTimer = 0;
        const plat = new PIXI.Sprite(texPlatform);
        plat.x = 1250;
        plat.y = Math.random() * ((ground.y - 40) - Math.max(200, lastPlatformY - 80)) + Math.max(200, lastPlatformY - 80);
        lastPlatformY = plat.y;
        platforms.push(plat);
        gameContainer.addChild(plat);

        if (Math.random() < (0.3 + (difficultyModifier * 0.1))) {
            const s = new PIXI.AnimatedSprite([texShooter1, texShooter2]);
            s.animationSpeed = 0.05;
            s.play();
            s.x = plat.x + 40;
            s.y = plat.y - 40;
            s.shootTimer = Math.random() * 60;
            
            if (Math.random() < 0.3) {
                s.hp = 6;
                s.filters = [eliteFilter];
                s.isElite = true;
            } else {
                s.hp = 2;
                s.isElite = false;
            }
            s.tintTimer = 0;
            shooters.push(s);
            gameContainer.addChild(s);
        }
    }

    if (frames % 500 === 0) {
        lastPlatformY = ground.y;
    }

    if (crawlerTimer >= (150 / difficultyModifier)) {
        crawlerTimer = 0;
        let isElite = Math.random() < 0.2;
        let bugAnims = isElite ? [texCrawlerIdle1, texCrawlerIdle2] : [texCrawlerRun1, texCrawlerRun2];
        
        const bug = new PIXI.AnimatedSprite(bugAnims);
        bug.animationSpeed = 0.05 * difficultyModifier;
        bug.play();
        bug.x = 1250;
        bug.y = ground.y - 40;
        
        if (isElite) {
            bug.hp = 4;
            bug.filters = [eliteFilter];
            bug.isElite = true;
            bug.scale.set(1.2);
        } else {
            bug.hp = 1;
            bug.isElite = false;
        }
        crawlers.push(bug);
        gameContainer.addChild(bug);
    }

    if (nestTimer >= (400 * difficultyModifier)) {
        nestTimer = 0;
        const nest = new PIXI.Sprite(texNest);
        nest.x = 1250;
        nest.y = ground.y - 40;
        nests.push(nest);
        gameContainer.addChild(nest);
    }

    //-----Collisions-----\\
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += 10;
        bullets[i].y += bullets[i].vy;
        
        if (bullets[i].x > 1250) { 
            gameContainer.removeChild(bullets[i]);
            bullets.splice(i, 1);
        }
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        enemyBullets[i].x += enemyBullets[i].vx;
        enemyBullets[i].y += enemyBullets[i].vy;
        
        if (checkCollision(player, enemyBullets[i])) { 
            takeDamage();
            gameContainer.removeChild(enemyBullets[i]);
            enemyBullets.splice(i, 1);
            continue;
        }
        
        if (enemyBullets[i].x < -50 || enemyBullets[i].y > 650) { 
            gameContainer.removeChild(enemyBullets[i]);
            enemyBullets.splice(i, 1);
        }
    }

    [platforms, droppedCoins].forEach(arr => {
        for (let i = arr.length - 1; i >= 0; i--) {
            arr[i].x -= currentScrollSpeed;
            if (arr[i].x < -140) { 
                gameContainer.removeChild(arr[i]);
                arr.splice(i, 1);
            }
        }
    });

    for (let i = droppedCoins.length - 1; i >= 0; i--) {
        if (checkCollision(player, droppedCoins[i])) {
            runCoins++;
            updateHUD();
            gameContainer.removeChild(droppedCoins[i]);
            droppedCoins.splice(i, 1);
        }
    }

    //Shooters Logic
    for (let i = shooters.length - 1; i >= 0; i--) {
        let s = shooters[i];
        s.x -= currentScrollSpeed;
        s.shootTimer++;
        
        if (s.shootTimer > (150 / difficultyModifier)) {
            s.shootTimer = 0;
            let predictedX = player.x + (player.vx * 15);
            let dx = predictedX - s.x;
            let dy = player.y - s.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let eb = new PIXI.Sprite(texEnemyBullet);
            
            eb.x = s.x + 15;
            eb.y = s.y + 15;
            eb.vx = (dx / dist) * 3.5 * difficultyModifier;
            eb.vy = (dy / dist) * 3.5 * difficultyModifier;
            
            enemyBullets.push(eb);
            gameContainer.addChild(eb);
        }
        
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (s && checkCollision(bullets[j], s)) {
                let died = processEnemyHit(shooters, i, bullets[j]);
                gameContainer.removeChild(bullets[j]);
                bullets.splice(j, 1);
                if (died) {
                    break;
                }
            }
        }
    }

    //Crawlers Logic
    for (let i = crawlers.length - 1; i >= 0; i--) {
        let c = crawlers[i];
        c.x -= (currentScrollSpeed + 0.5);
        
        if (checkCollision(player, c)) { 
            takeDamage();
            gameContainer.removeChild(c);
            crawlers.splice(i, 1);
            continue;
        }
        
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (c && checkCollision(bullets[j], c)) {
                let died = processEnemyHit(crawlers, i, bullets[j]);
                gameContainer.removeChild(bullets[j]);
                bullets.splice(j, 1);
                if (died) {
                    break;
                }
            }
        }
    }

    //-----Collision between Nests and Bullets-----\\
    for (let i = nests.length - 1; i >= 0; i--) {
        nests[i].x -= currentScrollSpeed;
        
        if (nests[i].x < -140) { 
            gameContainer.removeChild(nests[i]);
            nests.splice(i, 1);
            continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            if (nests[i] && checkCollision(bullets[j], nests[i])) {
                healPlayer();
                score += 5;
                updateHUD();
                gameContainer.removeChild(nests[i]);
                gameContainer.removeChild(bullets[j]);
                nests.splice(i, 1);
                bullets.splice(j, 1);
                break;
            }
        }
    }
});