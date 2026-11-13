// --- МОК-ДАННЫЕ (Временная имитация БД) ---
const mockDB = {
  roomCode: 'A7B2',
  currentRound: 1,
  players: [
    { id: 1, name: 'Вы', score: 3, buchholz: 3 },
    { id: 2, name: 'Дракула', score: 3, buchholz: 3 },
    { id: 3, name: 'Шерлок', score: 0, buchholz: 0 },
    { id: 4, name: 'Медуза', score: 0, buchholz: 0 }
  ],
  currentMatch: {
    table: 1,
    opponentName: 'Дракула',
    status: 'pending', // pending, waiting, confirm
    reportedResult: null
  }
};

let currentUser = null;

// --- ЛОГИКА ЭКРАНОВ ---
document.getElementById('loginBtn').addEventListener('click', () => {
  const room = document.getElementById('roomCodeInput').value.trim();
  const name = document.getElementById('playerNameInput').value.trim();

  if (!room || !name) return alert('Заполните все поля');

  // Проверка на мок-код (в будущем проверка БД)
  if (room !== mockDB.roomCode) {
    return alert('Комната не найдена (введите A7B2)');
  }

  currentUser = name;

  // Переключаем экран
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');

  // Заполняем данные
  document.getElementById('displayRoomCode').textContent = mockDB.roomCode;
  document.getElementById('currentRoundText').textContent = mockDB.currentRound;
  document.getElementById('myPlayerName').textContent = currentUser;
  document.getElementById('opponentName').textContent = mockDB.currentMatch.opponentName;
  document.getElementById('tableNumber').textContent = mockDB.currentMatch.table;

  renderLeaderboard();
});

// Переключение вкладок
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`).classList.add('active');
}

// Рендер лидерборда
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = mockDB.players.map((p, index) => {
    const isMe = p.name === currentUser;
    return `
      <tr class="${isMe ? 'me' : ''}">
        <td>${index + 1}</td>
        <td>${p.name}</td>
        <td><strong>${p.score}</strong></td>
        <td>${p.buchholz}</td>
      </tr>
    `;
  }).join('');
}

// --- ЛОГИКА МАТЧА ---
function reportResult(result) {
  document.getElementById('matchActions').style.display = 'none';

  if (result === 'win') {
    document.getElementById('waitingConfirm').style.display = 'block';
  } else if (result === 'draw' || result === 'lose') {
    // Имитация: соперник уже заявил результат, показываем окно подтверждения
    document.getElementById('confirmBox').style.display = 'block';
    document.getElementById('reportedResultText').textContent = result === 'draw' ? 'Ничья (1:1)' : 'Поражение (0:2)';
  }
}

function confirmResult(isAgree) {
  document.getElementById('confirmBox').style.display = 'none';

  if (isAgree) {
    alert('Результат подтвержден! Очки начислены.');
    // Здесь будет обновление БД и пересчет очков
  } else {
    alert('Спор отправлен админу. Ожидайте решения.');
    document.getElementById('matchActions').style.display = 'block'; // Возвращаем кнопки
  }
}