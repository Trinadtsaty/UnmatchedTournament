// --- ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРА ---
window.renderAdminPlayers = function() {
  const container = document.getElementById('playersAdminList');

  if (!activeRoomCode) {
    container.innerHTML = '<p style="color:var(--text-muted)">Сначала выберите комнату во вкладке "Турнир"</p>';
    return;
  }

  AppDB = DB.get();
  const roomPlayers = AppDB.players.filter(p => p.room_code === activeRoomCode);

  if (roomPlayers.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted)">В комнате нет игроков</p>';
    return;
  }

  // Сортировка: Очки -> Бухгольц -> Меньше игр с ботами
  const sorted = [...roomPlayers].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
    return (a.bot_games || 0) - (b.bot_games || 0);
  });

  container.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border); text-align: left;">
          <th style="padding: 12px; color: var(--text-muted);">Игрок</th>
          <th style="padding: 12px; color: var(--text-muted);">Осн. очки</th>
          <th style="padding: 12px; color: var(--text-muted);">От админа</th>
          <th style="padding: 12px; color: var(--text-muted);">Всего</th>
          <th style="padding: 12px; color: var(--text-muted); text-align: center;">Бот</th>
          <th style="padding: 12px; color: var(--text-muted); text-align: right;">Действия</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(p => {
          const adminScore = p.admin_score || 0;
          const baseScore = p.score - adminScore;

          return `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px; font-weight: 600;">
                ${p.name}
                ${p.is_bot ? '<span style="font-size:10px; color:var(--warning); margin-left:5px;">[БОТ]</span>' : ''}
              </td>
              <td style="padding: 12px; color: var(--text-muted);">${baseScore}</td>
              <td style="padding: 12px; color: ${adminScore > 0 ? 'var(--success)' : (adminScore < 0 ? 'var(--danger)' : 'var(--text-muted)')};">
                ${adminScore > 0 ? '+' : ''}${adminScore}
              </td>
              <td style="padding: 12px; font-weight: bold; color: var(--primary);">${p.score}</td>
              <td style="padding: 12px; text-align: center;">
                <input type="checkbox"
                       ${p.is_bot ? 'checked' : ''}
                       onchange="toggleBotStatus('${p.name}')"
                       style="width: 18px; height: 18px; accent-color: var(--warning); cursor: pointer;">
              </td>
              <td style="padding: 12px; text-align: right;">
                <button onclick="adjustPlayerScore('${p.name}')" class="btn" style="width: auto; padding: 6px 12px; font-size: 12px; display: inline-flex; margin-right: 5px;">
                  ✏️ Очки
                </button>
                <button onclick="deletePlayerFromRoom('${p.name}')" class="btn btn-lose" style="width: auto; padding: 6px 12px; font-size: 12px; display: inline-flex;">
                  Удалить
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
};

// --- ПЕРЕКЛЮЧАТЕЛЬ СТАТУСА БОТА ---
window.toggleBotStatus = function(playerName) {
  AppDB = DB.get();
  const player = AppDB.players.find(p => p.room_code === activeRoomCode && p.name === playerName);

  if (player) {
    player.is_bot = !player.is_bot;

    // Если игрок становится ботом, сбрасываем его очки, чтобы он не ломал Бухгольц и не занимал места
    if (player.is_bot) {
      player.score = 0;
      player.admin_score = 0;
      player.buchholz = 0;
      player.bot_games = 0;
      player.opponents = [];
    }

    DB.set(AppDB);
    renderAdminPlayers();

    // Обновляем боковую панель (турнирную таблицу) в admin.js
    if (window.renderSidebar) window.renderSidebar();
  }
};

// --- ИЗМЕНЕНИЕ ОЧКОВ ИГРОКА ---
window.adjustPlayerScore = function(playerName) {
  const input = prompt(`Введите количество очков для "${playerName}" (можно отрицательное, например -3):`, "1");
  if (input === null) return;

  const amount = parseInt(input);
  if (isNaN(amount) || amount === 0) {
    return alert('Введите корректное число (не 0).');
  }

  const actionText = amount > 0
    ? `Начислить игроку ${playerName} дополнительно ${amount} очк.?`
    : `Списать у игрока ${playerName} ${Math.abs(amount)} очк.?`;

  window.confirmAdminAction(actionText, () => {
    AppDB = DB.get();
    const player = AppDB.players.find(p => p.room_code === activeRoomCode && p.name === playerName);

    if (player) {
      player.admin_score = (player.admin_score || 0) + amount;
      player.score += amount;

      DB.set(AppDB);
      renderAdminPlayers();

      if (window.renderSidebar) window.renderSidebar();
    }
  });
};

// --- УДАЛЕНИЕ ИГРОКА ИЗ КОМНАТЫ ---
window.deletePlayerFromRoom = function(playerName) {
  window.confirmAdminAction(
    `Вы уверены, что хотите удалить игрока "${playerName}" из комнаты? Все его матчи в текущем раунде будут аннулированы. Это действие необратимо.`,
    () => {
      AppDB = DB.get();

      // 1. Удаляем игрока
      AppDB.players = AppDB.players.filter(p => !(p.room_code === activeRoomCode && p.name === playerName));

      // 2. Удаляем незавершенные матчи с его участием в текущем раунде
      const room = AppDB.rooms.find(r => r.code === activeRoomCode);
      if (room) {
        AppDB.matches = AppDB.matches.filter(m =>
          !(m.room_code === activeRoomCode && m.round === room.round && (m.p1 === playerName || m.p2 === playerName))
        );
      }

      DB.set(AppDB);

      renderAdminPlayers();
      if (window.renderSidebar) window.renderSidebar();

      alert(`Игрок ${playerName} удален.`);
    }
  );
};