// Основные переменные и константы
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Размеры стола
const TABLE_WIDTH = 900;
const TABLE_HEIGHT = 500;
const POCKET_RADIUS = 20; // Все лузы одинакового, чуть меньшего размера
const BALL_RADIUS = 16;

// Цвета
const COLORS = [
    '#ffffff', // биток
    '#ff0000', '#0000ff', '#ffff00', '#00ff00', '#ff00ff', '#00ffff', '#ffa500', '#8b4513', '#800080', '#008000'
];

// Позиции лунок
// Лузы чуть смещены внутрь стола для аккуратного вида
const POCKET_OFFSET = 22; // Смещение луз внутрь стола
const POCKETS = [
    {x: POCKET_OFFSET, y: POCKET_OFFSET}, // левый верхний угол
    {x: TABLE_WIDTH / 2, y: POCKET_OFFSET}, // центр верхнего борта
    {x: TABLE_WIDTH - POCKET_OFFSET, y: POCKET_OFFSET}, // правый верхний угол
    {x: POCKET_OFFSET, y: TABLE_HEIGHT - POCKET_OFFSET}, // левый нижний угол
    {x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - POCKET_OFFSET}, // центр нижнего борта
    {x: TABLE_WIDTH - POCKET_OFFSET, y: TABLE_HEIGHT - POCKET_OFFSET} // правый нижний угол
];

// Заглушка для шаров
let balls = [];


// --- Режим игры и ходы ---
let gameStarted = false;
let vsAI = false;
let currentTurn = 1;
const scores = { 1: 0, 2: 0 };
let shotShooter = null;
let pocketSnap = null;

const modeSelect = document.getElementById('modeSelect');
const player1ScoreEl = document.getElementById('player1Score');
const player2ScoreEl = document.getElementById('player2Score');
const turnInfoEl = document.getElementById('turnInfo');

function canHumanAim() {
    if (!gameStarted) return false;
    const cueBall = balls[0];
    if (!cueBall || cueBall.vx !== 0 || cueBall.vy !== 0) return false;
    if (vsAI && currentTurn !== 1) return false;
    return true;
}

function updateHud() {
    if (player1ScoreEl) player1ScoreEl.textContent = `Игрок 1: ${scores[1]}`;
    if (player2ScoreEl) {
        player2ScoreEl.textContent = vsAI
            ? `Компьютер: ${scores[2]}`
            : `Игрок 2: ${scores[2]}`;
    }
    if (turnInfoEl) {
        if (!gameStarted) turnInfoEl.textContent = 'Нажмите «Начать игру»';
        else if (vsAI && currentTurn === 2) turnInfoEl.textContent = 'Ход компьютера…';
        else if (vsAI && currentTurn === 1) turnInfoEl.textContent = 'Ваш ход';
        else turnInfoEl.textContent = currentTurn === 1 ? 'Ход: Игрок 1' : 'Ход: Игрок 2';
    }
}

function anyBallMoving() {
    const eps = 0.001;
    return balls.some(
        (b) => !b.pocketed && (Math.abs(b.vx) > eps || Math.abs(b.vy) > eps),
    );
}

function finalizeShotAfterStop() {
    if (shotShooter === null || pocketSnap === null) return;

    for (let i = 1; i < balls.length; i++) {
        if (balls[i].pocketed && !pocketSnap[i]) scores[shotShooter]++;
    }

    shotShooter = null;
    pocketSnap = null;

    currentTurn = currentTurn === 1 ? 2 : 1;
    updateHud();

    if (gameStarted && vsAI && currentTurn === 2 && !anyBallMoving()) queueComputerShot();
}

function strikeCue(angle, power, shooter) {
    const cueBall = balls[0];
    if (!cueBall || cueBall.vx !== 0 || cueBall.vy !== 0) return;
    shotShooter = shooter;
    pocketSnap = balls.map((b) => b.pocketed);

    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;
}

let aiShotTimer = null;
function queueComputerShot() {
    if (aiShotTimer) clearTimeout(aiShotTimer);
    aiShotTimer = setTimeout(() => {
        aiShotTimer = null;
        takeComputerShot();
    }, 500);
}

