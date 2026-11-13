let AppDB = null;
let currentUser = null;

// Инициализация при загрузке страницы
async function init() {
  await DB.init();
  AppDB = DB.get();

  const session = JSON.parse(localStorage.getItem('um_session'));
  if (session) {
    currentUser = session.name;
    showApp();
  }
}

document.getElementById('loginBtn').addEventListener('click', handleLogin);

// Обработка входа
async function handleLogin() {
  await DB.init();
  AppDB = DB.get();

  const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  const name = document.getElementById('playerNameInput').value.trim();

  if (!roomCode || !name) return alert('Заполните все поля');

  const room = AppDB.rooms.find(r => r.code === roomCode);
  if (!room) return alert('Комната не найдена. Проверьте код.');

  const roomPlayers = AppDB.players.filter(p => p.room_code === roomCode);
  const existing = roomPlayers.find(p => p.name === name);

  if (!existing && roomPlayers.length >= room.maxPlayers) {
    return alert('Комната заполнена!');
  }

  if (!existing) {
    AppDB.players.push({
      id: Date.now(),
      room_code: roomCode,
      name: name,
      score: 0,
      buchholz: 0,
      byes: 0,
      opponents: [],
      assigned_heroes: [],
      is_bot: false,
      bot_games: 0
    });
    DB.set(AppDB);
  }

  localStorage.setItem('um_session', JSON.stringify({ name, room: roomCode }));
  currentUser = name;

  showApp();
}

// Отрисовка основного экрана
function showApp() {
  AppDB = DB.get();
  const session = JSON.parse(localStorage.getItem('um_session'));
  if (!session) return;

  const room = AppDB.rooms.find(r => r.code === session.room);
  if (!room) {
    alert('Эта комната была удалена организатором.');
    localStorage.removeItem('um_session');
    location.reload();
    return;
  }

  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');

  document.getElementById('uiRoomCode').textContent = room.code;
  document.getElementById('uiRound').textContent = room.round;

  renderLeaderboard();
  renderMatch();
  renderHeroes();
}

// Выход
window.logout = function() {
  localStorage.removeItem('um_session');
  location.reload();
};

// Переключение вкладок
document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});

// --- РЕНДЕР ВКЛАДОК ---

function renderLeaderboard() {
  AppDB = DB.get();
  const session = JSON.parse(localStorage.getItem('um_session'));
  const players = AppDB.players
    .filter(p => p.room_code === session.room)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
      return (a.bot_games || 0) - (b.bot_games || 0);
    });

  const tbody = document.getElementById('leaderboardBody');
  if (players.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Пусто</td></tr>';
    return;
  }

  tbody.innerHTML = players.map((p, i) => `
    <tr class="${p.name === currentUser ? 'me' : ''}">
      <td>${i + 1}</td>
      <td>${p.name} ${p.is_bot ? '<span style="font-size:10px; color:var(--warning);">[БОТ]</span>' : ''}</td>
      <td><strong>${p.score}</strong></td>
      <td>${p.buchholz || 0}</td>
    </tr>
  `).join('');
}

