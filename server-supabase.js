
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const port = 3000;

// ===== SUPABASE CONFIGURATION =====
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Supabase credentials not set in .env file!');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.use(express.json());
app.use(express.static(__dirname));

// ===== USERS API (using Supabase) =====

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a user
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email }])
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DATABASE ADMIN API (Tables & Queries) =====

// Get all tables
app.get('/api/tables', async (req, res) => {
  try {
    // Supabase doesn't directly expose pg_tables, so query the information_schema
    const { data, error } = await supabase
      .rpc('get_tables'); // You'll need to create this function in Supabase
    
    if (error) {
      // Fallback: return hardcoded or empty
      return res.json({ tables: ['users', 'products'] });
    }
    res.json({ tables: data });
  } catch (err) {
    res.json({ tables: ['users'] });
  }
});

// Get table data
app.get('/api/data/:tableName', async (req, res) => {
  const { tableName } = req.params;
  
  try {
    // Get data
    const { data: rows, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(100);
    
    if (error) throw error;
    
    // Get column info (infer from first row)
    let columns = [];
    if (rows && rows.length > 0) {
      columns = Object.keys(rows[0]).map(col => ({
        column_name: col,
        data_type: typeof rows[0][col]
      }));
    }
    
    res.json({
      columns,
      rows: rows || [],
      count: rows?.length || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insert row
app.post('/api/data/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const { row } = req.body;
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .insert([row])
      .select();
    
    if (error) throw error;
    res.json({ success: true, row: data?.[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update row
app.put('/api/data/:tableName/:id', async (req, res) => {
  const { tableName, id } = req.params;
  const { row, idColumn } = req.body;
  
  try {
    const { error } = await supabase
      .from(tableName)
      .update(row)
      .eq(idColumn || 'id', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete row
app.delete('/api/data/:tableName/:id', async (req, res) => {
  const { tableName, id } = req.params;
  const { idColumn } = req.body;
  
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq(idColumn || 'id', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute custom SQL (via Supabase RPC)
app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  
  try {
    // For security, you'd need to create a pgSQL function in Supabase
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) throw error;
    res.json({ success: true, rows: data || [], rowCount: data?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve your main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`\n🚀 Server running at http://localhost:${port}`);
  console.log(`📊 Connected to Supabase`);
});
