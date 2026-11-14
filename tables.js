// --- ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРА ---
window.renderAdminTables = function() {
  const container = document.getElementById('tablesAdminList');

  if (!activeRoomCode) {
    container.innerHTML = '<p style="color:var(--muted)">Сначала выберите комнату во вкладке "Турнир"</p>';
    return;
  }

  AppDB = DB.get();

  // Берем только столы текущей комнаты
  const roomTables = AppDB.tables.filter(t => t.room_code === activeRoomCode);

  if (roomTables.length === 0) {
    container.innerHTML = '<p style="color:var(--muted)">В этой комнате нет столов. (Они создаются автоматически при создании комнаты)</p>';
    return;
  }

  container.innerHTML = `
    <p style="color: var(--text); margin-bottom: 20px; font-family: 'Space Grotesk'; font-weight: 600;">
      Здесь вы можете переименовать карты для текущей комнаты. Количество столов фиксировано и равно половине максимального количества игроков.
    </p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 3px solid var(--black); text-align: left;">
          <th style="padding: 12px; color: var(--cyan); font-family: 'Bungee';">Физический номер</th>
          <th style="padding: 12px; color: var(--cyan); font-family: 'Bungee';">Название карты</th>
          <th style="padding: 12px; color: var(--cyan); font-family: 'Bungee'; text-align: right;">Действия</th>
        </tr>
      </thead>
      <tbody>
        ${roomTables.map((t, index) => `
          <tr style="border-bottom: 2px solid var(--black);">
            <td style="padding: 12px; color: var(--muted); font-weight: bold;">Стол ${index + 1}</td>
            <td style="padding: 12px; font-weight: 600; color: var(--text);">${t.name}</td>
            <td style="padding: 12px; text-align: right;">
              <button onclick="editTable('${t.id}')" class="btn" style="width: auto; padding: 6px 12px; font-size: 12px; display: inline-flex; box-shadow: 2px 2px 0 var(--black);">
                ✏️ Переименовать
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

// --- РЕДАКТИРОВАНИЕ СТОЛА (ТОЛЬКО ПЕРЕИМЕНОВАНИЕ) ---
window.editTable = function(tableId) {
  AppDB = DB.get();
  const table = AppDB.tables.find(t => t.id.toString() === tableId.toString());
  if (!table) return;

  const newName = prompt(`Новое название для карты (сейчас: "${table.name}"):`, table.name);
  if (newName === null || newName.trim() === '') return;

  // Проверка на дубликат в этой же комнате
  const isDuplicate = AppDB.tables.some(t =>
    t.room_code === activeRoomCode &&
    t.id.toString() !== tableId.toString() &&
    t.name.toLowerCase() === newName.trim().toLowerCase()
  );

  if (isDuplicate) {
    return alert('Карта с таким названием уже существует в этой комнате!');
  }

  window.confirmAdminAction(`Переименовать карту "${table.name}" в "${newName.trim()}"?`, () => {
    let currentDB = DB.get();
    let currentTable = currentDB.tables.find(t => t.id.toString() === tableId.toString());

    if (currentTable) {
      currentTable.name = newName.trim();
      DB.set(currentDB);
    }

    window.renderAdminTables();
  });
};