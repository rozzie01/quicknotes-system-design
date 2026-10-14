QuickNotes Data Model

This document describes the database behind the QuickNotes API. The data is stored in a relational (SQL) database. The examples use SQLite syntax so they can be tested in any SQLite playground; the production system would use PostgreSQL.

1. Entities

QuickNotes needs four tables:

users: the people who have accounts.
notes: the notes that users write.
tags: labels such as "urgent" or "exams".
note_tags: a join table that links notes to tags.
users
Column	Type	Key	Notes
id	INTEGER	Primary key	Numbered automatically
name	TEXT		Required
email	TEXT		Required and unique (used to log in)
password_hash	TEXT		Required. Only a one-way hash is stored, never the password itself
created_at	TEXT		Filled in automatically
notes
Column	Type	Key	Notes
id	INTEGER	Primary key	Numbered automatically
user_id	INTEGER	Foreign key to users.id	Required. The owner of the note
text	TEXT		Required, 1 to 200 characters
category	TEXT		Required. One of personal, work or study (default personal)
created_at	TEXT		Filled in automatically
tags
Column	Type	Key	Notes
id	INTEGER	Primary key	Numbered automatically
name	TEXT		Required and unique, so "urgent" can only be stored once
note_tags
Column	Type	Key	Notes
note_id	INTEGER	Part of the primary key. Foreign key to notes.id	Required
tag_id	INTEGER	Part of the primary key. Foreign key to tags.id	Required

The primary key of note_tags is the pair (note_id, tag_id). This is a composite primary key: it identifies each row and stops the same tag being attached to the same note twice.

2. Relationships
users 1 -------- many notes          (one-to-many)
notes many ----- many tags           (many-to-many, through note_tags)
One-to-many: users and notes

One user can write many notes, but each note belongs to exactly one user. The "many" side holds the foreign key, so notes.user_id points to users.id. If a user is deleted, their notes are deleted too (ON DELETE CASCADE).

Many-to-many: notes and tags

One note can have many tags (a note can be both "exams" and "urgent"), and one tag can be on many notes. A foreign key can only point to one row, so neither table can hold this relationship by itself. A third table, the join table note_tags, stores one row for each note-and-tag pair. Deleting a note or a tag removes the matching note_tags rows automatically.

Storing tags as a comma-separated list in one column (such as "exams,urgent") would break the rule that each column holds one value. It would be hard to search, hard to update and impossible to protect with foreign keys, which is why the join table is used.

3. CREATE TABLE statements
sql
PRAGMA foreign_keys = ON;  -- SQLite only enforces foreign keys when asked

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  text        TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 200),
  category    TEXT NOT NULL DEFAULT 'personal'
              CHECK (category IN ('personal', 'work', 'study')),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id  INTEGER NOT NULL,
  tag_id   INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);

The database itself enforces the rules: NOT NULL, UNIQUE, CHECK and the foreign keys apply to every change, whoever makes it, so the data stays correct even if the application code has a bug.

4. Example queries
Query 1: all of one user's notes, newest first

Used by GET /notes.

sql
SELECT id, text, category, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC;
Query 2: one user's notes that have the tag "urgent" (JOIN)

Used by GET /notes?tag=urgent. This walks across the many-to-many relationship in two hops: from notes to note_tags, then to tags.

sql
SELECT notes.id, notes.text
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags      ON tags.id = note_tags.tag_id
WHERE tags.name = 'urgent'
  AND notes.user_id = 1;
Query 3: how many notes a user has in each category
sql
SELECT category, COUNT(*) AS note_count
FROM notes
WHERE user_id = 1
GROUP BY category;
Query 4: search one user's notes for a word

Used by GET /notes?search=revise.

sql
SELECT id, text, category
FROM notes
WHERE user_id = 1
  AND text LIKE '%revise%'
ORDER BY created_at DESC;
5. How the API endpoints become SQL

Each API endpoint from api-design.md becomes one SQL statement on the server. The ? marks are placeholders: the server fills them in safely with the user's data and never builds SQL by gluing user text into a string, which prevents SQL injection. The value of user_id always comes from the login token, never from the request.

sql
-- POST /notes
INSERT INTO notes (user_id, text, category) VALUES (?, ?, ?);

-- PATCH /notes/42
UPDATE notes SET text = ? WHERE id = 42 AND user_id = ?;

-- DELETE /notes/42
DELETE FROM notes WHERE id = 42 AND user_id = ?;

AND user_id = ? makes sure users can only change their own notes. If no row matches, the server answers with a 404 (or 403 if the note exists but belongs to someone else).

6. Indexes
sql
CREATE INDEX idx_notes_user_id_created_at ON notes(user_id, created_at);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
notes(user_id, created_at): almost every request asks for one user's notes, newest first (WHERE user_id = ? ORDER BY created_at DESC). Without an index the database would read every note in the table to find one user's notes. With this index it jumps straight to that user's rows, already in date order. At 1 million users and hundreds of millions of notes, this is the most important index in the system.
note_tags(tag_id): finding all notes with a given tag searches by tag_id. The primary key (note_id, tag_id) only helps when the search starts from the note.

The trade-off is that indexes make reads much faster but make writes slightly slower, because each index must be updated too, and they use extra storage. So indexes are added only on columns that are searched often. Primary keys and UNIQUE columns (such as users.email and tags.name) are indexed automatically.

7. SQL or NoSQL?

I would choose a SQL (relational) database: SQLite for development and PostgreSQL in production. QuickNotes data is clearly structured and full of relationships: users own notes, and notes have tags. SQL handles this naturally with foreign keys and JOINs, and it can enforce the rules inside the database itself, such as unique emails, the 200-character limit and the three allowed categories. Transactions also keep related changes together, so deleting a note and its tag links either fully happens or does not happen at all. At the estimated size of about 180 GB of notes per year for 1 million users, one well-indexed primary database with read replicas is enough, so there is no need for the extra scale of a NoSQL system. A document database such as MongoDB could become attractive if notes later held very flexible content (images, checklists, drawings) or if the data had to be spread across many servers, but it would make queries such as "all urgent notes for this user" harder and move the rule checking into application code.

8. Design notes
Tags are shared. The tags table is shared by all users to keep the design simple. If tag names should be private, a user_id column could be added to tags later.
Passwords are never stored. Only password_hash, a one-way scrambled value, is stored, so a stolen database does not reveal passwords.
Only the server talks to the database. The browser never connects to it directly, so the server can check the token and permissions first.
Types. The examples use SQLite types (INTEGER, TEXT). In PostgreSQL, created_at would use the TIMESTAMPTZ type instead of TEXT.