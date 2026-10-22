let floorY, ball, cars = [], parts = [], pads = [], stars = [];
let score = [0, 0], state = 'play', freeze = 0, goalBy = -1;
let mode = 1, aiLevel = 1, paused = false, shake = 0;
const goalH = 170, WIN = 5;
const AI = [
  { name: 'Easy',   spd: 0.6,  boost: false },
  { name: 'Medium', spd: 0.85, boost: true  },
  { name: 'Hard',   spd: 1.15, boost: true  },
];
let btnPause, btnMode, btnAI, btnRestart;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  textFont('monospace');
  stars = Array.from({ length: 70 }, () => ({ x: random(), y: random(0.85), s: random(1, 2.4) }));

  btnPause   = makeBtn('⏸ Pause', 10, 90, togglePause);
  btnMode    = makeBtn('Mode: vs CPU', 108, 150, () => {
    mode = 3 - mode;
    btnMode.html(mode === 1 ? 'Mode: vs CPU' : 'Mode: 2 Players');
    restart();
  });
  btnAI      = makeBtn('CPU: Medium', 266, 110, () => {
    aiLevel = (aiLevel + 1) % AI.length;
    btnAI.html('CPU: ' + AI[aiLevel].name);
    restart();
  });
  btnRestart = makeBtn('↺ Restart', 384, 90, restart);
  restart();
}

function makeBtn(label, x, w, fn) {
  const b = createButton(label);
  b.position(x, 10);
  b.style('width', w + 'px');
  b.style('padding', '8px 0');
  b.style('background', '#1b1f3a');
  b.style('color', '#bde');
  b.style('border', '1px solid #4a5ad8');
  b.style('border-radius', '8px');
  b.style('cursor', 'pointer');
  b.style('font-family', 'monospace');
  b.mouseClicked(() => { fn(); b.elt.blur(); }); // blur so Space/Enter don't re-click it
  return b;
}

function togglePause() {
  paused = !paused;
  btnPause.html(paused ? '▶ Resume' : '⏸ Pause');
}

function makeCar(team) {
  const isAI = team === 1 && mode === 1;
  return {
    team, ai: isAI,
    x: width * (team === 0 ? 0.25 : 0.75), y: floorY - 20,
    vx: 0, vy: 0, a: team === 0 ? 0 : PI,
    ground: true, jumps: 2, boost: 100, lastJump: 0,
    maxSpd: isAI ? 7 * AI[aiLevel].spd : 7,
  };
}

function kickoff() {
  floorY = height - 50;
  pads = [0.12, 0.38, 0.62, 0.88].map(f => ({ x: width * f, cd: 0 }));
  cars = [makeCar(0), makeCar(1)];
  ball = { x: width / 2, y: floorY - 260, vx: 0, vy: 0, r: 28, rot: 0, trail: [] };
  parts = [];
  state = 'play';
  freeze = 0;
}

function restart() { score = [0, 0]; kickoff(); }

// ---------- input ----------
function humanInput(team) {
  let l, r, boost;
  if (team === 0) {
    l = keyIsDown(65) || (mode === 1 && keyIsDown(LEFT_ARROW));
    r = keyIsDown(68) || (mode === 1 && keyIsDown(RIGHT_ARROW));
    boost = keyIsDown(SHIFT) || (mode === 1 && keyIsDown(DOWN_ARROW));
  } else {
    l = keyIsDown(LEFT_ARROW);
    r = keyIsDown(RIGHT_ARROW);
    boost = keyIsDown(ENTER);
  }
  return { dir: (r ? 1 : 0) - (l ? 1 : 0), boost };
}

function keyPressed() {
  const k = key.toLowerCase();
  if (k === 'r') restart();
  if (k === 'p') togglePause();
  if (state === 'play' && !paused) {
    if (k === 'w' || key === ' ' || (mode === 1 && keyCode === UP_ARROW)) jump(cars[0]);
    if (mode === 2 && keyCode === UP_ARROW) jump(cars[1]);
  }
  if ([32, 37, 38, 39, 40].includes(keyCode)) return false; // stop page scrolling
}

function mousePressed() {
  if (state === 'over' && mouseY > 55) restart();
}

