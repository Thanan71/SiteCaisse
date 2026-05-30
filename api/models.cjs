const { getDb } = require('./db.cjs');
const bcrypt = require('bcryptjs');

function initTables() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'permanent' CHECK(role IN ('permanent', 'temporaire')),
      est_actif INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ventes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article TEXT NOT NULL,
      quantite INTEGER DEFAULT 1,
      prix REAL NOT NULL,
      type_paiement TEXT NOT NULL CHECK(type_paiement IN ('CB', 'Espece', 'Cheque')),
      artisan_id INTEGER REFERENCES users(id),
      vendeur_id INTEGER REFERENCES users(id),
      date_vente TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed data – only insert if no users exist yet
  const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (count.cnt === 0) {
    const hash = bcrypt.hashSync('password123', 10);

    const insertUser = db.prepare(
      'INSERT INTO users (nom, email, password_hash, role) VALUES (?, ?, ?, ?)'
    );

    insertUser.run('Marcel', 'marcel@artisan.fr', hash, 'permanent');
    insertUser.run('Sophie', 'sophie@artisan.fr', hash, 'permanent');
    insertUser.run('Jean', 'jean@artisan.fr', hash, 'permanent');
    insertUser.run('Lucas', 'lucas@artisan.fr', hash, 'temporaire');
    insertUser.run('Emma', 'emma@artisan.fr', hash, 'temporaire');

    console.log('✅ Seed data inserted (5 artisans)');
  }
}

function findUserByEmail(email) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
  const db = getDb();
  return db.prepare('SELECT id, nom, email, role, est_actif FROM users WHERE id = ?').get(id);
}

function getAllArtisans() {
  const db = getDb();
  return db
    .prepare("SELECT id, nom, email, role FROM users WHERE est_actif = 1 AND role IN ('permanent', 'temporaire')")
    .all();
}

function createVente(article, quantite, prix, type_paiement, artisan_id, vendeur_id, date_vente) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO ventes (article, quantite, prix, type_paiement, artisan_id, vendeur_id, date_vente) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(article, quantite, prix, type_paiement, artisan_id, vendeur_id, date_vente);
  return result.lastInsertRowid;
}

function getAllVentes() {
  const db = getDb();
  return db
    .prepare(
      `SELECT v.*, a.nom AS artisan_nom, ve.nom AS vendeur_nom
       FROM ventes v
       LEFT JOIN users a ON v.artisan_id = a.id
       LEFT JOIN users ve ON v.vendeur_id = ve.id
       ORDER BY v.date_vente DESC, v.id DESC`
    )
    .all();
}

function getVentesByArtisan(artisan_id) {
  const db = getDb();
  const ventes = db
    .prepare(
      `SELECT v.*, a.nom AS artisan_nom, ve.nom AS vendeur_nom
       FROM ventes v
       LEFT JOIN users a ON v.artisan_id = a.id
       LEFT JOIN users ve ON v.vendeur_id = ve.id
       WHERE v.artisan_id = ?
       ORDER BY v.date_vente DESC, v.id DESC`
    )
    .all(artisan_id);

  const summary = db
    .prepare(
      `SELECT COUNT(*) as total_articles, COALESCE(SUM(prix * quantite), 0) as total_montant
       FROM ventes WHERE artisan_id = ?`
    )
    .get(artisan_id);

  return { ventes, summary };
}

function updateVente(id, fields) {
  const db = getDb();
  const allowed = ['article', 'quantite', 'prix', 'type_paiement', 'artisan_id', 'date_vente'];
  const setClauses = [];
  const params = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = ?`);
      params.push(fields[key]);
    }
  }

  if (setClauses.length === 0) return false;

  params.push(id);
  const result = db.prepare(`UPDATE ventes SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  return result.changes > 0;
}

function deleteVente(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM ventes WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  initTables,
  findUserByEmail,
  findUserById,
  getAllArtisans,
  createVente,
  getAllVentes,
  getVentesByArtisan,
  updateVente,
  deleteVente
};