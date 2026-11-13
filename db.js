const DB = {
  KEY: 'unmatched_db_v2',

  async init() {
    if (!localStorage.getItem(DB.KEY)) {
      try {
        const res = await fetch('db.json');
        const data = await res.json();
        const clean = {
          rooms: data.rooms || [],
          players: data.players || [],
          matches: data.matches || [],
          heroes: data.heroes || [],
          tables: data.tables || [] // <--- ДОБАВЛЕНО
        };
        localStorage.setItem(DB.KEY, JSON.stringify(clean));
      } catch(e) {
        localStorage.setItem(DB.KEY, JSON.stringify({ rooms: [], players: [], matches: [], heroes: [], tables: [] }));
      }
    }
  },

  get() {
    const data = JSON.parse(localStorage.getItem(DB.KEY)) || {};
    return {
      rooms: data.rooms || [],
      players: data.players || [],
      matches: data.matches || [],
      heroes: data.heroes || [],
      tables: data.tables || [] // <--- ДОБАВЛЕНО
    };
  },

  set(data) {
    localStorage.setItem(DB.KEY, JSON.stringify(data));
  }
};