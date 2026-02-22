import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("finance.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('income', 'variable_income', 'fixed_expense', 'variable_expense')) NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    is_recurring INTEGER DEFAULT 0,
    installments INTEGER DEFAULT 1,
    start_date TEXT
  );

  CREATE TABLE IF NOT EXISTS investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    expected_return REAL,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    deadline TEXT NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    limit_amount REAL NOT NULL,
    period TEXT DEFAULT 'monthly'
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/transactions", (req, res) => {
    const transactions = db.prepare("SELECT * FROM transactions ORDER BY date DESC").all();
    res.json(transactions);
  });

  app.post("/api/transactions", (req, res) => {
    const { description, amount, type, category, date, is_recurring, installments, start_date } = req.body;
    const info = db.prepare(
      "INSERT INTO transactions (description, amount, type, category, date, is_recurring, installments, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(description, amount, type, category, date, is_recurring ? 1 : 0, installments || 1, start_date || date);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
    res.sendStatus(200);
  });

  app.get("/api/investments", (req, res) => {
    const investments = db.prepare("SELECT * FROM investments ORDER BY date DESC").all();
    res.json(investments);
  });

  app.post("/api/investments", (req, res) => {
    const { name, amount, type, expected_return, date } = req.body;
    const info = db.prepare(
      "INSERT INTO investments (name, amount, type, expected_return, date) VALUES (?, ?, ?, ?, ?)"
    ).run(name, amount, type, expected_return, date);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/summary", (req, res) => {
    const income = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'income'").get().total || 0;
    const variable_income = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'variable_income'").get().total || 0;
    const fixed = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'fixed_expense'").get().total || 0;
    const variable = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'variable_expense'").get().total || 0;
    const invested = db.prepare("SELECT SUM(amount) as total FROM investments").get().total || 0;
    
    res.json({ income, variable_income, fixed, variable, invested });
  });

  app.get("/api/goals", (req, res) => {
    const goals = db.prepare("SELECT * FROM goals").all();
    res.json(goals);
  });

  app.post("/api/goals", (req, res) => {
    const { name, target_amount, current_amount, deadline, category } = req.body;
    const info = db.prepare(
      "INSERT INTO goals (name, target_amount, current_amount, deadline, category) VALUES (?, ?, ?, ?, ?)"
    ).run(name, target_amount, current_amount || 0, deadline, category);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/goals/:id", (req, res) => {
    db.prepare("DELETE FROM goals WHERE id = ?").run(req.params.id);
    res.sendStatus(200);
  });

  app.get("/api/budgets", (req, res) => {
    const budgets = db.prepare("SELECT * FROM budgets").all();
    res.json(budgets);
  });

  app.post("/api/budgets", (req, res) => {
    const { category, limit_amount } = req.body;
    const info = db.prepare(
      "INSERT OR REPLACE INTO budgets (category, limit_amount) VALUES (?, ?)"
    ).run(category, limit_amount);
    res.json({ id: info.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
