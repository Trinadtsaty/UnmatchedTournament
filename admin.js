let AppDB = { rooms: [], players: [], matches: [], heroes: [], tables: [] };
let activeRoomCode = null;
let roomToDelete = null;
let editingMatchId = null;
let tempMatchResult = { p1: null, p2: null };
let tempMissScores = {};
let viewingRound = null;

function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

async function initAdmin() {
  await DB.init();
  AppDB = DB.get();
  if (!AppDB.tables) AppDB.tables = [];
}

// --- АВТОРИЗАЦИЯ ---
document.getElementById('adminLoginBtn').addEventListener('click', () => {
  const login = document.getElementById('adminLogin').value.trim();
  const pass = document.getElementById('adminPass').value.trim();
  if (login === 'admin' && pass === 'admin') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    renderSidebar();
  } else {
    alert('Неверный логин или пароль!');
  }
});
document.getElementById('adminLogoutBtn').addEventListener('click', () => location.reload());

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');

    if (e.target.dataset.tab === 'players' && window.renderAdminPlayers) window.renderAdminPlayers();
    if (e.target.dataset.tab === 'heroes' && window.renderAdminHeroes) window.renderAdminHeroes();
    if (e.target.dataset.tab === 'tables' && window.renderAdminTables) window.renderAdminTables();
  });
});