function renderMatch() {
  AppDB = DB.get();
  const container = document.getElementById('matchContent');
  const session = JSON.parse(localStorage.getItem('um_session'));
  const room = AppDB.rooms.find(r => r.code === session.room);
  if (!room) return;

  const myMatch = AppDB.matches.find(m =>
    m.room_code === session.room &&
    m.round === room.round &&
    (m.p1 === currentUser || m.p2 === currentUser)
  );

  if (!myMatch) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">В этом раунде у вас нет матча. Ожидайте следующего.</p>`;
    return;
  }

  const isP1 = myMatch.p1 === currentUser;
  const opponent = isP1 ? myMatch.p2 : myMatch.p1;

  const p1First = myMatch.p1_goes_first === 'p1';
  const p2First = myMatch.p1_goes_first === 'p2';

  const myNameStyle = (isP1 && p1First) || (!isP1 && p2First)
    ? 'color: var(--primary); text-decoration: underline;'
    : '';
  const oppNameStyle = (isP1 && p2First) || (!isP1 && p1First)
    ? 'color: var(--primary); text-decoration: underline;'
    : '';

  container.innerHTML = `
    <div class="match-table-num" style="display: flex; justify-content: center; gap: 10px;">
      <span>Стол: <b>${myMatch.table}</b></span>
      <span>|</span>
      <span>Карта: <b>${myMatch.map_name}</b></span>
    </div>
    <div class="vs-block">
      <div class="player-block">
        <div class="player-name" style="${myNameStyle}">${currentUser}</div>
        ${(isP1 && p1First) || (!isP1 && p2First) ? '<div style="font-size:11px; color:var(--text-muted); margin-top:5px;">Ходит первым</div>' : ''}
      </div>
      <div class="vs-text">VS</div>
      <div class="player-block">
        <div class="player-name" style="${oppNameStyle}">${opponent}</div>
        ${(isP1 && p2First) || (!isP1 && p1First) ? '<div style="font-size:11px; color:var(--text-muted); margin-top:5px;">Ходит первым</div>' : ''}
      </div>
    </div>

    ${myMatch.p1_score !== null ? `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 32px; font-weight: bold; color: var(--warning); margin-bottom: 10px;">${myMatch.p1_score} : ${myMatch.p2_score}</div>
        <div style="color: var(--text-muted);">${myMatch.status === 'reported' ? 'Ожидайте подтверждения от админа' : 'Матч завершен'}</div>
      </div>
    ` : `
      <div class="actions-block">
        <p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-bottom: 10px;">Введите результат встречи</p>
        <button class="btn btn-win" onclick="reportResult(${myMatch.id}, 'p1_win')">Победа (2:0)</button>
        <button class="btn btn-draw" onclick="reportResult(${myMatch.id}, 'draw')">Ничья (1:1)</button>
        <button class="btn btn-lose" onclick="reportResult(${myMatch.id}, 'p2_win')">Поражение (0:2)</button>
      </div>
    `}
  `;
}

window.reportResult = function(matchId, type) {
  AppDB = DB.get();
  const match = AppDB.matches.find(m => m.id === matchId);
  if (!match) return;

  const isP1 = match.p1 === currentUser;

  if (type === 'p1_win') { match.p1_score = 2; match.p2_score = 0; }
  if (type === 'draw') { match.p1_score = 1; match.p2_score = 1; }
  if (type === 'p2_win') { match.p1_score = 0; match.p2_score = 2; }

  match.status = 'reported';
  DB.set(AppDB);
  renderMatch();
  alert('Результат отправлен! Админ увидит его и подтвердит.');
};

function renderHeroes() {
  AppDB = DB.get();
  const grid = document.getElementById('heroesGrid');
  const session = JSON.parse(localStorage.getItem('um_session'));
  const me = AppDB.players.find(p => p.room_code === session.room && p.name === currentUser);
  const myHeroes = me?.assigned_heroes || [];

  if (myHeroes.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted)">Админ еще не назначил вам героев.</p>';
    return;
  }

  const DEFAULT_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%2324242d"/><text x="50" y="50" font-family="Arial" font-size="40" fill="%238b8b99" text-anchor="middle" dominant-baseline="central">?</text></svg>';

  grid.innerHTML = myHeroes.map(heroName => {
    const hero = AppDB.heroes.find(h => h.name === heroName) || { name: heroName, image: '' };
    return `
      <div class="hero-card selected">
        <div class="hero-avatar" style="overflow: hidden;">
          ${hero.image ? `<img src="${hero.image}" onerror="this.src='${DEFAULT_IMG}'" style="width:100%; height:100%; object-fit:cover;">` : `<img src="${DEFAULT_IMG}" style="width:100%; height:100%; object-fit:cover;">`}
        </div>
        <div class="hero-name">${heroName}</div>
      </div>
    `;
  }).join('');
}

// Запуск
init();