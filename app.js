const express = require('express');
const { Client } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Database configuration (same as your app.js)
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '1234'
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (your HTML, CSS, JS)
app.use(express.static('public'));

// API Routes - Get all users
app.get('/api/users', async (req, res) => {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// API Routes - Add a user
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// API Routes - Delete a user
app.delete('/api/users/:id', async (req, res) => {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

// Serve your index.html as the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`✅ Web server running at http://localhost:${port}`);
  console.log(`📊 API endpoint: http://localhost:${port}/api/users`);
  console.log(`🌐 Open in Chrome: http://localhost:${port}`);
});