function jump(c) {
  if (c.ground)         { c.vy = -11; c.ground = false; c.jumps = 1; }
  else if (c.jumps > 0) { c.vy = -9;  c.jumps = 0; }
}

// ---------- CPU brain ----------
function aiInput(c) {
  const b = ball, cfg = AI[aiLevel];
  let dir = 0, boost = false;
  if (c.ground) {
    const wrong = c.x < b.x - 10; // CPU defends the right goal
    const tx = wrong ? min(width - 100, b.x + 150) : b.x + 40 + b.vx * 6;
    if (abs(c.x - tx) > 14) dir = tx > c.x ? 1 : -1;
    boost = cfg.boost && c.boost > 25 && abs(c.x - tx) > 260;
    if (abs(b.x - c.x) < 140 && b.y < floorY - 110 && b.y > floorY - 330 && frameCount - c.lastJump > 50) {
      jump(c); c.lastJump = frameCount;
    }
  } else {
    // in the air: aim the nose at the ball and rocket into it
    const want = atan2(b.y - c.y, b.x - c.x);
    const diff = ((want - c.a + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
    dir = abs(diff) > 0.12 ? Math.sign(diff) : 0;
    boost = cfg.boost && c.boost > 10 && abs(diff) < 0.45 && dist(c.x, c.y, b.x, b.y) < 450;
  }
  return { dir, boost };
}

// ---------- physics ----------
function updateCar(c, dir, boosting) {
  const on = boosting && c.boost > 0;

  if (c.ground) {
    c.vy = 0;
    if (dir !== 0) {
      c.a = dir > 0 ? 0 : PI;
      if (abs(c.vx) < c.maxSpd || Math.sign(c.vx) !== dir) c.vx += dir * 0.6;
    } else c.vx *= 0.94;
    if (abs(c.vx) > c.maxSpd && !on) c.vx *= 0.975;
  } else {
    c.vy += 0.45;
    c.a += dir * 0.09; // A/D rotate the car in mid-air
  }

  if (on) {
    c.vx += cos(c.a) * 0.75;
    c.vy += sin(c.a) * 0.75;
    c.boost -= 0.7;
    parts.push({
      x: c.x - cos(c.a) * 32, y: c.y - sin(c.a) * 32,
      vx: c.vx * 0.3 - cos(c.a) * 3 + random(-1, 1),
      vy: c.vy * 0.3 - sin(c.a) * 3 + random(-1, 1),
      life: 100, h: c.team === 0 ? 190 : 30, s: random(6, 11),
    });
  } else if (c.ground) c.boost = min(100, c.boost + 0.04);

  const sp = Math.hypot(c.vx, c.vy);
  if (sp > 15) { c.vx *= 15 / sp; c.vy *= 15 / sp; }

  c.x += c.vx; c.y += c.vy;
  if (c.x < 36)         { c.x = 36;         c.vx = 0; }
  if (c.x > width - 36) { c.x = width - 36; c.vx = 0; }
  if (c.y < 22)         { c.y = 22; c.vy = max(c.vy, 0); }
  if (c.y >= floorY - 20) {
    c.y = floorY - 20; c.vy = 0;
    if (!c.ground) { c.ground = true; c.jumps = 2; c.a = cos(c.a) >= 0 ? 0 : PI; }
  }
}

// returns the team that scored, or -1
function updateBall(b) {
  b.vy += 0.34; b.vx *= 0.9985; b.vy *= 0.999;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 24) { b.vx *= 24 / sp; b.vy *= 24 / sp; }
  b.x += b.vx; b.y += b.vy;
  b.rot += b.vx / b.r;

  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 16) b.trail.shift();

  if (b.y + b.r > floorY) {
    b.y = floorY - b.r; b.vy *= -0.72;
    if (abs(b.vy) < 1.3) b.vy = 0;
    b.vx *= 0.985;
  }
  if (b.y - b.r < 0) { b.y = b.r; b.vy = abs(b.vy) * 0.7; }

  const open = b.y > floorY - goalH; // ball is low enough to be "in the goal mouth"
  if (b.x - b.r < 0)     { if (open) return 1; b.x = b.r;         b.vx =  abs(b.vx) * 0.8; }
  if (b.x + b.r > width) { if (open) return 0; b.x = width - b.r; b.vx = -abs(b.vx) * 0.8; }
  return -1;
}

