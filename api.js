// ---------- 1. Constants and elements ----------
const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.querySelector("#load-btn");
const statusText = document.querySelector("#status");
const list = document.querySelector("#notes-list");

// ---------- 2. One reusable function for every request ----------
async function request(url, options = {}) {
  const response = await fetch(url, options);

  // fetch does NOT throw on 404 or 500, so we check response.ok ourselves
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return { data: data, status: response.status };
}

// ---------- 3. API functions ----------
async function getNotes() {
  const result = await request(`${API_URL}?_limit=10`);
  return result.data;
}

// ---------- 4. Showing things on the page ----------
function setStatus(message, type) {
  statusText.textContent = message;
  statusText.className = type; // "loading", "success", "error" or ""
}

function renderNote(note) {
  const li = document.createElement("li");
  li.classList.add("note");

  const title = document.createElement("h3");
  title.classList.add("note-title");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.classList.add("note-body");
  body.textContent = note.body;

  li.appendChild(title);
  li.appendChild(body);
  return li;
}

function renderNotes(notes) {
  list.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty-message");
    empty.textContent = "No notes to show yet.";
    list.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    list.appendChild(renderNote(note));
  });
}

// ---------- 5. Load notes (GET) ----------
async function loadNotes() {
  setStatus("Loading notes...", "loading");
  loadBtn.disabled = true;
  list.replaceChildren();

  try {
    const notes = await getNotes();
    renderNotes(notes);

    if (notes.length === 0) {
      setStatus("The server has no notes yet.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus("Could not load notes. Please try again.", "error");
    console.error(error);
  } finally {
    loadBtn.disabled = false; // runs after success AND after failure
  }
}

// ---------- 6. Listeners ----------
loadBtn.addEventListener("click", loadNotes);

