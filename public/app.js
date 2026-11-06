const $ = (id) => document.getElementById(id);
let booksCache = [];
let studentsCache = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
function message(text, isError = false) {
  const el = $("message");
  el.textContent = text;
  el.classList.toggle("error", isError);
  el.style.display = "block";
  clearTimeout(message.timer);
  message.timer = setTimeout(() => el.style.display = "none", 3500);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function showDashboard() {
  $("loginPanel").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  loadAll();
}
function showLogin() {
  $("dashboard").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");
}
async function loadBooks(query = "") {
  booksCache = await api(`/api/books${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  $("booksTable").innerHTML = booksCache.map(b => `
    <tr>
      <td>${b.id}</td><td>${escapeHtml(b.title)}</td><td>${escapeHtml(b.author)}</td>
      <td>${escapeHtml(b.isbn)}</td><td>${b.total_copies}</td><td>${b.available_copies}</td>
      <td><button data-edit="${b.id}">Edit</button><button class="secondary" data-delete="${b.id}">Delete</button></td>
    </tr>`).join("");
  $("emptyBooks").textContent = booksCache.length ? "" : "No matching books found.";
  $("issueBook").innerHTML = `<option value="">Select book</option>` + booksCache.filter(b => b.available_copies > 0)
    .map(b => `<option value="${b.id}">${escapeHtml(b.title)} (${b.available_copies} available)</option>`).join("");
}
async function loadStudents() {
  studentsCache = await api("/api/students");
  $("studentsTable").innerHTML = studentsCache.map(s => `<tr><td>${s.id}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.student_no)}</td></tr>`).join("");
  $("issueStudent").innerHTML = `<option value="">Select student</option>` + studentsCache.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.student_no)})</option>`).join("");
}
async function loadLoans() {
  const loans = await api("/api/loans");
  $("loansTable").innerHTML = loans.map(l => `<tr>
    <td>${l.id}</td><td>${escapeHtml(l.book_title)}</td><td>${escapeHtml(l.student_name)}</td>
    <td>${l.issue_date}</td><td>${l.due_date}</td><td>${l.status}</td><td>₹${Number(l.fine).toFixed(2)}</td>
    <td>${l.status === "ISSUED" ? `<button data-return="${l.id}">Return</button>` : "—"}</td>
  </tr>`).join("");
}
async function loadAll() {
  try { await Promise.all([loadBooks(), loadStudents(), loadLoans()]); }
  catch (e) { message(e.message, true); }
}
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/login", { method:"POST", body:JSON.stringify({ username:$("username").value, password:$("password").value }) });
    message("Login successful"); showDashboard();
  } catch (err) { message(err.message, true); }
});
$("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method:"POST" }); showLogin(); message("Logged out");
});
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === btn));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("hidden", p.id !== btn.dataset.tab));
}));
$("bookForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("bookId").value;
  const payload = { title:$("bookTitle").value, author:$("author").value, isbn:$("isbn").value, total_copies:Number($("totalCopies").value) };
  try {
    await api(id ? `/api/books/${id}` : "/api/books", { method:id ? "PUT" : "POST", body:JSON.stringify(payload) });
    e.target.reset(); $("bookId").value = ""; $("saveBook").textContent = "Add Book"; $("cancelEdit").classList.add("hidden");
    await loadBooks(); message(id ? "Book details updated" : "Book added successfully");
  } catch (err) { message(err.message, true); }
});
$("booksTable").addEventListener("click", async e => {
  const editId = e.target.dataset.edit, deleteId = e.target.dataset.delete;
  if (editId) {
    const b = booksCache.find(x => x.id === Number(editId));
    $("bookId").value=b.id; $("bookTitle").value=b.title; $("author").value=b.author;
    $("isbn").value=b.isbn || ""; $("totalCopies").value=b.total_copies;
    $("saveBook").textContent="Update Book"; $("cancelEdit").classList.remove("hidden");
  }
  if (deleteId && confirm("Delete this book?")) {
    try { await api(`/api/books/${deleteId}`, {method:"DELETE"}); await loadAll(); message("Book deleted"); }
    catch (err) { message(err.message, true); }
  }
});
$("cancelEdit").addEventListener("click", () => {
  $("bookForm").reset(); $("bookId").value=""; $("saveBook").textContent="Add Book"; $("cancelEdit").classList.add("hidden");
});
$("searchBtn").addEventListener("click", () => loadBooks($("searchBook").value).catch(e => message(e.message,true)));
$("showAllBtn").addEventListener("click", () => { $("searchBook").value=""; loadBooks().catch(e => message(e.message,true)); });
$("studentForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/students", {method:"POST", body:JSON.stringify({
      name:$("studentName").value, email:$("studentEmail").value, student_no:$("studentNo").value
    })});
    e.target.reset(); await loadStudents(); message("Student registered successfully");
  } catch (err) { message(err.message,true); }
});
$("issueForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/loans/issue", {method:"POST", body:JSON.stringify({
      book_id:Number($("issueBook").value), student_id:Number($("issueStudent").value), due_date:$("dueDate").value
    })});
    e.target.reset(); await loadAll(); message("Book issued successfully");
  } catch (err) { message(err.message,true); }
});
$("loansTable").addEventListener("click", async e => {
  const id = e.target.dataset.return;
  if (!id) return;
  try {
    const result = await api(`/api/loans/${id}/return`, {method:"POST"});
    await loadAll();
    message(`Book returned. Overdue days: ${result.overdue_days}; fine: ₹${result.fine}`);
  } catch (err) { message(err.message,true); }
});
(async () => {
  try { const s = await api("/api/session"); if (s.loggedIn) showDashboard(); }
  catch (_) { showLogin(); }
})();
