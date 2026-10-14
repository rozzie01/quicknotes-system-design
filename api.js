// ---------- 1. Constants and elements ----------
const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");

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

async function createNote(title, text) {
  return request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, body: text, userId: 1 }),
  });
}

// ---------- 4. Showing things on the page ----------
function getTitleError(title) {
  if (title === "") {
    return "Please enter a title.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }
  return ""; // no error
}

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

function removeEmptyMessage() {
  const empty = list.querySelector(".empty-message");
  if (empty) {
    empty.remove();
  }
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

// ---------- Create a note (POST) ----------
async function handleSubmit(event) {
  event.preventDefault(); // stop the page reloading

  const title = titleInput.value.trim();
  const text = bodyInput.value.trim();

  // 1. Validate first
  const validationError = getTitleError(title);
  if (validationError !== "") {
    setStatus(validationError, "error");
    titleInput.focus();
    return; // stop here: no request is sent
  }

  // 2. Loading state
  setStatus("Creating note...", "loading");
  submitBtn.disabled = true;

  // 3. Send the request
  try {
    const result = await createNote(title, text);

    removeEmptyMessage();
    list.prepend(renderNote(result.data)); // top of the list

    setStatus(
      `Note created (status ${result.status}, id ${result.data.id}).`,
      "success"
    );

    form.reset(); // clear the form
    titleInput.focus();
  } catch (error) {
    setStatus("Could not create the note. Please try again.", "error");
    console.error(error);
  } finally {
    submitBtn.disabled = false; // success or failure
  }
}

// ---------- 6. Listeners ----------
loadBtn.addEventListener("click", loadNotes);
form.addEventListener("submit", handleSubmit);