// each car is two circles (front + back) so tilting the car aims your hits
function collide(c, b) {
  for (const s of [-1, 1]) {
    const cx = c.x + cos(c.a) * 16 * s, cy = c.y + sin(c.a) * 16 * s;
    const dx = b.x - cx, dy = b.y - cy;
    const d = Math.hypot(dx, dy), minD = b.r + 20;
    if (d < minD && d > 0.001) {
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * minD; b.y = cy + ny * minD;
      const vn = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
      if (vn < 0) {
        const j = -(1 + 0.6) * vn + 1.0;
        b.vx += nx * j; b.vy += ny * j;
        c.vx -= nx * j * 0.12; c.vy -= ny * j * 0.12;
        if (-vn > 3) burst(b.x - nx * b.r, b.y - ny * b.r, 55, 6);
        if (-vn > 8) shake = max(shake, min(10, -vn * 0.6));
      }
    }
  }
}

function scoreGoal(team) {
  score[team]++;
  goalBy = team; freeze = 110; shake = 14;
  state = score[team] >= WIN ? 'over' : 'goal';
  burst(ball.x, ball.y, team === 0 ? 205 : 25, 70, 9);
}

function burst(x, y, h, n, s = 5) {
  for (let i = 0; i < n; i++)
    parts.push({ x, y, vx: random(-s, s), vy: random(-s, s), life: 100, h, s: random(3, 7) });
}

function update() {
  for (const c of cars) {
    const inp = c.ai ? aiInput(c) : humanInput(c.team);
    updateCar(c, inp.dir, inp.boost);
  }

  for (const p of pads) {
    if (p.cd > 0) p.cd--;
    for (const c of cars) {
      if (p.cd <= 0 && c.ground && abs(c.x - p.x) < 40 && c.boost < 100) {
        c.boost = min(100, c.boost + 50);
        p.cd = 420;
        burst(p.x, floorY - 6, 50, 12, 3);
      }
    }
  }

  const g = updateBall(ball);
  if (g >= 0) { scoreGoal(g); return; }
  for (const c of cars) collide(c, ball);
}

function updateParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.97; p.vy *= 0.97;
    p.life -= 4;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

// ---------- drawing ----------
function draw() {
  if (!paused) {
    if (state === 'play') update();
    else if (state === 'goal' && --freeze <= 0) kickoff();
    updateParts();
    shake *= 0.88;
  }

  push();
  if (shake > 0.5) translate(random(-shake, shake), random(-shake, shake));
  drawField();
  drawBall();
  cars.forEach(drawCar);
  drawParts();
  pop();

  drawHUD();
}

function drawField() {
  blendMode(BLEND);
  const g = drawingContext.createLinearGradient(0, 0, 0, floorY);
  g.addColorStop(0, '#080c26');
  g.addColorStop(1, '#1d2c63');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, floorY);

  noStroke(); fill(0, 0, 100, 70);
  for (const s of stars) circle(s.x * width, s.y * floorY, s.s);

  fill(150, 55, 22);
  rect(0, floorY, width, height - floorY);
  stroke(150, 70, 100); strokeWeight(3);
  line(0, floorY, width, floorY);

  stroke(0, 0, 100, 20); strokeWeight(2);
  line(width / 2, 0, width / 2, floorY);
  noFill();
  arc(width / 2, floorY, 240, 240, PI, TWO_PI);

  noStroke();
  for (const p of pads) {
    fill(50, 90, 100, p.cd <= 0 ? 90 : 15);
    rect(p.x - 30, floorY - 5, 60, 5, 2);
  }

  drawGoal(0, 205);
  drawGoal(width - 18, 25);
}

function drawGoal(x, h) {
  noStroke(); fill(h, 80, 100, 18);
  rect(x, floorY - goalH, 18, goalH);
  stroke(h, 80, 100, 60); strokeWeight(2);
  for (let y = floorY - goalH; y <= floorY; y += 20) line(x, y, x + 18, y);
  stroke(h, 60, 100); strokeWeight(5);
  line(x, floorY - goalH, x + 18, floorY - goalH);
}

