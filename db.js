const dbClient = window.supabase.createClient(
  'https://cuvexievsoldyadbtckc.supabase.co',
  'sb_publishable_8QFv2y1yU7kBTF_bJThlpQ_aAbLqCx8'
);

const DB = {
  data: { rooms: [], players: [], matches: [], heroes: [], tables: [] },

  async init() {
    try {
      const { data: rooms } = await dbClient.from('rooms').select('*');
      const { data: players } = await dbClient.from('players').select('*');
      const { data: matches } = await dbClient.from('matches').select('*');
      const { data: heroes } = await dbClient.from('heroes').select('*');
      const { data: tables } = await dbClient.from('tables').select('*');

      const formattedRooms = (rooms || []).map(r => ({
        code: r.code,
        maxPlayers: r.max_players,
        heroesPerPlayer: r.heroes_per_player,
        totalRounds: r.total_rounds,
        round: r.round,
        status: r.status
      }));

      const formattedMatches = (matches || []).map(m => ({
        id: Number(m.id),
        room_code: m.room_code,
        round: m.round,
        table: m.table_name,
        p1: m.p1,
        p2: m.p2,
        p1_score: m.p1_score,
        p2_score: m.p2_score,
        status: m.status,
        map_name: m.map_name,
        p1_goes_first: m.p1_goes_first,
        hero_p1_g1: m.hero_p1_g1,
        hero_p2_g1: m.hero_p2_g1,
        hero_p1_g2: m.hero_p1_g2,
        hero_p2_g2: m.hero_p2_g2,
        admin_note: m.admin_note
      }));

      this.data = {
        rooms: formattedRooms,
        players: players || [],
        matches: formattedMatches,
        heroes: heroes || [],
        tables: tables || []
      };

      if (this.data.heroes.length === 0) {
        this.data.heroes = [
          { name: "Дракула", image: "" },
          { name: "Шерлок Холмс", image: "" },
          { name: "Медуза", image: "" },
          { name: "Алиса", image: "" },
          { name: "Синдбад", image: "" },
          { name: "Король Артур", image: "" }
        ];
        await dbClient.from('heroes').upsert(this.data.heroes);
      }

      console.log("✅ Данные успешно загружены из Supabase");
    } catch (err) {
      console.error("Ошибка загрузки из БД:", err);
      alert("Ошибка загрузки данных: " + err.message);
    }
  },

  get() {
    return this.data;
  },

  async set(newData) {
    this.data = newData;
    await this.syncData(newData);
  },

  async syncData(data) {
    try {
      // 1. Комнаты
      const roomsToSync = data.rooms.map(r => ({
        code: r.code,
        max_players: r.maxPlayers,
        heroes_per_player: r.heroesPerPlayer,
        total_rounds: r.totalRounds,
        round: r.round,
        status: r.status
      }));

      if (roomsToSync.length) {
        console.log('Отправка комнат в БД:', roomsToSync);
        const { error: roomsError } = await dbClient.from('rooms').upsert(roomsToSync);
        if (roomsError) {
          console.error('Ошибка upsert комнат:', roomsError);
          alert('Ошибка сохранения комнаты: ' + roomsError.message);
        } else {
          console.log('✅ Комнаты успешно сохранены');
        }
      }

      // 2. Матчи
      const matchesToSync = data.matches.map(m => ({
        id: m.id,
        room_code: m.room_code,
        round: m.round,
        table_name: m.table,
        p1: m.p1,
        p2: m.p2,
        p1_score: m.p1_score,
        p2_score: m.p2_score,
        status: m.status,
        map_name: m.map_name,
        p1_goes_first: m.p1_goes_first,
        hero_p1_g1: m.hero_p1_g1,
        hero_p2_g1: m.hero_p2_g1,
        hero_p1_g2: m.hero_p1_g2,
        hero_p2_g2: m.hero_p2_g2,
        admin_note: m.admin_note
      }));

      if (matchesToSync.length) {
        const { error: matchesError } = await dbClient.from('matches').upsert(matchesToSync);
        if (matchesError) console.error('Ошибка upsert матчей:', matchesError);
      }

      // 3. Игроки
      if (data.players.length) {
        const { error: playersError } = await dbClient.from('players').upsert(data.players);
        if (playersError) console.error('Ошибка upsert игроков:', playersError);
      }

      // 4. Столы
      if (data.tables.length) {
        const { error: tablesError } = await dbClient.from('tables').upsert(data.tables);
        if (tablesError) console.error('Ошибка upsert столов:', tablesError);
      }

      // 5. Герои
      if (data.heroes.length) {
        const { error: heroesError } = await dbClient.from('heroes').upsert(data.heroes);
        if (heroesError) console.error('Ошибка upsert героев:', heroesError);
      }

      // 6. Удаление
      const { data: dbRooms } = await dbClient.from('rooms').select('code');
      if (dbRooms) {
        const newCodes = data.rooms.map(r => r.code);
        const toDelete = dbRooms.filter(r => !newCodes.includes(r.code)).map(r => r.code);
        if (toDelete.length > 0) await dbClient.from('rooms').delete().in('code', toDelete);
      }

      const { data: dbPlayers } = await dbClient.from('players').select('id');
      if (dbPlayers) {
        const newIds = data.players.map(p => p.id);
        const toDelete = dbPlayers.filter(p => !newIds.includes(p.id)).map(p => p.id);
        if (toDelete.length > 0) await dbClient.from('players').delete().in('id', toDelete);
      }

      const { data: dbMatches } = await dbClient.from('matches').select('id');
      if (dbMatches) {
        const newIds = data.matches.map(m => m.id);
        const toDelete = dbMatches.filter(m => !newIds.includes(m.id)).map(m => m.id);
        if (toDelete.length > 0) await dbClient.from('matches').delete().in('id', toDelete);
      }

    } catch(e) {
      console.error("Ошибка синхронизации с БД:", e);
      alert("Ошибка синхронизации: " + e.message);
    }
  }
};

// WebSocket-подписка на все изменения в таблицах
const realtimeChannel = dbClient
  .channel('db-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public' }, // Слушаем всё: INSERT, UPDATE, DELETE
    async (payload) => {
      console.log('Realtime update:', payload);
      // При любом изменении просто перезагружаем данные из БД
      // и перерисовываем интерфейс
      await DB.init();
      if (typeof renderLeaderboard === 'function') renderLeaderboard();
      if (typeof renderMatch === 'function') renderMatch();
      if (typeof renderHeroes === 'function') renderHeroes();
      if (typeof renderSidebar === 'function') renderSidebar();
    }
  )
  .subscribe();