// --- БОКОВАЯ ПАНЕЛЬ КОМНАТ ---
function renderSidebar() {
  AppDB = DB.get();
  const list = document.getElementById('roomList');
  const emptyMsg = document.getElementById('emptyRoomsMsg');

  const headerInfo = document.getElementById('headerRoomInfo');
  if (headerInfo) {
    if (activeRoomCode && AppDB.rooms.find(r => r.code === activeRoomCode)) {
      const room = AppDB.rooms.find(r => r.code === activeRoomCode);
      headerInfo.innerHTML = `Комната: <span style="color: var(--pink); font-family: 'Bebas Neue'; font-size: 20px; letter-spacing: 1px;">${room.code}</span>`;
    } else {
      headerInfo.innerHTML = '';
    }
  }

  if (AppDB.rooms.length === 0) {
    list.innerHTML = '';
    emptyMsg.style.display = 'block';
    document.getElementById('roomContent').innerHTML = '<p style="color: var(--muted); font-family: Bungee;">Выберите комнату слева или создайте новую</p>';
    return;
  }

  emptyMsg.style.display = 'none';

  list.innerHTML = AppDB.rooms.map(r => {
    const count = AppDB.players.filter(p => p.room_code === r.code).length;
    return `
      <div class="room-card ${r.code === activeRoomCode ? 'active' : ''}" data-code="${r.code}">
        <div class="room-card-info">
          <strong class="copy-code" data-code="${r.code}" title="Нажмите, чтобы скопировать">${r.code}</strong>
          <span>Раунд ${r.round} · ${count}/${r.maxPlayers} чел.</span>
        </div>
        <button class="delete-x" data-code="${r.code}" title="Удалить">×</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.room-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-x') || e.target.classList.contains('copy-code')) return;
      activeRoomCode = card.dataset.code;
      viewingRound = null;
      renderSidebar();
    });
  });

  list.querySelectorAll('.copy-code').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const codeToCopy = el.dataset.code;

      navigator.clipboard.writeText(codeToCopy).then(() => {
        const orig = el.textContent;
        el.textContent = '✅ OK';
        setTimeout(() => el.textContent = orig, 1000);
      });
    });
  });

  list.querySelectorAll('.delete-x').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      roomToDelete = btn.dataset.code;
      const count = AppDB.players.filter(p => p.room_code === roomToDelete).length;
      document.getElementById('deleteRoomInfo').textContent = `Вы уверены, что хотите удалить комнату ${roomToDelete}? В ней ${count} игрок(ов).`;
      document.getElementById('deleteRoomModal').classList.add('active');
    });
  });

  if (activeRoomCode && !AppDB.rooms.find(r => r.code === activeRoomCode)) {
    activeRoomCode = AppDB.rooms[0]?.code || null;
    viewingRound = null;
  }
  if (!activeRoomCode && AppDB.rooms.length > 0) {
    activeRoomCode = AppDB.rooms[0].code;
  }

  if (activeRoomCode) renderRoomContent();
}

document.getElementById('confirmDeleteRoomBtn').addEventListener('click', () => {
  if (!roomToDelete) return;
  AppDB = DB.get();
  AppDB.rooms = AppDB.rooms.filter(r => r.code !== roomToDelete);
  AppDB.players = AppDB.players.filter(p => p.room_code !== roomToDelete);
  AppDB.matches = AppDB.matches.filter(m => m.room_code !== roomToDelete);
  DB.set(AppDB);

  if (activeRoomCode === roomToDelete) activeRoomCode = AppDB.rooms[0]?.code || null;
  roomToDelete = null;
  document.getElementById('deleteRoomModal').classList.remove('active');
  renderSidebar();
});

// --- КОНТЕНТ КОМНАТЫ ---
function renderRoomContent() {
  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  if (!room) return;

  if (viewingRound === null) viewingRound = room.round;

  const roomPlayers = AppDB.players.filter(p => p.room_code === room.code);
  const sorted = [...roomPlayers].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
    return (a.bot_games || 0) - (b.bot_games || 0);
  });

  const currentMatches = AppDB.matches.filter(m => m.room_code === room.code && m.round === viewingRound);

  const isWaiting = room.round === 0 || room.status === 'waiting';
  const isFinished = room.round >= room.totalRounds;
  const isCurrentRound = viewingRound === room.round;

  let actionBtn = '';
  if (isWaiting) {
    actionBtn = `<button id="startTournamentBtn" class="btn btn-primary" style="width: auto; padding: 10px 20px;">🚀 Начать турнир (Раунд 1)</button>`;
  } else if (isFinished && isCurrentRound) {
    actionBtn = `<button id="showFinalBtn" class="btn" style="width: auto; padding: 10px 20px; background: var(--yellow); color: var(--black); border: 3px solid var(--black);">🏆 Показать итоги</button>`;
  } else if (isCurrentRound) {
    actionBtn = `<button id="nextRoundBtn" class="btn btn-primary" style="width: auto; padding: 10px 20px;">Следующий раунд →</button>`;
  } else {
    actionBtn = `<button onclick="viewingRound = ${room.round}; renderRoomContent();" class="btn" style="width: auto; padding: 10px 20px; background: var(--surface-light); color: var(--text);">Вернуться в текущий раунд</button>`;
  }

  let roundOptions = '';
  for (let i = 1; i <= room.round; i++) {
    roundOptions += `<option value="${i}" ${i === viewingRound ? 'selected' : ''}>Раунд ${i}</option>`;
  }

  document.getElementById('roomContent').innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <h2 style="margin: 0; color: var(--cyan);">Турнирная сетка</h2>
        <span style="color: var(--muted); font-size: 14px; font-weight: bold;">Раунд ${room.round} из ${room.totalRounds}</span>
      </div>
      ${actionBtn}
    </div>

    ${!isCurrentRound ? '<div style="color: var(--black); font-family: Bungee; font-size: 12px; margin-bottom: 15px; text-align: center; background: var(--yellow); padding: 10px; border: 2px solid var(--black);">Вы просматриваете историю. Счет менять нельзя, но можно указать героев и первого игрока.</div>' : ''}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="admin-panel">
        <h3 style="margin-bottom: 15px; font-size: 18px;">Игроки</h3>
        ${sorted.length === 0 ? '<p style="color: var(--muted); font-size: 13px;">Пока никто не присоединился</p>' : sorted.map(p => `
          <div style="background:var(--surface-light); padding:10px; border: 2px solid var(--black); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="font-family: 'Space Grotesk'; font-size: 16px;">${p.name}</strong>
              ${p.is_bot ? '<span style="font-family: Bungee; font-size: 10px; color: var(--yellow); background: var(--black); padding: 2px 6px; border: 1px solid var(--yellow); margin-left: 8px;">БОТ</span>' : ''}
              <div style="font-size:12px; color:var(--muted); margin-top: 4px;">Бух: ${p.buchholz || 0} · С ботом: ${p.bot_games || 0}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:var(--cyan); font-size: 20px; font-family: 'Bungee';">${p.score}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="admin-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0; font-size: 18px;">Матчи</h3>
          <select id="roundSelector" style="width: auto; padding: 5px 10px; font-size: 14px;">
            ${roundOptions}
          </select>
        </div>

        ${currentMatches.length === 0 ? '<p style="color: var(--muted); font-size: 13px;">Матчи не сгенерированы</p>' : `
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead><tr>
                <th style="text-align: left; padding: 8px; color: var(--cyan); border-bottom: 2px solid var(--black);">Стол / Карта</th>
                <th style="text-align: left; padding: 8px; color: var(--cyan); border-bottom: 2px solid var(--black);">Игрок 1</th>
                <th style="text-align: left; padding: 8px; color: var(--cyan); border-bottom: 2px solid var(--black);">Игрок 2</th>
                <th style="text-align: left; padding: 8px; color: var(--cyan); border-bottom: 2px solid var(--black);">Счёт</th>
                <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--black);"></th>
              </tr></thead>
              <tbody>
                ${currentMatches.map(m => {
                  let statusIcon = '';
                  if (m.admin_note) statusIcon = '<span title="' + m.admin_note + '" style="color: var(--pink); margin-left: 5px; font-size: 16px; cursor: help;">⚠️</span>';

                  return `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid var(--black); vertical-align: top;">
                      <strong style="font-family: 'Bungee'; font-size: 12px; color: var(--text);">${m.table}</strong>
                      <br><span style="font-size:10px; color:var(--muted);">${m.map_name}</span>
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid var(--black); font-weight: 600;">${m.p1}</td>
                    <td style="padding: 8px; border-bottom: 1px solid var(--black); font-weight: 600;">${m.p2}</td>
                    <td style="padding: 8px; border-bottom: 1px solid var(--black); font-family: 'Bungee'; color: ${m.p1_score !== null ? 'var(--yellow)' : 'var(--muted)'};">
                      ${m.p1_score !== null ? `${m.p1_score}:${m.p2_score}` : '—'} ${statusIcon}
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid var(--black);">
                      <button onclick="openMatchEdit(${m.id})" class="btn" style="padding:4px 8px; font-size:12px; width: auto; background: var(--surface-light); border: 2px solid var(--black); box-shadow: none;">✎</button>
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('roundSelector').addEventListener('change', (e) => {
    viewingRound = parseInt(e.target.value);
    renderRoomContent();
  });

  if (isWaiting) document.getElementById('startTournamentBtn').addEventListener('click', startTournament);
  if (isCurrentRound && !isWaiting && !isFinished) document.getElementById('nextRoundBtn').addEventListener('click', handleNextRoundClick);
  if (isFinished && isCurrentRound) document.getElementById('showFinalBtn').addEventListener('click', showFinalStandings);
}

// --- СТАРТ ТУРНИРА ---
function startTournament() {
  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const players = AppDB.players.filter(p => p.room_code === room.code);

  if (players.length < 2) return alert('Нужно хотя бы 2 игрока!');

  room.round = 1;
  room.status = 'active';
  viewingRound = 1;

  let shuffled = shuffleArray([...players]);
  let newMatches = [];
  let tableNum = 1;

  while (shuffled.length > 0) {
    const p1 = shuffled.pop();
    const p2 = shuffled.pop();
    const mapName = (AppDB.tables && AppDB.tables.length > 0)
      ? AppDB.tables[(tableNum - 1) % AppDB.tables.length].name
      : `Стол ${tableNum}`;

    newMatches.push({
      id: Date.now() + Math.random(), room_code: room.code, round: 1,
      table: `Стол ${tableNum}`, p1: p1.name, p2: p2.name,
      p1_score: null, p2_score: null, status: 'pending',
      map_name: mapName, p1_goes_first: null,
      hero_p1_g1: '', hero_p2_g1: '', hero_p1_g2: '', hero_p2_g2: '', admin_note: ''
    });
    tableNum++;
  }

  AppDB.matches = [...AppDB.matches, ...newMatches];
  DB.set(AppDB);
  renderSidebar();
  alert('Турнир начат!');
}

// --- РЕДАКТИРОВАНИЕ МАТЧА ---
window.openMatchEdit = function(matchId) {
  AppDB = DB.get();
  const match = AppDB.matches.find(m => m.id === matchId);
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  if (!match || !room) return;

  editingMatchId = matchId;
  tempMatchResult = { p1: match.p1_score, p2: match.p2_score };

  document.getElementById('editMatchTitle').textContent = `Раунд ${match.round} (${match.table})`;
  document.getElementById('editP1Name').textContent = match.p1;
  document.getElementById('editP2Name').textContent = match.p2;

  const isPastRound = match.round < room.round;

  const scoreBtns = document.querySelectorAll('.score-btn');
  scoreBtns.forEach(btn => {
    btn.classList.remove('active');
    btn.disabled = isPastRound;
    btn.style.opacity = isPastRound ? '0.3' : '1';
  });

  const displayScore = document.getElementById('modalScoreDisplay');
  if (match.p1_score === null) {
    displayScore.textContent = '- : -';
  } else {
    displayScore.textContent = `${match.p1_score} : ${match.p2_score}`;
  }

  if (match.p1_score === 2) scoreBtns[0].classList.add('active');
  else if (match.p1_score === 1) scoreBtns[1].classList.add('active');
  else if (match.p2_score === 2) scoreBtns[2].classList.add('active');

  const firstBtns = document.querySelectorAll('.goes-first-btn');
  firstBtns.forEach(btn => btn.classList.remove('active'));

  const p1NameEl = document.getElementById('editP1Name');
  const p2NameEl = document.getElementById('editP2Name');

  p1NameEl.classList.remove('first-player-highlight');
  p2NameEl.classList.remove('first-player-highlight');

  if (match.p1_goes_first === 'p1') {
    document.getElementById('btnGoesFirstP1').classList.add('active');
    p1NameEl.classList.add('first-player-highlight');
  } else if (match.p1_goes_first === 'p2') {
    document.getElementById('btnGoesFirstP2').classList.add('active');
    p2NameEl.classList.add('first-player-highlight');
  }

  document.getElementById('editGoesFirst').value = match.p1_goes_first || '';

  document.getElementById('editMapName').value = match.map_name || match.table;
  document.getElementById('editAdminNote').value = match.admin_note || '';

  const p1 = AppDB.players.find(p => p.name === match.p1 && p.room_code === activeRoomCode);
  const p2 = AppDB.players.find(p => p.name === match.p2 && p.room_code === activeRoomCode);

  const fillHeroSelect = (selectId, player, selectedVal) => {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="">— Не выбран —</option>';
    if (player && player.assigned_heroes) {
      player.assigned_heroes.forEach(h => {
        sel.innerHTML += `<option value="${h}" ${h === selectedVal ? 'selected' : ''}>${h}</option>`;
      });
    }
  };

  fillHeroSelect('editP1HeroG1', p1, match.hero_p1_g1);
  fillHeroSelect('editP1HeroG2', p1, match.hero_p1_g2);
  fillHeroSelect('editP2HeroG1', p2, match.hero_p2_g1);
  fillHeroSelect('editP2HeroG2', p2, match.hero_p2_g2);

  document.getElementById('editMatchModal').classList.add('active');
};

window.setMatchResult = function(type, btnEl) {
  if (btnEl.disabled) return;
  document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('active'));
  btnEl.classList.add('active');

  const displayScore = document.getElementById('modalScoreDisplay');

  if (type === 'p1_win') {
    tempMatchResult = { p1: 2, p2: 0 };
    displayScore.textContent = '2 : 0';
  } else if (type === 'draw') {
    tempMatchResult = { p1: 1, p2: 1 };
    displayScore.textContent = '1 : 1';
  } else if (type === 'p2_win') {
    tempMatchResult = { p1: 0, p2: 2 };
    displayScore.textContent = '0 : 2';
  }
};

window.setGoesFirst = function(player, btnEl) {
  document.querySelectorAll('.goes-first-btn').forEach(btn => btn.classList.remove('active'));
  btnEl.classList.add('active');
  document.getElementById('editGoesFirst').value = player;

  const p1NameEl = document.getElementById('editP1Name');
  const p2NameEl = document.getElementById('editP2Name');

  p1NameEl.classList.remove('first-player-highlight');
  p2NameEl.classList.remove('first-player-highlight');

  if (player === 'p1') p1NameEl.classList.add('first-player-highlight');
  if (player === 'p2') p2NameEl.classList.add('first-player-highlight');
};

document.getElementById('saveMatchBtn').addEventListener('click', () => {
  if (!editingMatchId) return;
  AppDB = DB.get();
  const match = AppDB.matches.find(m => m.id === editingMatchId);
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);

  if (match.round === room.round) {
    match.p1_score = tempMatchResult.p1;
    match.p2_score = tempMatchResult.p2;
    if (match.p1_score !== null && match.p2_score !== null) match.status = 'reported';
  }

  match.map_name = document.getElementById('editMapName').value.trim();
  match.p1_goes_first = document.getElementById('editGoesFirst').value || null;
  match.admin_note = document.getElementById('editAdminNote').value.trim();

  match.hero_p1_g1 = document.getElementById('editP1HeroG1').value;
  match.hero_p1_g2 = document.getElementById('editP1HeroG2').value;
  match.hero_p2_g1 = document.getElementById('editP2HeroG1').value;
  match.hero_p2_g2 = document.getElementById('editP2HeroG2').value;

  DB.set(AppDB);
  document.getElementById('editMatchModal').classList.remove('active');
  editingMatchId = null;
  renderRoomContent();
});

// --- ПЕРЕХОД РАУНДА ---
function handleNextRoundClick() {
  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const currentMatches = AppDB.matches.filter(m => m.room_code === room.code && m.round === room.round);
  const missing = currentMatches.filter(m => m.status === 'pending');

  if (missing.length > 0) {
    tempMissScores = {};
    const list = document.getElementById('missingScoresList');
    list.innerHTML = missing.map(m => `
      <div style="background:var(--surface-light); border: 2px solid var(--black); padding:12px; margin-bottom:10px;">
        <div style="font-family: 'Bungee'; margin-bottom:8px; display:flex; justify-content:space-between;">
          <span style="color: var(--cyan);">${m.table}</span>
          <span style="font-size:11px; color:var(--muted);">${m.map_name}</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-weight: 600; width: 30%; text-align: left;">${m.p1}</span>
          <span id="miss_score_display_${m.id}" style="font-family: 'Bebas Neue'; font-size:28px; color:var(--yellow); width: 40%; text-align: center; text-shadow: 2px 2px 0 var(--black);">- : -</span>
          <span style="font-weight: 600; width: 30%; text-align: right;">${m.p2}</span>
        </div>

        <div style="display:flex; gap:5px;">
          <button class="btn btn-win miss-btn" style="padding:8px; flex:1; font-size: 14px;" onclick="setMissScore(${m.id}, 'p1', this)">2:0</button>
          <button class="btn btn-draw miss-btn" style="padding:8px; flex:1; font-size: 14px;" onclick="setMissScore(${m.id}, 'draw', this)">1:1</button>
          <button class="btn btn-lose miss-btn" style="padding:8px; flex:1; font-size: 14px;" onclick="setMissScore(${m.id}, 'p2', this)">0:2</button>
        </div>
      </div>
    `).join('');
    document.getElementById('missingScoresModal').classList.add('active');
  } else {
    showConfirmRoundModal();
  }
}

window.setMissScore = function(matchId, type, btnEl) {
  const parent = btnEl.parentElement;
  parent.querySelectorAll('.miss-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');

  const display = document.getElementById(`miss_score_display_${matchId}`);

  if (type === 'p1') {
    tempMissScores[matchId] = { p1: 2, p2: 0 };
    display.textContent = '2 : 0';
  }
  if (type === 'draw') {
    tempMissScores[matchId] = { p1: 1, p2: 1 };
    display.textContent = '1 : 1';
  }
  if (type === 'p2') {
    tempMissScores[matchId] = { p1: 0, p2: 2 };
    display.textContent = '0 : 2';
  }
};

document.getElementById('fillMissingBtn').addEventListener('click', () => {
  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const currentMatches = AppDB.matches.filter(m => m.room_code === room.code && m.round === room.round);

  let allFilled = true;
  currentMatches.forEach(m => {
    if (m.status === 'pending') {
      if (tempMissScores[m.id]) {
        m.p1_score = tempMissScores[m.id].p1;
        m.p2_score = tempMissScores[m.id].p2;
        m.status = 'reported';
      } else {
        allFilled = false;
      }
    }
  });

  if (!allFilled) return alert('Выберите результат для всех матчей!');

  DB.set(AppDB);
  document.getElementById('missingScoresModal').classList.remove('active');
  showConfirmRoundModal();
});

function showConfirmRoundModal() {
  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const currentMatches = AppDB.matches.filter(m => m.room_code === room.code && m.round === room.round);

  const list = document.getElementById('confirmRoundList');
  list.innerHTML = currentMatches.map(m => `
    <div style="display:flex; align-items:center; padding:12px; border-bottom:2px solid var(--black); background: var(--surface-light); margin-bottom: 5px;">
      <span style="font-family: 'Bungee'; font-size: 12px; color: var(--cyan); width: 70px;">${m.table}</span>

      <div style="display: flex; align-items: center; flex: 1; justify-content: center; gap: 15px;">
        <span style="font-weight: 600; width: 90px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.p1}</span>
        <span style="font-family: 'Bebas Neue'; font-size: 24px; color: var(--yellow); background: var(--black); padding: 2px 10px; border: 1px solid var(--black); box-shadow: 2px 2px 0px var(--cyan);">${m.p1_score} : ${m.p2_score}</span>
        <span style="font-weight: 600; width: 90px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.p2}</span>
      </div>
    </div>
  `).join('');

  document.getElementById('confirmRoundModal').classList.add('active');
}

document.getElementById('confirmRoundBtn').addEventListener('click', () => {
  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const currentMatches = AppDB.matches.filter(m => m.room_code === room.code && m.round === room.round);
  currentMatches.forEach(m => {
    if (m.p1_score !== null && m.p2_score !== null) m.status = 'confirmed';
  });

  const roomPlayers = AppDB.players.filter(p => p.room_code === room.code);
  roomPlayers.forEach(p => { p.score = 0; p.buchholz = 0; p.opponents = []; p.bot_games = 0; });

  AppDB.matches.filter(m => m.room_code === room.code && m.status === 'confirmed').forEach(m => {
    const p1 = roomPlayers.find(p => p.name === m.p1);
    const p2 = roomPlayers.find(p => p.name === m.p2);

    if (p1 && p2) {
      p1.opponents.push(p2.name);
      p2.opponents.push(p1.name);
      if (p2.is_bot) p1.bot_games++;
      if (p1.is_bot) p2.bot_games++;

      if (m.p1_score === 2) p1.score += 3;
      else if (m.p2_score === 2) p2.score += 3;
      else if (m.p1_score === 1 && m.p2_score === 1) { p1.score += 1; p2.score += 1; }
    }
  });

  roomPlayers.forEach(p => {
    p.buchholz = p.opponents.reduce((sum, n) => {
      const opp = roomPlayers.find(x => x.name === n);
      return sum + (opp && !opp.is_bot ? opp.score : 0);
    }, 0);
    p.score += (p.admin_score || 0);
  });

  generateNextRound(room, roomPlayers);
  document.getElementById('confirmRoundModal').classList.remove('active');
  viewingRound = room.round;
  renderSidebar();
});

// --- ГЕНЕРАЦИЯ РАУНДА ---
function generateNextRound(room, roomPlayers) {
  let players = [...roomPlayers].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
    return (a.bot_games || 0) - (b.bot_games || 0);
  });

  let pairs = [];
  while (players.length > 0) {
    const p1 = players.shift();
    let idx = players.findIndex(p => !p1.opponents.includes(p.name));
    if (idx === -1) idx = 0;
    const p2 = players.splice(idx, 1)[0];
    pairs.push([p1, p2]);
  }

  const mapHistory = {};
  AppDB.matches.filter(m => m.room_code === room.code).forEach(m => {
    if (!mapHistory[m.p1]) mapHistory[m.p1] = new Set();
    if (!mapHistory[m.p2]) mapHistory[m.p2] = new Set();
    mapHistory[m.p1].add(m.map_name);
    mapHistory[m.p2].add(m.map_name);
  });

  let availableMaps = new Set();
  if (AppDB.tables && AppDB.tables.length > 0) {
    AppDB.tables.forEach(t => availableMaps.add(t.name));
  } else {
    for (let i=1; i<=Math.ceil(roomPlayers.length/2); i++) availableMaps.add(`Стол ${i}`);
  }

  let assignedMaps = {};
  let unassignedPairs = [];

  pairs.forEach((pair, index) => {
    const [p1, p2] = pair;
    const h1 = mapHistory[p1.name] || new Set();
    const h2 = mapHistory[p2.name] || new Set();

    let foundMap = null;
    for (let map of availableMaps) {
      if (!h1.has(map) && !h2.has(map)) { foundMap = map; break; }
    }

    if (foundMap) {
      assignedMaps[index] = foundMap;
      availableMaps.delete(foundMap);
    } else {
      unassignedPairs.push(index);
    }
  });

  unassignedPairs.forEach(index => {
    let map = Array.from(availableMaps)[0];
    if (!map) map = 'Резервный стол';
    else availableMaps.delete(map);
    assignedMaps[index] = map;
  });

  let newMatches = [];
  pairs.forEach((pair, index) => {
    const [p1, p2] = pair;
    newMatches.push({
      id: Date.now() + Math.random(), room_code: room.code, round: room.round + 1,
      table: `Стол ${index + 1}`, p1: p1.name, p2: p2.name,
      p1_score: null, p2_score: null, status: 'pending',
      map_name: assignedMaps[index], p1_goes_first: null,
      hero_p1_g1: '', hero_p2_g1: '', hero_p1_g2: '', hero_p2_g2: '', admin_note: ''
    });
  });

  room.round += 1;
  AppDB.matches = [...AppDB.matches, ...newMatches];
  DB.set(AppDB);
  alert(`Раунд ${room.round} сгенерирован!`);
}