function drawBall() {
  const b = ball;
  blendMode(ADD); noStroke();
  b.trail.forEach((t, i) => {
    fill(50, 60, 100, i * 1.2);
    circle(t.x, t.y, b.r * 1.6 * i / b.trail.length);
  });
  fill(50, 50, 100, 10);
  circle(b.x, b.y, b.r * 3.4);
  blendMode(BLEND);

  push();
  translate(b.x, b.y); rotate(b.rot);
  fill(0, 0, 100); stroke(0, 0, 25); strokeWeight(2);
  circle(0, 0, b.r * 2);
  fill(0, 0, 20); noStroke();
  beginShape();
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TWO_PI - HALF_PI;
    vertex(cos(a) * 10, sin(a) * 10);
  }
  endShape(CLOSE);
  stroke(0, 0, 25); strokeWeight(2);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TWO_PI - HALF_PI;
    line(cos(a) * 10, sin(a) * 10, cos(a) * b.r * 0.9, sin(a) * b.r * 0.9);
  }
  pop();
}

function drawCar(c) {
  const h = c.team === 0 ? 205 : 25;
  push();
  translate(c.x, c.y);
  rotate(c.a);
  if (cos(c.a) < 0) scale(1, -1); // keep the roof up when facing left
  noStroke();
  fill(h, 70, 95);  rect(-30, -14, 60, 22, 6);
  fill(h, 55, 100); rect(-12, -26, 30, 14, 5);
  fill(195, 25, 100, 85); rect(-4, -23, 18, 8, 3);
  fill(55, 20, 100); rect(24, -8, 6, 8, 2);
  fill(0, 0, 12); circle(-18, 12, 16); circle(18, 12, 16);
  fill(0, 0, 60); circle(-18, 12, 6); circle(18, 12, 6);
  pop();
}

function drawParts() {
  blendMode(ADD); noStroke();
  for (const p of parts) {
    fill(p.h, 80, 100, p.life * 0.8);
    circle(p.x, p.y, p.s * p.life / 100);
  }
  blendMode(BLEND);
}

function bar(c, x, h, label) {
  noStroke(); fill(0, 0, 100, 70); textSize(12); textAlign(LEFT, CENTER);
  text(label + '  BOOST', x, floorY + 14);
  fill(0, 0, 100, 15); rect(x, floorY + 24, 200, 12, 6);
  fill(h, 80, 100); rect(x, floorY + 24, 200 * c.boost / 100, 12, 6);
}

function drawHUD() {
  noStroke(); textAlign(CENTER, CENTER);
  textSize(46);
  fill(205, 70, 100); text(score[0], width / 2 - 60, 40);
  fill(0, 0, 100);    text(':', width / 2, 38);
  fill(25, 90, 100);  text(score[1], width / 2 + 60, 40);
  textSize(12); fill(0, 0, 100, 60);
  text(`First to ${WIN}`, width / 2, 74);

  bar(cars[0], 20, 205, mode === 1 ? 'YOU' : 'P1');
  bar(cars[1], width - 220, 25, mode === 1 ? 'CPU' : 'P2');

  textAlign(CENTER, CENTER); textSize(12); fill(0, 0, 100, 55);
  text(mode === 1
    ? 'A/D drive · W/Space jump (x2) · Shift boost · A/D rotate in the air · P pause'
    : 'P1: A/D W Shift   |   P2: ← → ↑ Enter',
    width / 2, floorY + 30);

  if (state === 'goal') {
    fill(goalBy === 0 ? 205 : 25, 80, 100); textSize(72);
    text('GOAL!', width / 2, height / 2 - 40);
  }
  if (state === 'over') {
    const name = goalBy === 0 ? 'BLUE' : 'ORANGE';
    fill(goalBy === 0 ? 205 : 25, 80, 100); textSize(60);
    text(name + ' WINS!', width / 2, height / 2 - 40);
    fill(0, 0, 100); textSize(20);
    text('Click or press R to play again', width / 2, height / 2 + 20);
  }
  if (paused) { fill(0, 0, 100); textSize(48); text('PAUSED', width / 2, height / 2); }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  kickoff(); // reposition everything, keep the score
}