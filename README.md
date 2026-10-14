QuickNotes System Design

QuickNotes started as a browser-only note-taking app. This project plans how it can become a real online service for 1 million users. It has two halves: a small API client that proves a web page can talk to an API (using the JSONPlaceholder practice API), and three design documents that describe the real API, database and architecture a backend team would build.

What is in this repository
quicknotes-system-design/
├── index.html          the API client page
├── style.css           styles for the page
├── api.js              the API client code (GET, POST and DELETE)
├── README.md           this file
└── docs/
    ├── api-design.md   the REST API design
    ├── data-model.md   the database design
    └── architecture.md the system architecture for 1 million users
The API client

The client talks to JSONPlaceholder, a free practice API, and treats its "posts" as notes.

Features
Load notes (GET): loads 10 notes from the server and shows each note's title and body.
Create a note (POST): sends a new note to the server, validates the title first (required, at most 100 characters), and shows the new note at the top of the list with the status code and id.
Delete a note (DELETE): removes a note with its own Delete button.
Clear states: the page shows loading, success, error and empty messages.
Safe and careful: buttons are disabled while a request is running, every request is wrapped in try / catch / finally, and user text is inserted with textContent only.
A note about JSONPlaceholder

JSONPlaceholder is a practice API. It replies as if changes worked, but it never really stores them. Every note you create comes back with the id 101, and a deleted note comes back the next time you click "Load notes". The client handles this by removing notes that were only created on the page without sending a server request, and the approach is explained in a comment in api.js.

How to run the API client
Clone the repository:
   git clone https://github.com/rozzie01/quicknotes-system-design.git
Open the quicknotes-system-design folder in VS Code.
Right-click index.html and choose Open with Live Server (or open index.html directly in your browser).
Click Load notes, create a note with the form, and try the Delete buttons.

No installation or build step is needed, but you need an internet connection to reach JSONPlaceholder.

Design documents
API design: the REST endpoints, request and response examples, and error codes for the real QuickNotes API.
Data model: the tables, relationships, SQL, indexes and the choice of SQL over NoSQL.
Architecture: requirements, load estimates for 1 million users, the architecture diagram, request flows, trade-offs and how single points of failure are avoided.
What I learned
One reusable request function. Putting fetch and the response.ok check in a single request() function meant GET, POST and DELETE all got the same error handling. fetch does not throw on 404 or 500, so the status has to be checked by hand.
Every request has four states. Good clients show loading, success, error and empty states, and use finally to re-enable buttons whether the request worked or failed.
Scope matters. I had a function written inside another function, so other code could not call it and creating a note failed. Moving it to the top level fixed it, and it taught me to check where each function sits.
REST design. Resources are plural nouns, the HTTP method says the action, and status codes carry meaning: 201 for created, 204 for deleted, 401 for not logged in and 403 for not allowed.
Relationships need the right tables. A one-to-many relationship uses a foreign key, but a many-to-many relationship, like notes and tags, needs a join table.
Scaling comes from adding the right parts. A read-heavy app benefits from a cache, a read replica and a CDN, and every component has to be paired with a way to avoid a single point of failure.