// --- СОЗДАНИЕ КОМНАТЫ ---
document.getElementById('newRoomBtn').addEventListener('click', () => document.getElementById('createModal').classList.add('active'));

document.getElementById('confirmCreateBtn').addEventListener('click', () => {
  let maxPlayers = parseInt(document.getElementById('maxPlayersInput').value);

  if (maxPlayers % 2 !== 0) {
    maxPlayers = maxPlayers + 1;
    if (maxPlayers > 12) maxPlayers = 12;
    if (maxPlayers < 4) maxPlayers = 4;
    document.getElementById('maxPlayersInput').value = maxPlayers;
  }

  const heroesPerPlayer = parseInt(document.getElementById('heroesPerPlayerInput').value);
  const totalRounds = parseInt(document.getElementById('roundsInput').value);

  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  AppDB = DB.get();

  const tableCount = maxPlayers / 2;
  AppDB.tables = [];
  for (let i = 1; i <= tableCount; i++) {
    AppDB.tables.push({ id: Date.now() + i, name: `Стол ${i}` });
  }

  AppDB.rooms.push({ code, maxPlayers, heroesPerPlayer, totalRounds, round: 0, status: 'waiting' });
  DB.set(AppDB);

  activeRoomCode = code;
  viewingRound = null;
  document.getElementById('createModal').classList.remove('active');
  renderSidebar();
});

