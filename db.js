const supabaseUrl = 'https://cuvexievsoldyadbtckc.supabase.co';
const supabaseKey = 'sb_publishable_8QFv2y1yU7kBTF_bJThlpQ_aAbLqCx8';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const DB = {
  data: { rooms: [], players: [], matches: [], heroes: [], tables: [] },

  async init() {
    const { data: rooms } = await supabase.from('rooms').select('*');
    const { data: players } = await supabase.from('players').select('*');
    const { data: matches } = await supabase.from('matches').select('*');
    const { data: heroes } = await supabase.from('heroes').select('*');
    const { data: tables } = await supabase.from('tables').select('*');

    this.data = {
      rooms: rooms || [],
      players: players || [],
      matches: matches || [],
      heroes: heroes || [],
      tables: tables || []
    };

    // Если база пустая, загружаем дефолтных героев
    if (this.data.heroes.length === 0) {
      this.data.heroes = [
        { name: "Дракула", image: "" },
        { name: "Шерлок Холмс", image: "" },
        { name: "Медуза", image: "" },
        { name: "Алиса", image: "" },
        { name: "Синдбад", image: "" },
        { name: "Король Артур", image: "" }
      ];
      await supabase.from('heroes').upsert(this.data.heroes);
    }
  },

  get() {
    return this.data;
  },

  async set(newData) {
    this.data = newData;
    // Асинхронно синхронизируем в фоне (не блокируем интерфейс)
    this.syncData(newData);
  },

  async syncData(data) {
    try {
      // 1. Удаляем то, что было удалено в интерфейсе
      const { data: dbRooms } = await supabase.from('rooms').select('code');
      if (dbRooms) {
        const newCodes = data.rooms.map(r => r.code);
        const toDelete = dbRooms.filter(r => !newCodes.includes(r.code)).map(r => r.code);
        if (toDelete.length > 0) await supabase.from('rooms').delete().in('code', toDelete);
      }

      const { data: dbPlayers } = await supabase.from('players').select('id');
      if (dbPlayers) {
        const newIds = data.players.map(p => p.id);
        const toDelete = dbPlayers.filter(p => !newIds.includes(p.id)).map(p => p.id);
        if (toDelete.length > 0) await supabase.from('players').delete().in('id', toDelete);
      }

      const { data: dbMatches } = await supabase.from('matches').select('id');
      if (dbMatches) {
        const newIds = data.matches.map(m => m.id);
        const toDelete = dbMatches.filter(m => !newIds.includes(m.id)).map(m => m.id);
        if (toDelete.length > 0) await supabase.from('matches').delete().in('id', toDelete);
      }

      // 2. Обновляем или добавляем новые
      if (data.rooms.length) await supabase.from('rooms').upsert(data.rooms);
      if (data.players.length) await supabase.from('players').upsert(data.players);
      if (data.matches.length) await supabase.from('matches').upsert(data.matches);
      if (data.tables.length) await supabase.from('tables').upsert(data.tables);
      if (data.heroes.length) await supabase.from('heroes').upsert(data.heroes);

    } catch(e) {
      console.error("Ошибка синхронизации с БД:", e);
    }
  }
};