function takeComputerShot() {
    if (!gameStarted || !vsAI || currentTurn !== 2 || anyBallMoving()) return;

    const cue = balls[0];
    const targets = balls.filter((_, i) => i > 0 && !balls[i].pocketed);
    if (!targets.length || !cue) return;

    let bestGx = targets[0].x;
    let bestGy = targets[0].y;
    let bestDist = Infinity;

    for (const t of targets) {
        for (const p of POCKETS) {
            const ux = p.x - t.x;
            const uy = p.y - t.y;
            const len = Math.hypot(ux, uy);
            if (len < 1) continue;
            const nx = ux / len;
            const ny = uy / len;
            const gx = t.x - nx * (BALL_RADIUS * 2 + 1);
            const gy = t.y - ny * (BALL_RADIUS * 2 + 1);
            const dx = gx - cue.x;
            const dy = gy - cue.y;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                bestGx = gx;
                bestGy = gy;
            }
        }
    }

    let angle = Math.atan2(bestGy - cue.y, bestGx - cue.x);
    angle += (Math.random() - 0.5) * 0.12;
    const power = Math.min(
        24,
        11 + Math.random() * 9,
    );

    strikeCue(angle, power, 2);
}

// Управление мышью: прицеливание и удар
let isAiming = false;
let aimStart = null;
let aimEnd = null;


canvas.addEventListener('mousedown', (e) => {
    if (!canHumanAim()) return;
    // Проверяем, что биток остановился
    const cueBall = balls[0];
    isAiming = true;
    const rect = canvas.getBoundingClientRect();
    aimStart = {
        x: cueBall.x,
        y: cueBall.y
    };
    aimEnd = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
});

canvas.addEventListener('mousemove', (e) => {
    if (!isAiming || !canHumanAim()) return;
    const rect = canvas.getBoundingClientRect();
    aimEnd = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
});

// Удар по шару при отпускании мыши
canvas.addEventListener('mouseup', (e) => {
    if (!isAiming) return;
    isAiming = false;
    const cueBall = balls[0];
    // Проверяем, что биток остановился и ход наш
    if (!cueBall || cueBall.vx !== 0 || cueBall.vy !== 0) return;
    if (!canHumanAim()) return;
    // Сила удара — длина линии (ограничим максимум)
    const dx = aimEnd.x - aimStart.x;
    const dy = aimEnd.y - aimStart.y;
    let power = Math.sqrt(dx*dx + dy*dy) / 6;
    power = power * 4; // Увеличиваем силу удара в 4 раза относительно исходной формулы
    power = Math.min(power, 28); // Поднимаем максимум, чтобы удары были реально сильными
    if (power < 0.15) return;
    // Направление
    const angle = Math.atan2(dy, dx);
    strikeCue(angle, power, currentTurn);
});

