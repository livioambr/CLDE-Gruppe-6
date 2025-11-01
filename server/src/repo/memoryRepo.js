const store = new Map();

export async function create(game) { store.set(game.id, game); return game; }
export async function get(id) { return store.get(id) || null; }
export async function put(game) { store.set(game.id, game); return game; }
