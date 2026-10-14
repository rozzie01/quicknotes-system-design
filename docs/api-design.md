QuickNotes API Design

This document describes the REST API that the QuickNotes backend will offer to its clients (the web app and a future mobile app). The API follows REST conventions: resources are named with plural nouns, the HTTP method says what to do, and each request carries everything the server needs.

1. Conventions
Base URL: https://api.quicknotes.com
Format: every request body and response body is JSON (Content-Type: application/json).
Authentication: every endpoint except POST /auth/login needs a token in the Authorization header: Authorization: Bearer <token>.
Who is calling: the server finds the user from the token, so URLs never contain a user id. GET /notes returns only the logged-in user's notes.
Ids are integers. Dates use ISO 8601 in UTC, for example 2026-09-22T09:15:00Z.
Note fields: id, text (1 to 200 characters), category (one of personal, work or study), tags (a list of tag names) and createdAt.
HTTPS only. Plain HTTP requests are refused.
2. Endpoint summary
#	Method	Path	Description	Success status
1	POST	/auth/login	Log in and receive a token	200 OK
2	GET	/notes	List the logged-in user's notes (with optional filters)	200 OK
3	GET	/notes/{id}	Get one note	200 OK
4	POST	/notes	Create a note	201 Created
5	PATCH	/notes/{id}	Update some fields of a note	200 OK
6	DELETE	/notes/{id}	Delete a note	204 No Content
7	GET	/tags	List all tags	200 OK
8	POST	/notes/{id}/tags	Attach a tag to a note	201 Created
9	DELETE	/notes/{id}/tags/{tagId}	Remove a tag from a note	204 No Content
3. Endpoint details
3.1 POST /auth/login

Checks the email and password and returns a token. The token is then sent with every later request.

Request body

json
{
  "email": "amina@example.com",
  "password": "correct-horse-battery"
}

Response: 200 OK

json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
3.2 GET /notes

Returns the logged-in user's notes, newest first. There is no request body.

Query parameters (all optional)

Parameter	Meaning	Example
category	Only notes in this category	category=work
search	Only notes whose text contains this word (ignores case)	search=report
tag	Only notes with this tag	tag=urgent
page	Page number, starting at 1	page=2
limit	Notes per page (default 20, maximum 100)	limit=10

Example request

http
GET /notes?category=study&limit=2 HTTP/1.1
Host: api.quicknotes.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response: 200 OK

json
{
  "notes": [
    {
      "id": 4,
      "text": "Revise JavaScript arrays",
      "category": "study",
      "tags": ["exams"],
      "createdAt": "2026-09-23T10:00:00Z"
    },
    {
      "id": 1,
      "text": "Revise HTTP methods",
      "category": "study",
      "tags": ["exams", "urgent"],
      "createdAt": "2026-09-21T09:00:00Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 2
}

If the user has no matching notes, the response is still 200 OK with "notes": [] and "total": 0. An empty list is not an error.

3.3 GET /notes/{id}

Returns one note. There is no request body.

Response: 200 OK

json
{
  "id": 42,
  "text": "Buy milk",
  "category": "personal",
  "tags": [],
  "createdAt": "2026-09-22T09:15:00Z"
}
3.4 POST /notes

Creates a note for the logged-in user. The server sets the id, the owner and createdAt; the client never sends them.

Example request

http
POST /notes HTTP/1.1
Host: api.quicknotes.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
json
{
  "text": "Buy milk",
  "category": "personal"
}

Response: 201 Created

json
{
  "id": 42,
  "text": "Buy milk",
  "category": "personal",
  "tags": [],
  "createdAt": "2026-09-22T09:15:00Z"
}
3.5 PATCH /notes/{id}

Changes only the fields that are sent. Fields left out stay as they are.

Request body

json
{
  "text": "Buy milk and bread"
}

Response: 200 OK

json
{
  "id": 42,
  "text": "Buy milk and bread",
  "category": "personal",
  "tags": [],
  "createdAt": "2026-09-22T09:15:00Z"
}
3.6 DELETE /notes/{id}

Deletes the note and its tag links. There is no request body. Response: 204 No Content (nothing is sent back).

3.7 GET /tags

Returns every tag that can be attached to a note.

Response: 200 OK

json
{
  "tags": [
    { "id": 10, "name": "exams" },
    { "id": 11, "name": "urgent" }
  ]
}
3.8 POST /notes/{id}/tags

Attaches an existing tag to a note.

Request body

json
{
  "tagId": 11
}

Response: 201 Created

json
{
  "noteId": 42,
  "tagId": 11
}
3.9 DELETE /notes/{id}/tags/{tagId}

Removes one tag from a note without deleting the tag itself. Response: 204 No Content.

4. Error responses

Every error uses the same JSON shape, so clients can handle errors in one place:

json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Text must be between 1 and 200 characters."
  }
}
4.1 Error codes
Status	Meaning	When it happens	Example endpoint
400	Bad Request	The request is invalid: a missing field, an empty or too-long text, an unknown category	POST /notes with an empty text
401	Unauthorized	The user is not logged in: no token, an invalid token or an expired token	GET /notes without an Authorization header
403	Forbidden	The user is logged in but not allowed to do this	DELETE /notes/42 when note 42 belongs to someone else
404	Not Found	The note, tag or URL does not exist	GET /notes/9999 when no such note exists
500	Internal Server Error	Something broke on the server	A database failure while saving a note

Also possible: 429 Too Many Requests when a client sends requests too quickly (rate limiting).

4.2 Example error bodies

400 Bad Request (POST /notes with an empty text)

json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Text must be between 1 and 200 characters."
  }
}

401 Unauthorized (no token or an expired token)

json
{
  "error": {
    "status": 401,
    "code": "UNAUTHENTICATED",
    "message": "Missing or invalid token. Please log in again."
  }
}

403 Forbidden (DELETE /notes/42, owned by another user)

json
{
  "error": {
    "status": 403,
    "code": "FORBIDDEN",
    "message": "You are not allowed to delete this note."
  }
}

404 Not Found (GET /notes/9999)

json
{
  "error": {
    "status": 404,
    "code": "NOT_FOUND",
    "message": "Note 9999 does not exist."
  }
}

500 Internal Server Error

json
{
  "error": {
    "status": 500,
    "code": "INTERNAL_ERROR",
    "message": "Something went wrong on our side. Please try again later."
  }
}

The 500 message is deliberately vague: internal details such as database errors stay in the server logs and are never sent to the client.

5. Design notes
Authentication versus authorisation. 401 means "we do not know who you are". 403 means "we know who you are, but you may not do this".
Ownership is always checked. Every note query on the server also filters by the logged-in user's id, so one user can never read or change another user's notes.
PATCH instead of PUT because clients usually change one field at a time, so they should not have to resend the whole note.
Why 204 for DELETE. After a successful delete there is nothing useful to return.
Validation happens on the server too. The browser also checks input, but users can bypass a page, so the server enforces the 200-character limit and the allowed categories itself.