function drawAimLine() {
    const cueBall = balls[0];
    if (isAiming && aimStart && aimEnd) {
        // При прицеливании — кий и линия
        drawCueStick(aimStart, aimEnd);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(aimStart.x, aimStart.y);
        ctx.lineTo(aimEnd.x, aimEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    } else if (cueBall && cueBall.vx === 0 && cueBall.vy === 0 && canHumanAim()) {
        // Если биток остановлен — показываем кий вправо (только когда человек может бить)
        const defaultAim = {x: cueBall.x + 80, y: cueBall.y};
        drawCueStick({x: cueBall.x, y: cueBall.y}, defaultAim);
    }
}

function drawCueStick(aimStart, aimEnd) {
    if (!aimStart || !aimEnd) return;
    const cueBall = balls[0];
    // Направление от битка к мыши или по умолчанию
    const dx = aimEnd.x - aimStart.x;
    const dy = aimEnd.y - aimStart.y;
    const angle = Math.atan2(dy, dx);
    // Длина кия
    const stickLen = 140;
    // Кий рисуем позади битка
    const stickX1 = cueBall.x - Math.cos(angle) * (BALL_RADIUS + 10);
    const stickY1 = cueBall.y - Math.sin(angle) * (BALL_RADIUS + 10);
    const stickX2 = cueBall.x - Math.cos(angle) * (BALL_RADIUS + stickLen);
    const stickY2 = cueBall.y - Math.sin(angle) * (BALL_RADIUS + stickLen);

    ctx.save();
    // 1. Тень от кия
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(stickX1 + 3, stickY1 + 3);
    ctx.lineTo(stickX2 + 3, stickY2 + 3);
    ctx.stroke();
    ctx.restore();

    // 2. Градиент дерева
    const grad = ctx.createLinearGradient(stickX1, stickY1, stickX2, stickY2);
    grad.addColorStop(0, '#f5deb3'); // светлый кончик
    grad.addColorStop(0.1, '#fffbe6'); // мел
    grad.addColorStop(0.13, '#deb887'); // дерево
    grad.addColorStop(0.7, '#a0522d'); // тёмное дерево
    grad.addColorStop(1, '#654321'); // рукоятка
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(stickX1, stickY1);
    ctx.lineTo(stickX2, stickY2);
    ctx.stroke();

    // 3. Наконечник (мел)
    ctx.save();
    ctx.beginPath();
    ctx.arc(stickX2, stickY2, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fffbe6';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();

    ctx.restore();
}

// --- Улучшенный внешний вид стола ---
function drawTable() {
    // Стол
    ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    // Сукно с красивым градиентом
    let grad = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
    grad.addColorStop(0, '#3fa34d');
    grad.addColorStop(0.5, '#2e8b57');
    grad.addColorStop(1, '#20603d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);


    // Тонкие борта
    ctx.save();
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(TABLE_WIDTH-5, 5);
    ctx.lineTo(TABLE_WIDTH-5, TABLE_HEIGHT-5);
    ctx.lineTo(5, TABLE_HEIGHT-5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Лунки с тенью
    for (const p of POCKETS) {
        ctx.save();
        // Внешнее мягкое свечение
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_RADIUS + 6, 0, Math.PI * 2);
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        // Тень лузы
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_RADIUS + 2, 0, Math.PI * 2);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.globalAlpha = 1;
        // Основная часть лузы — аккуратный градиент
        let grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, POCKET_RADIUS);
        grad.addColorStop(0, '#555');
        grad.addColorStop(0.7, '#222');
        grad.addColorStop(1, '#000');
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }
}

// --- Красивые шары с тенями ---
function drawBalls() {
    for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (b.pocketed) continue;
        // Тень
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(b.x + 4, b.y + 8, BALL_RADIUS * 0.9, BALL_RADIUS * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        // Градиент шара
        let grad = ctx.createRadialGradient(b.x - 6, b.y - 6, BALL_RADIUS * 0.3, b.x, b.y, BALL_RADIUS);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, COLORS[i % COLORS.length]);
        grad.addColorStop(1, '#222');
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}


// --- Красивая расстановка шаров треугольником ---
function initBalls() {
    balls = [];
    // Биток
    balls.push({x: 200, y: TABLE_HEIGHT / 2, vx: 0, vy: 0, pocketed: false});
    // Треугольник из 7 шаров
    let startX = 650;
    let startY = TABLE_HEIGHT / 2;
    let colorIdx = 1;
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col <= row; col++) {
            balls.push({
                x: startX + row * (BALL_RADIUS * 2 + 2),
                y: startY + (col - row / 2) * (BALL_RADIUS * 2 + 2),
                vx: 0,
                vy: 0,
                pocketed: false
            });
            colorIdx++;
        }
    }
}

