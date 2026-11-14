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
    await DB.set(AppDB);
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
  document.getElementById('uiRound').textContent = room.round > room.totalRounds ? 'Завершен' : room.round;

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

// --- ТАЙМЕР АВТООБНОВЛЕНИЯ (КАЖДЫЕ 10 СЕКУНД) ---
setInterval(async () => {
  const session = JSON.parse(localStorage.getItem('um_session'));
  if (!session) return;

  try {
    await DB.init();
    AppDB = DB.get();
    renderLeaderboard();
    renderMatch();
    renderHeroes();
  } catch(e) {
    console.error("Ошибка при автообновлении:", e);
  }
}, 10000);

// --- РЕНДЕР ВКЛАДОК ---

function renderLeaderboard() {
  AppDB = DB.get();
  const session = JSON.parse(localStorage.getItem('um_session'));
  const room = AppDB.rooms.find(r => r.code === session.room);
  if (!room) return;

  const players = AppDB.players
    .filter(p => p.room_code === session.room)
    .sort((a, b) => {
      // Боты всегда внизу
      if (a.is_bot && !b.is_bot) return 1;
      if (!a.is_bot && b.is_bot) return -1;

      if (b.score !== a.score) return b.score - a.score;
      if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
      return (a.bot_games || 0) - (b.bot_games || 0);
    });

  const tbody = document.getElementById('leaderboardBody');
  const finalBtnContainer = document.getElementById('playerFinalBtnContainer');

  if (finalBtnContainer) {
    if (room.round > room.totalRounds) {
      finalBtnContainer.innerHTML = `<button onclick="showPlayerFinalStandings()" class="btn btn-primary" style="background: var(--yellow); color: var(--black); font-family: 'Bungee'; width: auto; display: block; margin: 0 auto 20px auto; padding: 10px 20px;">🏆 Посмотреть итоги турнира</button>`;
    } else {
      finalBtnContainer.innerHTML = '';
    }
  }

  if (players.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--muted);">Пусто</td></tr>';
    return;
  }

  tbody.innerHTML = players.map((p, i) => `
    <tr class="${p.name === currentUser ? 'me' : ''}">
      <td>${i + 1}</td>
      <td>
        ${p.name}
        ${p.is_bot ? '<span style="font-family: Bungee; font-size: 10px; color: var(--yellow); background: var(--black); padding: 2px 6px; border: 1px solid var(--yellow); margin-left: 8px;">БОТ</span>' : ''}
      </td>
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
    container.innerHTML = `<p style="color: var(--muted); text-align: center; padding: 20px;">В этом раунде у вас нет матча. Ожидайте следующего.</p>`;
    return;
  }

  const isP1 = myMatch.p1 === currentUser;
  const opponent = isP1 ? myMatch.p2 : myMatch.p1;

  // ЗЕРКАЛЬНОСТЬ: наши очки и очки соперника
  const myScore = isP1 ? myMatch.p1_score : myMatch.p2_score;
  const oppScore = isP1 ? myMatch.p2_score : myMatch.p1_score;

  let statusHtml = '';

  if (myScore === null) {
    statusHtml = `
      <div class="actions-block">
        <p style="text-align: center; color: var(--muted); font-size: 14px; margin-bottom: 10px;">Введите результат встречи:</p>
        <button class="btn btn-win" onclick="reportResult(${myMatch.id}, 'win')">Победа (2:0)</button>
        <button class="btn btn-draw" onclick="reportResult(${myMatch.id}, 'draw')">Ничья (1:1)</button>
        <button class="btn btn-lose" onclick="reportResult(${myMatch.id}, 'lose')">Поражение (0:2)</button>
      </div>
    `;
  } else {
    statusHtml = `
      <div style="text-align: center; padding: 20px; background: var(--surface-light); border: 2px solid var(--black);">
        <div style="font-size: 40px; font-family: 'Bebas Neue'; color: var(--yellow); margin-bottom: 10px; text-shadow: 2px 2px 0px var(--black);">${myScore} : ${oppScore}</div>
        <div style="color: var(--cyan); font-size: 14px;">Результат внесен</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="match-table-num" style="display: flex; justify-content: center; gap: 10px;">
      <span>Стол: <b style="color: var(--cyan);">${myMatch.table}</b></span>
      <span>|</span>
      <span>Карта: <b style="color: var(--cyan);">${myMatch.map_name}</b></span>
    </div>

    <div class="vs-block">
      <div class="player-block">
        <div class="player-name">${currentUser}</div>
      </div>
      <div class="vs-text">VS</div>
      <div class="player-block">
        <div class="player-name">${opponent}</div>
      </div>
    </div>

    ${statusHtml}
  `;
}

// УПРОЩЕННАЯ ЛОГИКА: Игрок нажал кнопку - матч сразу подтвержден
window.reportResult = function(matchId, type) {
  AppDB = DB.get();
  const match = AppDB.matches.find(m => m.id === matchId);
  if (!match) return;

  const isP1 = match.p1 === currentUser;
  let myScore, oppScore;

  if (type === 'win') { myScore = 2; oppScore = 0; }
  if (type === 'draw') { myScore = 1; oppScore = 1; }
  if (type === 'lose') { myScore = 0; oppScore = 2; }

  if (isP1) {
    match.p1_score = myScore;
    match.p2_score = oppScore;
  } else {
    match.p2_score = myScore;
    match.p1_score = oppScore;
  }

  match.status = 'confirmed';
  DB.set(AppDB);
  renderMatch();
  alert('Результат сохранен!');
};

function renderHeroes() {
  AppDB = DB.get();
  const grid = document.getElementById('heroesGrid');
  const session = JSON.parse(localStorage.getItem('um_session'));
  const me = AppDB.players.find(p => p.room_code === session.room && p.name === currentUser);
  const myHeroes = me?.assigned_heroes || [];

  if (myHeroes.length === 0) {
    grid.innerHTML = '<p style="color:var(--muted)">Админ еще не назначил вам героев.</p>';
    return;
  }

  const DEFAULT_IMG = 'img/plug.jpg';

  grid.innerHTML = myHeroes.map(heroName => {
    const hero = AppDB.heroes.find(h => h.name === heroName) || { name: heroName, image: '' };
    return `
      <div class="hero-card selected" style="pointer-events: none;">
        <div class="hero-avatar" style="width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 0; border: 3px solid var(--black);">
          <img src="${hero.image || DEFAULT_IMG}" onerror="this.src='${DEFAULT_IMG}'; this.onerror=null;" style="width:100%; height:100%; object-fit:cover;">
        </div>
        <div class="hero-name">${heroName}</div>
      </div>
    `;
  }).join('');
}

// --- ОТОБРАЖЕНИЕ ФИНАЛЬНОЙ ТАБЛИЦЫ ДЛЯ ИГРОКОВ ---
window.showPlayerFinalStandings = function() {
  AppDB = DB.get();
  const session = JSON.parse(localStorage.getItem('um_session'));
  const room = AppDB.rooms.find(r => r.code === session.room);
  const roomPlayers = AppDB.players.filter(p => p.room_code === room.code);

  const sorted = [...roomPlayers].sort((a, b) => {
    if (a.is_bot && !b.is_bot) return 1;
    if (!a.is_bot && b.is_bot) return -1;
    if (b.score !== a.score) return b.score - a.score;
    if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
    return (a.bot_games || 0) - (b.bot_games || 0);
  });

  let modal = document.getElementById('playerFinalModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'playerFinalModal';
    modal.className = 'modal active';
    modal.style.alignItems = 'flex-start';
    modal.style.overflowY = 'auto';

    modal.innerHTML = `
      <div style="width: 100%; max-width: 900px; margin: 20px auto; position: relative;">
        <button onclick="document.getElementById('playerFinalModal').remove()" style="position: fixed; top: 15px; right: 15px; z-index: 10000; background: var(--black); border: 2px solid var(--pink); color: var(--pink); width: 40px; height: 40px; font-family: 'Bungee'; font-size: 20px; cursor: pointer; box-shadow: 4px 4px 0px var(--black);">✕</button>
        <div id="playerStandingsCaptureArea"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  renderStandingsForPlayer(sorted);
};

