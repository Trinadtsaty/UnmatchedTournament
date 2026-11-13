// Функция для парсинга ссылок на картинки (Google Диск или прямые ссылки)
function getDirectImageUrl(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

// Генерация SVG-заглушки для битых картинок
const DEFAULT_HERO_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%2324242d"/><text x="50" y="50" font-family="Arial" font-size="40" fill="%238b8b99" text-anchor="middle" dominant-baseline="central">?</text></svg>';

let currentHeroPlayer = null;

// --- СКАЧИВАНИЕ ШАБЛОНА ---
document.getElementById('downloadHeroTemplateBtn').addEventListener('click', () => {
  const template = [
    { "name": "Дракула", "image": "https://example.com/dracula.jpg" },
    { "name": "Шерлок Холмс", "image": "" },
    { "name": "Медуза", "image": "https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view?usp=sharing" }
  ];
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'heroes_template.json';
  a.click();
});

// --- ЗАГРУЗКА JSON ---
document.getElementById('uploadHeroesFile').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data)) {
        AppDB = DB.get();
        // Очищаем и загружаем новых героев, парся ссылки
        AppDB.heroes = data.map(h => ({
          name: h.name || 'Без имени',
          image: getDirectImageUrl(h.image)
        }));
        DB.set(AppDB);
        renderAdminHeroes();
        alert(`Успешно загружено ${data.length} героев!`);
      } else {
        alert('Неверный формат: ожидается массив объектов.');
      }
    } catch (err) {
      alert('Ошибка чтения JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
  this.value = ''; // Сброс
});

// --- РУЧНОЕ ДОБАВЛЕНИЕ ГЕРОЯ ---
document.getElementById('addHeroBtn').addEventListener('click', () => {
  const nameInput = document.getElementById('newHeroName');
  const imgInput = document.getElementById('newHeroImg');

  const name = nameInput.value.trim();
  if (!name) return alert('Введите имя героя!');

  const image = getDirectImageUrl(imgInput.value.trim());

  AppDB = DB.get();
  if (!AppDB.heroes) AppDB.heroes = [];

  if (AppDB.heroes.some(h => h.name.toLowerCase() === name.toLowerCase())) {
    return alert('Герой с таким именем уже существует!');
  }

  AppDB.heroes.push({ name, image });
  DB.set(AppDB);

  nameInput.value = '';
  imgInput.value = '';
  renderAdminHeroes();
});

// --- ОЧИСТКА ПУЛА ---
document.getElementById('clearHeroPoolBtn').addEventListener('click', () => {
  window.confirmAdminAction(
    'Вы уверены, что хотите полностью очистить пул героев? Это действие нельзя отменить. Все назначения у игроков также будут сброшены.',
    () => {
      AppDB = DB.get();
      AppDB.heroes = [];
      if (AppDB.players) {
        AppDB.players.forEach(p => p.assigned_heroes = []);
      }
      DB.set(AppDB);
      renderAdminHeroes();
    }
  );
});

// --- ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРА ---
window.renderAdminHeroes = function() {
  AppDB = DB.get();

  if (!activeRoomCode) {
    document.getElementById('heroPoolList').innerHTML = '<p style="color:var(--text-muted)">Сначала выберите комнату во вкладке "Турнир"</p>';
    document.getElementById('heroAssignList').innerHTML = '';
    document.getElementById('heroAssignPlayerSelect').innerHTML = '<option value="">Выберите игрока</option>';
    return;
  }

  renderHeroPool();
  renderPlayerSelect();

  if (currentHeroPlayer) {
    renderHeroAssignments();
  } else {
    document.getElementById('heroAssignList').innerHTML = '<p style="color:var(--text-muted); font-size:12px;">Выберите игрока из списка выше</p>';
  }
};

// --- РЕНДЕР ПУЛА ГЕРОЕВ ---
function renderHeroPool() {
  const container = document.getElementById('heroPoolList');
  if (!AppDB.heroes || AppDB.heroes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:12px;">Пул пуст. Загрузите JSON или добавьте вручную.</p>';
    return;
  }

  container.innerHTML = AppDB.heroes.map((h, index) => `
    <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px; text-align:center; position:relative;">
      <div style="position:absolute; top:2px; right:2px; display:flex; gap:2px; background: rgba(0,0,0,0.6); border-radius:4px;">
        <button onclick="editHero(${index})" style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size:14px; padding:2px 5px;" title="Редактировать">✎</button>
        <button onclick="deleteHero(${index})" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:14px; padding:2px 5px;" title="Удалить">✕</button>
      </div>
      <div style="width:100%; height:60px; border-radius:4px; overflow:hidden; background:#000; margin-bottom:8px; margin-top: 10px;">
        <img src="${h.image || DEFAULT_HERO_IMG}" onerror="this.src='${DEFAULT_HERO_IMG}'" style="width:100%; height:100%; object-fit:cover;">
      </div>
      <div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${h.name}</div>
    </div>
  `).join('');
}