// ==========================================================================
// ФИНАЛЬНАЯ ТАБЛИЦА (ПОСТЕР) - РУССКАЯ ВЕРСИЯ
// ==========================================================================
function renderStandings(players) {
  const container = document.getElementById('standingsCaptureArea');

  if (!container) {
    console.error('standingsCaptureArea not found');
    return;
  }

  if (!Array.isArray(players) || players.length === 0) {
    container.innerHTML = `
      <div class="standings-empty">
        НЕТ РЕЗУЛЬТАТОВ
      </div>
    `;
    return;
  }

  const escapeHTML = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const formatNumber = (value) => {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  };

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
  `;
}

function showFinalStandings() {
  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const roomPlayers = AppDB.players.filter(p => p.room_code === room.code);

  const sorted = [...roomPlayers].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
    return (a.bot_games || 0) - (b.bot_games || 0);
  });

  renderStandings(sorted);
  document.getElementById('finalStandingsModal').classList.add('active');
}

document.getElementById('downloadPngBtn').addEventListener('click', () => {
  const captureArea = document.getElementById('standingsCaptureArea');
  const btn = document.getElementById('downloadPngBtn');

  btn.textContent = '⏳ Генерация...';
  btn.disabled = true;

  html2canvas(captureArea, {
    backgroundColor: '#260D20',
    scale: 2
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'tournament_standings.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    btn.textContent = '📸 Скачать PNG';
    btn.disabled = false;
  }).catch(err => {
    alert('Ошибка при создании картинки: ' + err);
    btn.textContent = '📸 Скачать PNG';
    btn.disabled = false;
  });
});

// --- ПОДТВЕРЖДЕНИЕ ДЕЙСТВИЙ ---
window.confirmAdminAction = function(text, callback) {
  const textEl = document.getElementById('adminActionText');
  const btn = document.getElementById('confirmAdminActionBtn');
  textEl.textContent = text;
  document.getElementById('adminActionModal').classList.add('active');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    document.getElementById('adminActionModal').classList.remove('active');
    callback();
  });
};

function sync(r, i) {
  document.getElementById(r).addEventListener('input', e => document.getElementById(i).value = e.target.value);
  document.getElementById(i).addEventListener('input', e => document.getElementById(r).value = e.target.value);
}
sync('maxPlayersRange', 'maxPlayersInput');
sync('heroesPerPlayerRange', 'heroesPerPlayerInput');
sync('roundsRange', 'roundsInput');

document.getElementById('maxPlayersInput').addEventListener('input', (e) => {
  let p = parseInt(e.target.value);

  if (p % 2 !== 0) {
    p = p + 1;
    if (p > 12) p = 12;
    if (p < 4) p = 4;
    e.target.value = p;
  }

  const rec = p >= 10 ? 4 : 3;
  document.getElementById('recommendedRounds').value = rec;
  document.getElementById('roundsInput').value = rec;
  document.getElementById('roundsRange').value = rec;
});

initAdmin();