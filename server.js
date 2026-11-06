const express = require("express");
const session = require("express-session");
const path = require("path");
const db = require("./src/database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "replace-this-secret-before-production",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" }
}));
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: "Please log in as administrator." });
  }
  next();
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (username === expectedUser && password === expectedPassword) {
    req.session.admin = username;
    return res.json({ message: "Login successful", username });
  }
  return res.status(401).json({ error: "Invalid username or password." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out" }));
});

app.get("/api/session", (req, res) => {
  res.json({ loggedIn: Boolean(req.session.admin), username: req.session.admin || null });
});

app.get("/api/books", requireAdmin, (req, res) => {
  const q = (req.query.q || "").trim();
  const sql = q
    ? "SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ? ORDER BY id DESC"
    : "SELECT * FROM books ORDER BY id DESC";
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/books", requireAdmin, (req, res) => {
  const { title, author, isbn, total_copies } = req.body;
  if (!title || !author || !Number.isInteger(Number(total_copies)) || Number(total_copies) < 1) {
    return res.status(400).json({ error: "Title, author and a positive number of copies are required." });
  }
  db.run(
    "INSERT INTO books (title, author, isbn, total_copies, available_copies) VALUES (?, ?, ?, ?, ?)",
    [title.trim(), author.trim(), (isbn || "").trim(), Number(total_copies), Number(total_copies)],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      db.get("SELECT * FROM books WHERE id = ?", [this.lastID], (_, row) => res.status(201).json(row));
    }
  );
});

app.put("/api/books/:id", requireAdmin, (req, res) => {
  const { title, author, isbn, total_copies } = req.body;
  const copies = Number(total_copies);
  if (!title || !author || !Number.isInteger(copies) || copies < 1) {
    return res.status(400).json({ error: "Enter valid book details and total copies." });
  }
  db.get("SELECT * FROM books WHERE id = ?", [req.params.id], (err, book) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!book) return res.status(404).json({ error: "Book not found." });
    const issued = book.total_copies - book.available_copies;
    if (copies < issued) return res.status(400).json({ error: "Total copies cannot be less than currently issued copies." });
    const available = copies - issued;
    db.run(
      "UPDATE books SET title=?, author=?, isbn=?, total_copies=?, available_copies=? WHERE id=?",
      [title.trim(), author.trim(), (isbn || "").trim(), copies, available, req.params.id],
      function (updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        db.get("SELECT * FROM books WHERE id = ?", [req.params.id], (_, row) => res.json(row));
      }
    );
  });
});

app.delete("/api/books/:id", requireAdmin, (req, res) => {
  db.get("SELECT COUNT(*) AS count FROM loans WHERE book_id=? AND status='ISSUED'", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row.count > 0) return res.status(400).json({ error: "Cannot delete a book while copies are issued." });
    db.run("DELETE FROM books WHERE id=?", [req.params.id], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });
      if (!this.changes) return res.status(404).json({ error: "Book not found." });
      res.json({ message: "Book deleted successfully." });
    });
  });
});

app.get("/api/students", requireAdmin, (req, res) => {
  db.all("SELECT * FROM students ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/students", requireAdmin, (req, res) => {
  const { name, email, student_no } = req.body;
  if (!name || !email || !student_no) return res.status(400).json({ error: "Name, email and student number are required." });
  db.run(
    "INSERT INTO students (name, email, student_no) VALUES (?, ?, ?)",
    [name.trim(), email.trim(), student_no.trim()],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      db.get("SELECT * FROM students WHERE id=?", [this.lastID], (_, row) => res.status(201).json(row));
    }
  );
});

app.post("/api/loans/issue", requireAdmin, (req, res) => {
  const { book_id, student_id, due_date } = req.body;
  if (!book_id || !student_id || !due_date || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
    return res.status(400).json({ error: "Book, student and due date (YYYY-MM-DD) are required." });
  }
  db.get("SELECT * FROM books WHERE id=?", [book_id], (err, book) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!book) return res.status(404).json({ error: "Book not found." });
    if (book.available_copies < 1) return res.status(400).json({ error: "No copies are currently available." });
    db.get("SELECT * FROM students WHERE id=?", [student_id], (studentErr, student) => {
      if (studentErr) return res.status(500).json({ error: studentErr.message });
      if (!student) return res.status(404).json({ error: "Student not found." });
      db.run(
        "INSERT INTO loans (book_id, student_id, issue_date, due_date, status) VALUES (?, ?, date('now'), ?, 'ISSUED')",
        [book_id, student_id, due_date],
        function (loanErr) {
          if (loanErr) return res.status(500).json({ error: loanErr.message });
          db.run("UPDATE books SET available_copies=available_copies-1 WHERE id=?", [book_id], updateErr => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.status(201).json({ message: "Book issued successfully.", loan_id: this.lastID });
          });
        }
      );
    });
  });
});

app.post("/api/loans/:id/return", requireAdmin, (req, res) => {
  db.get("SELECT * FROM loans WHERE id=?", [req.params.id], (err, loan) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!loan) return res.status(404).json({ error: "Issue record not found." });
    if (loan.status === "RETURNED") return res.status(400).json({ error: "This book has already been returned." });
    db.get("SELECT CAST(MAX(0, julianday(date('now')) - julianday(due_date)) AS INTEGER) AS days FROM loans WHERE id=?", [loan.id], (fineErr, fineRow) => {
      if (fineErr) return res.status(500).json({ error: fineErr.message });
      const overdueDays = fineRow.days || 0;
      const fine = overdueDays * Number(process.env.FINE_PER_DAY || 5);
      db.serialize(() => {
        db.run("UPDATE loans SET status='RETURNED', return_date=date('now'), fine=? WHERE id=?", [fine, loan.id]);
        db.run("UPDATE books SET available_copies=available_copies+1 WHERE id=?", [loan.book_id]);
        db.get("SELECT * FROM loans WHERE id=?", [loan.id], (_, updated) => {
          res.json({ message: "Book returned successfully.", overdue_days: overdueDays, fine, loan: updated });
        });
      });
    });
  });
});

app.get("/api/loans", requireAdmin, (req, res) => {
  db.all(
    `SELECT loans.*, books.title AS book_title, students.name AS student_name
     FROM loans JOIN books ON books.id=loans.book_id
     JOIN students ON students.id=loans.student_id
     ORDER BY loans.id DESC`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", application: "Online Library Management System" }));

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => console.log(`Library app running at http://localhost:${PORT}`));
}
module.exports = app;