// Функция рендера постера
function renderStandingsForPlayer(players) {
  const container = document.getElementById('playerStandingsCaptureArea');

  if (!Array.isArray(players) || players.length === 0) {
    container.innerHTML = `<div class="standings-empty">НЕТ РЕЗУЛЬТАТОВ</div>`;
    return;
  }

  const escapeHTML = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const getNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatNumber = (value) => Number.isInteger(value) ? String(value) : value.toFixed(2);

  const podium = players.slice(0, 3);

  const podiumHTML = podium.map((player, index) => {
    const place = index + 1;
    const classes = { 1: 'gold', 2: 'silver', 3: 'bronze' };
    const crowns = { 1: '<span class="standing-crown">👑</span>', 2: '', 3: '' };

    return `
      <div class="standing-item ${classes[place]}">
        ${crowns[place] || ''}
        <div class="standing-place">#${place}</div>
        <div class="standing-name">
          ${escapeHTML(player.name)}
          ${player.is_bot ? '<span class="standing-bot">БОТ</span>' : ''}
        </div>
        <div class="standing-stats">
          <div class="standing-stat">
            <span class="standing-stat-label">Очки</span>
            <span class="standing-stat-value">${formatNumber(getNumber(player.score))}</span>
          </div>
          <div class="standing-stat">
            <span class="standing-stat-label">Бухгольц</span>
            <span class="standing-stat-value">${formatNumber(getNumber(player.buchholz))}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const restHTML = players.slice(3).map((player, index) => {
    const place = index + 4;
    return `
      <div class="standing-row">
        <div class="standing-row-place">#${place}</div>
        <div class="standing-row-name">
          ${escapeHTML(player.name)}
          ${player.is_bot ? '<span class="standing-bot">БОТ</span>' : ''}
        </div>
        <div class="standing-row-stat">
          ${formatNumber(getNumber(player.score))}
          <small>ОЧКИ</small>
        </div>
        <div class="standing-row-stat">
          ${formatNumber(getNumber(player.buchholz))}
          <small>БУХГОЛЬЦ</small>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div id="standingsCaptureArea">
      <header class="standings-header">
        <img src="img/logo.png" alt="UNMATCHED" class="standings-logo">
        <div class="standings-kicker">РЕЗУЛЬТАТЫ ТУРНИРА</div>
        <h1 class="standings-title">ИТОГОВАЯ ТАБЛИЦА</h1>
        <div class="standings-subtitle">БИТВА ОКОНЧЕНА</div>
      </header>

      ${podium.length ? `<section class="standings-podium">${podiumHTML}</section>` : ''}

      ${restHTML ? `
        <section class="standings-rest">
          <div class="standings-section-title">ФИНАЛЬНЫЙ РЕЙТИНГ</div>
          <div class="standings-list">${restHTML}</div>
        </section>
      ` : ''}

      <footer class="standings-footer">
        <div class="standings-footer-brand">UNMATCHED</div>
        <div class="standings-footer-info">БЕЗ ПОЩАДЫ. БЕЗ РЕВАНШЕЙ.</div>
      </footer>
    </div>
  `;
}

// Запуск
init();