// --- РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ ГЕРОЯ ---
window.editHero = function(index) {
  AppDB = DB.get();
  const hero = AppDB.heroes[index];
  if (!hero) return;

  const newName = prompt(`Редактирование имени героя:`, hero.name);
  if (newName === null) return;
  if (!newName.trim()) return alert('Имя не может быть пустым!');

  const newImg = prompt(`Ссылка на картинку (Google Диск или прямая):`, hero.image || '');
  if (newImg === null) return;

  window.confirmAdminAction(`Сохранить изменения для героя "${newName}"?`, () => {
    AppDB.heroes[index].name = newName.trim();
    AppDB.heroes[index].image = getDirectImageUrl(newImg.trim());

    // Обновляем имя героя у игроков, если оно изменилось
    if (hero.name !== newName.trim()) {
      AppDB.players.forEach(p => {
        if (p.assigned_heroes) {
          const hIdx = p.assigned_heroes.indexOf(hero.name);
          if (hIdx !== -1) p.assigned_heroes[hIdx] = newName.trim();
        }
      });
    }

    DB.set(AppDB);
    renderAdminHeroes();
  });
};

window.deleteHero = function(index) {
  AppDB = DB.get();
  const hero = AppDB.heroes[index];
  if (!hero) return;

  window.confirmAdminAction(`Удалить героя "${hero.name}" из пула? Он также исчезнет у всех игроков.`, () => {
    AppDB.heroes.splice(index, 1);

    AppDB.players.forEach(p => {
      if (p.assigned_heroes) {
        p.assigned_heroes = p.assigned_heroes.filter(h => h !== hero.name);
      }
    });

    DB.set(AppDB);
    renderAdminHeroes();
  });
};

// --- РЕНДЕР СПИСКА ИГРОКОВ (Выпадающий список) ---
function renderPlayerSelect() {
  const select = document.getElementById('heroAssignPlayerSelect');
  const roomPlayers = AppDB.players.filter(p => p.room_code === activeRoomCode);

  const currentVal = select.value;

  select.innerHTML = '<option value="">Выберите игрока</option>' +
    roomPlayers.map(p => `<option value="${p.name}">${p.name}</option>`).join('');

  if (roomPlayers.find(p => p.name === currentVal)) {
    select.value = currentVal;
  } else {
    currentHeroPlayer = null;
  }
}

document.getElementById('heroAssignPlayerSelect').addEventListener('change', (e) => {
  currentHeroPlayer = e.target.value || null;
  renderAdminHeroes();
});

// --- РЕНДЕР НАЗНАЧЕНИЯ ГЕРОЕВ ---
function renderHeroAssignments() {
  const container = document.getElementById('heroAssignList');
  if (!currentHeroPlayer) return;

  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const player = AppDB.players.find(p => p.room_code === activeRoomCode && p.name === currentHeroPlayer);
  if (!player || !room) return;

  if (!player.assigned_heroes) player.assigned_heroes = [];

  const limitInfo = `<div style="grid-column: 1 / -1; font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">
    Назначено: <b style="color: ${player.assigned_heroes.length >= room.heroesPerPlayer ? 'var(--danger)' : 'var(--success)'}">${player.assigned_heroes.length}</b> из ${room.heroesPerPlayer}
  </div>`;

  if (!AppDB.heroes || AppDB.heroes.length === 0) {
    container.innerHTML = limitInfo + '<p style="color:var(--text-muted); font-size:12px;">В пуле нет героев.</p>';
    return;
  }

  const heroesHtml = AppDB.heroes.map(h => {
    const isAssigned = player.assigned_heroes.includes(h.name);
    return `
      <div class="hero-card ${isAssigned ? 'selected' : ''}"
           style="padding: 10px 5px; cursor: pointer;"
           onclick="toggleHeroAssignment('${h.name}')">
        <div class="hero-avatar" style="width:40px; height:40px; overflow:hidden;">
           <img src="${h.image || DEFAULT_HERO_IMG}" onerror="this.src='${DEFAULT_HERO_IMG}'" style="width:100%; height:100%; object-fit:cover;">
        </div>
        <div class="hero-name" style="font-size:11px; margin-top:5px;">${h.name}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = limitInfo + heroesHtml;
}

// --- ЛОГИКА НАЗНАЧЕНИЯ ---
window.toggleHeroAssignment = function(heroName) {
  if (!currentHeroPlayer) return;

  AppDB = DB.get();
  const room = AppDB.rooms.find(r => r.code === activeRoomCode);
  const player = AppDB.players.find(p => p.room_code === activeRoomCode && p.name === currentHeroPlayer);
  if (!player || !room) return;

  if (!player.assigned_heroes) player.assigned_heroes = [];

  if (player.assigned_heroes.includes(heroName)) {
    player.assigned_heroes = player.assigned_heroes.filter(h => h !== heroName);
  } else {
    if (player.assigned_heroes.length >= room.heroesPerPlayer) {
      return alert(`Нельзя выдать больше героев! Лимит комнаты: ${room.heroesPerPlayer}`);
    }
    player.assigned_heroes.push(heroName);
  }

  DB.set(AppDB);
  renderHeroAssignments();
};