function updateBalls() {
    // Простое движение и замедление
    for (let b of balls) {
        if (b.pocketed) continue;
        b.x += b.vx;
        b.y += b.vy;
        // Трение
        b.vx *= 0.98;
        b.vy *= 0.98;
        // Если скорость очень маленькая — остановить
        if (Math.abs(b.vx) < 0.05) b.vx = 0;
        if (Math.abs(b.vy) < 0.05) b.vy = 0;
    }

    // Проверка попадания в лузы (ШАГ 1: собрать индексы шаров, которые нужно удалить)
    let ballsToPocket = [];
    for (let i = 0; i < balls.length; i++) {
        let b = balls[i];
        if (b.pocketed) continue;
        for (const p of POCKETS) {
            let dx = b.x - p.x;
            let dy = b.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < POCKET_RADIUS - BALL_RADIUS * 0.2) {
                ballsToPocket.push(i);
                break;
            }
        }
    }
    // ШАГ 2: удалить шары из игры
    for (let idx of ballsToPocket) {
        let b = balls[idx];
        if (idx === 0) {
            // Биток возвращаем на исходную позицию
            b.x = 200;
            b.y = TABLE_HEIGHT / 2;
            b.vx = 0;
            b.vy = 0;
        } else {
            b.pocketed = true;
            b.vx = 0;
            b.vy = 0;
        }
    }

    // Столкновения шаров
    for (let i = 0; i < balls.length; i++) {
        let a = balls[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < balls.length; j++) {
            let b = balls[j];
            if (b.pocketed) continue;
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < BALL_RADIUS * 2 && dist > 0) {
                // Минимальное смещение для разделения шаров
                let overlap = BALL_RADIUS * 2 - dist;
                let nx = dx / dist;
                let ny = dy / dist;
                a.x -= nx * overlap / 2;
                a.y -= ny * overlap / 2;
                b.x += nx * overlap / 2;
                b.y += ny * overlap / 2;
                // Обмен скоростями вдоль линии столкновения
                let dvx = b.vx - a.vx;
                let dvy = b.vy - a.vy;
                let impact = dvx * nx + dvy * ny;
                if (impact < 0) {
                    let impulse = impact;
                    a.vx += nx * impulse;
                    a.vy += ny * impulse;
                    b.vx -= nx * impulse;
                    b.vy -= ny * impulse;
                }
            }
        }
    }

    // Реалистичный отскок от стен с потерей энергии
    const bounceLoss = 0.7;
    for (let b of balls) {
        if (b.pocketed) continue;
        if (b.x - BALL_RADIUS < 18) {
            b.x = 18 + BALL_RADIUS;
            b.vx *= -bounceLoss;
        }
        if (b.x + BALL_RADIUS > TABLE_WIDTH - 18) {
            b.x = TABLE_WIDTH - 18 - BALL_RADIUS;
            b.vx *= -bounceLoss;
        }
        if (b.y - BALL_RADIUS < 18) {
            b.y = 18 + BALL_RADIUS;
            b.vy *= -bounceLoss;
        }
        if (b.y + BALL_RADIUS > TABLE_HEIGHT - 18) {
            b.y = TABLE_HEIGHT - 18 - BALL_RADIUS;
            b.vy *= -bounceLoss;
        }
    }

    if (gameStarted && shotShooter !== null && !anyBallMoving()) finalizeShotAfterStop();
}

function gameLoop() {
    updateBalls();
    drawTable();
    drawBalls();
    drawAimLine();
    // updateHitButtonState(); // теперь вызывается из updateBalls
    requestAnimationFrame(gameLoop);
}

// Инициализация
window.onload = function() {
    initBalls();
    updateHud();
    gameLoop();
};

// TODO: добавить управление, физику столкновений, UI, AI и т.д.

// --- ИИ-ассистент ---
const assistantMessages = document.getElementById('assistantMessages');
const helpBtn = document.getElementById('helpBtn');

function assistantSay(msg) {
    if (!assistantMessages) return;
    assistantMessages.innerHTML += `<div style="margin:4px 0;">${msg}</div>`;
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

if (helpBtn) {
    helpBtn.addEventListener('click', () => {
        assistantSay('Правила: <br>1. Цель — забить все цветные шары.<br>2. Наведи мышку на биток, потяни — появится линия удара.<br>3. Отпусти мышь — шар ударит.<br>4. Ходы по очереди. <br>5. Побеждает тот, кто забьёт больше шаров.');
    });
}

// Пример советов во время игры (можно расширить)
function showTurnAdvice(player) {
    if (player === 1) {
        assistantSay('Ход Игрока 1. Совет: прицелься в ближайший шар, чтобы забить его в лузу.');
    } else {
        assistantSay('Ход Игрока 2. Совет: оцени позицию шаров и выбери оптимальный удар.');
    }
}

// Для примера — показываем совет при старте игры
const startBtn = document.getElementById('startBtn');
if (startBtn) {
    startBtn.addEventListener('click', () => {
        scores[1] = 0;
        scores[2] = 0;
        vsAI = modeSelect && modeSelect.value === 'ai';
        gameStarted = true;
        currentTurn = 1;
        shotShooter = null;
        pocketSnap = null;
        if (aiShotTimer) clearTimeout(aiShotTimer);
        aiShotTimer = null;
        isAiming = false;

        initBalls();
        updateHud();

        assistantSay(
            vsAI
                ? 'Режим против компьютера. Вы бьёте первыми; после остановки шаров ход переходит ИИ.'
                : 'Два игрока по очереди: тяните от бита и отпускайте мышь.'
        );

        showTurnAdvice(1);
        if (!anyBallMoving() && vsAI && currentTurn === 2) queueComputerShot();
    });
}
