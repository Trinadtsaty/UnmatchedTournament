// --- ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРА ---
window.renderAdminTables = function() {
  const container = document.getElementById('tablesAdminList');

  if (!activeRoomCode) {
    container.innerHTML = '<p style="color:var(--text-muted)">Сначала выберите комнату во вкладке "Турнир"</p>';
    return;
  }

  AppDB = DB.get();

  // Инициализируем пул столов, если его нет (например, для новых комнат)
  if (!AppDB.tables) {
    AppDB.tables = [];
  }

  if (AppDB.tables.length === 0) {
    const room = AppDB.rooms.find(r => r.code === activeRoomCode);
    if (room) {
      const count = Math.ceil(room.maxPlayers / 2);
      for (let i = 1; i <= count; i++) {
        AppDB.tables.push({ id: Date.now() + i, name: `Стол ${i}` });
      }
    }
    DB.set(AppDB);
  }

  container.innerHTML = `
    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
      <input type="text" id="newTableName" placeholder="Название новой карты (например, Тронный зал)" style="flex: 1; padding: 10px; background: #000; color: #fff; border: 1px solid var(--border); border-radius: 8px;">
      <button id="addTableBtn" class="btn btn-primary" style="width: auto; padding: 10px 20px;">Добавить карту</button>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border); text-align: left;">
          <th style="padding: 12px; color: var(--text-muted);">Физический номер</th>
          <th style="padding: 12px; color: var(--text-muted);">Название карты</th>
          <th style="padding: 12px; color: var(--text-muted); text-align: right;">Действия</th>
        </tr>
      </thead>
      <tbody id="tablesListBody">
        ${AppDB.tables.map((t, index) => `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 12px; color: var(--text-muted);">Стол ${index + 1}</td>
            <td style="padding: 12px; font-weight: 600;">${t.name}</td>
            <td style="padding: 12px; text-align: right;">
              <button onclick="editTable(${index})" class="btn" style="width: auto; padding: 6px 12px; font-size: 12px; display: inline-flex;">
                ✏️ Переименовать
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Обработчик добавления
  document.getElementById('addTableBtn').addEventListener('click', () => {
    const input = document.getElementById('newTableName');
    const name = input.value.trim();
    if (!name) return alert('Введите название карты!');

    AppDB = DB.get();
    if (!AppDB.tables) AppDB.tables = [];

    if (AppDB.tables.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      return alert('Карта с таким названием уже существует!');
    }

    AppDB.tables.push({ id: Date.now(), name: name });
    DB.set(AppDB);
    input.value = '';
    window.renderAdminTables();
  });
};

// --- РЕДАКТИРОВАНИЕ СТОЛА (БЕЗ УДАЛЕНИЯ) ---
window.editTable = function(index) {
  AppDB = DB.get();
  if (!AppDB.tables) AppDB.tables = [];

  const table = AppDB.tables[index];
  if (!table) return;

  const newName = prompt(`Новое название для карты (Стол ${index + 1}):`, table.name);
  if (newName === null || newName.trim() === '') return;

  if (AppDB.tables.some((t, i) => i !== index && t.name.toLowerCase() === newName.trim().toLowerCase())) {
    return alert('Карта с таким названием уже существует!');
  }

  window.confirmAdminAction(`Переименовать карту "${table.name}" в "${newName.trim()}"?`, () => {
    let currentDB = DB.get();
    if (!currentDB.tables) currentDB.tables = [];

    if (currentDB.tables[index]) {
      currentDB.tables[index].name = newName.trim();
      DB.set(currentDB);
    }
    window.renderAdminTables();
  });
};