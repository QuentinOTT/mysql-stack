const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) console.error('Erreur DB:', err.message);
  else { console.log('✅ Connecté à MySQL !'); connection.release(); }
});

// ─────────────────────────────────────────────────
// Colonnes autorisées pour le tri (anti-injection)
// ─────────────────────────────────────────────────
const SORTABLE_COLS = new Set([
  'id','player','nation','pos','squad','comp','age','born','mp','starts','min',
  'nineties','gls','ast','g_a','xg','xag','npxg','g_pk','tkl','tklw','blocks',
  'interceptions','tkl_int','clr','err','prgp','prgc','kp','cmp_pct','ast_passing',
  'xa','ppa','ga','saves','save_pct','cs','cs_pct','pka','pksv','touches','carries',
  'prgr','mis','dis','crdy','crdr','pkwon','pkcon','recov',
]);

// ═══════════════════════════════════════════════════
//  ROUTES USERS
// ═══════════════════════════════════════════════════

app.get('/users', (req, res) => {
  db.query('SELECT * FROM users ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Les champs "name" et "email" sont requis.' });
  }
  db.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cet email existe déjà.' });
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: result.insertId, name, email });
  });
});

app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    res.json({ message: 'Utilisateur supprimé.', id: Number(id) });
  });
});

// ═══════════════════════════════════════════════════
//  ROUTES FOOTBALL
// ═══════════════════════════════════════════════════

app.get('/stats/overview', (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM players) AS totalPlayers,
      (SELECT IFNULL(SUM(gls), 0) FROM players) AS totalGoals,
      (SELECT JSON_OBJECT('player', player, 'gls', gls)
         FROM players ORDER BY gls DESC LIMIT 1) AS topScorer,
      (SELECT JSON_OBJECT('comp', comp, 'totalGls', SUM(gls))
         FROM players GROUP BY comp ORDER BY SUM(gls) DESC LIMIT 1) AS bestLeague
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const row = results[0];
    res.json({
      totalPlayers: row.totalPlayers,
      totalGoals: row.totalGoals,
      topScorer: row.topScorer || null,
      bestLeague: row.bestLeague || null,
    });
  });
});

app.get('/stats/overview-charts', (req, res) => {
  const queries = {
    byPos: 'SELECT pos, COUNT(*) AS count FROM players GROUP BY pos ORDER BY count DESC',
    goalsByComp: 'SELECT comp, SUM(gls) AS gls FROM players GROUP BY comp ORDER BY gls DESC',
    topClubs: 'SELECT squad, COUNT(*) AS count FROM players GROUP BY squad ORDER BY count DESC LIMIT 10',
  };

  const result = {};
  let pending = Object.keys(queries).length;

  for (const [key, sql] of Object.entries(queries)) {
    db.query(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (key === 'byPos') {
        const map = {};
        rows.forEach(r => { map[r.pos] = r.count; });
        result[key] = map;
      } else {
        result[key] = rows;
      }
      pending--;
      if (pending === 0) res.json(result);
    });
  }
});

app.get('/stats/filters', (req, res) => {
  const sqlComps = 'SELECT DISTINCT comp FROM players ORDER BY comp';
  const sqlPos = 'SELECT DISTINCT pos FROM players ORDER BY pos';

  db.query(sqlComps, (err, compRows) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query(sqlPos, (err2, posRows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({
        comps: compRows.map(r => r.comp),
        positions: posRows.map(r => r.pos),
      });
    });
  });
});

app.get('/players', (req, res) => {
  const { search = '', comp = '', pos = '', sort = 'id', order = 'asc', limit = '50' } = req.query;

  const conditions = [];
  const params = [];

  if (search) { conditions.push('(player LIKE ? OR squad LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (comp) { conditions.push('comp = ?'); params.push(comp); }
  if (pos) { conditions.push('pos = ?'); params.push(pos); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSort = SORTABLE_COLS.has(sort) ? sort : 'id';
  const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 9999);

  const sql = `SELECT * FROM players ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ?`;
  params.push(safeLimit);

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/players/table', (req, res) => {
  const {
    search = '', comp = '', pos = '', age_min = '', age_max = '',
    sort = 'gls', order = 'desc', page = '1', limit = '25',
  } = req.query;

  const conditions = [];
  const params = [];

  if (search) { conditions.push('(player LIKE ? OR squad LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (comp) { conditions.push('comp = ?'); params.push(comp); }
  if (pos) { conditions.push('pos = ?'); params.push(pos); }
  if (age_min) { conditions.push('age >= ?'); params.push(parseInt(age_min, 10)); }
  if (age_max) { conditions.push('age <= ?'); params.push(parseInt(age_max, 10)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSort = SORTABLE_COLS.has(sort) ? sort : 'gls';
  const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const countSql = `SELECT COUNT(*) AS total FROM players ${where}`;
  db.query(countSql, [...params], (err, countRows) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countRows[0].total;
    const pages = Math.ceil(total / safeLimit);

    const dataSql = `SELECT * FROM players ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
    db.query(dataSql, [...params, safeLimit, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ players: rows, meta: { total, page: safePage, limit: safeLimit, pages } });
    });
  });
});

// ═══════════════════════════════════════════════════
//  ROUTES CARS
// ═══════════════════════════════════════════════════

const CARS_SORTABLE = new Set([
  'car_id','date','customer_name','gender','annual_income','dealer_name',
  'company','model','engine','transmission','color','price',
  'dealer_no','body_style','phone','dealer_region'
]);

app.get('/cars', (req, res) => {
  const { search = '', transmission = '', sort = 'car_id', order = 'asc', limit = '50' } = req.query;

  const conditions = [];
  const params = [];

  if (search) { conditions.push('(company LIKE ? OR model LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (transmission) { conditions.push('transmission = ?'); params.push(transmission); }

  const where     = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSort  = CARS_SORTABLE.has(sort) ? sort : 'car_id';
  const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 9999);

  db.query(
    `SELECT * FROM car_sales ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ?`,
    [...params, safeLimit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});


// ─── Start ───
app.listen(3000, () => console.log('API lancée sur le port 3000'));
