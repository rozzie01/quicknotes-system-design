QuickNotes Architecture

This document describes how QuickNotes can be built and run for 1 million users: what the system must do, how much load it must handle, which components it needs and how a request travels through them.

1. Requirements
Functional requirements (what the system does)
Users can register and log in.
Users can create, list, view, edit and delete their own notes.
Each note has a category (personal, work or study) and can have tags.
Users can filter their notes by category or tag and search them by text.
Notes are private: a user can only see and change their own notes.
Slow jobs, such as welcome emails and note exports, run in the background.
Non-functional requirements (how well it does it)
Latency: GET /notes should respond in under 200 ms for 95% of requests.
Availability: at least 99.9% ("three nines"), which allows about 8.8 hours of downtime per year. No single component may take the whole system down.
Scalability: handle 1 million users and traffic peaks of about 5 times the average, and grow by adding servers.
Durability: a saved note is never lost, thanks to a replica and nightly backups that are regularly tested by restoring them.
Security: HTTPS only, hashed passwords, token authentication, and an ownership check on every note request.
Consistency: a list that is a few seconds out of date is acceptable (eventual consistency), but a note must never be saved twice or lost.
Observability: logs, metrics and alerts show problems before users notice.
2. Load estimate (1 million users)
Assumptions
1,000,000 registered users
20% use the app on a given day, so 200,000 daily active users (DAU)
Each active user creates 5 notes per day
Each active user loads their notes 20 times per day
An average note, including its extra fields, is about 500 bytes
One day is rounded to 100,000 seconds to keep the maths easy
Peak traffic is about 5 times the average
Calculation
Item	Working	Average	Peak (x5)
Writes (new notes)	200,000 x 5 = 1,000,000 per day; 1,000,000 / 100,000	10 writes per second	50 per second
Reads (loading notes)	200,000 x 20 = 4,000,000 per day; 4,000,000 / 100,000	40 reads per second	200 per second
Storage	1,000,000 notes x 500 bytes = 500 MB per day; x 365	about 180 GB per year	
What this tells us
The system is read-heavy: there are about 4 reads for every write, so caching and read replicas will help a lot.
200 requests per second at peak is manageable for a few ordinary app servers, and 180 GB per year fits comfortably in one well-indexed database. The design does not need to be enormous, and over-engineering would be a mistake.
If 80% to 90% of reads are served from the cache, only about 20 to 40 reads per second at peak ever reach the database.
3. Architecture diagram
                         ┌─────────┐
          ┌─────────────>│   DNS   │  (quicknotes.com -> IP addresses)
          │              └─────────┘
 ┌────────┴──────┐  static files  ┌──────────────────────┐
 │ Browser /     │ ─────────────> │ CDN (HTML, CSS, JS)  │
 │ mobile client │                └──────────────────────┘
 └────────┬──────┘
          │ API calls (HTTPS, JSON)
          v
   ┌───────────────┐
   │ Load balancer │
   └──────┬────────┘
     ┌────┴─────┬──────────┐
     v          v          v
 ┌───────┐  ┌───────┐  ┌───────┐        ┌───────────────┐
 │ App 1 │  │ App 2 │  │ App 3 │ ─────> │ Cache (Redis) │
 └───┬───┘  └───┬───┘  └───┬───┘        └───────────────┘
     │ writes   │ reads    │ jobs
     v          v          v
 ┌─────────┐ ┌──────────┐ ┌───────┐   ┌────────┐
 │ Primary │>│ Read     │ │ Queue │──>│ Worker │  (emails, exports)
 │   DB    │ │ replica  │ └───────┘   └────────┘
 └─────────┘ └──────────┘

Any app server can handle any request. The arrows are labelled by type of work: writes go to the primary database, reads go to the cache and the read replica, and slow jobs go to the queue. The primary copies every change to the read replica.

4. What each component does
Client (browser or mobile app) shows the notes to the user and sends API requests, which solves the problem of giving people an interface to the system.
DNS turns the name quicknotes.com into the IP address of our servers, so users do not need to remember numbers.
CDN keeps copies of the static files (HTML, CSS and JavaScript) on edge servers near users, which solves slow page loads for users far from our servers and takes load off them.
Load balancer spreads requests across the app servers and stops sending traffic to a server that fails its health check, which solves the problem of one server being overloaded or down.
App servers (two or more) run the API code (login, validation, notes), and because they are stateless we can add more of them when traffic grows.
Cache (Redis) keeps each user's recent note list in memory, so repeated reads are answered in about 1 ms and the database is protected from most of the read traffic.
Primary database stores the real, permanent copy of the data and is the only component that accepts writes, so all changes happen in one place.
Read replica is a live copy of the primary that answers read queries, which spreads the read load and gives a spare copy if the primary fails.
Queue holds background jobs, so slow work does not delay a response and a sudden burst of jobs waits in line instead of overloading the system.
Worker takes jobs from the queue and runs them (welcome emails, note exports), which keeps slow tasks away from the app servers.
5. Request flows
5.1 GET /notes (read)
The client already has the page from the CDN, and DNS has told it where the API is (usually cached, 0 to 20 ms). It sends GET /notes over HTTPS with its token in the Authorization header.
The load balancer picks the least busy healthy app server (about 1 ms).
The app server checks the token and finds the user, for example user 1 (1 to 2 ms).
It asks the cache for the key notes:user:1.
Cache hit: the notes come back in about 1 ms, and the app server sends the response. Total time at the server is under 10 ms.
Cache miss: the app server runs SELECT ... FROM notes WHERE user_id = 1 ORDER BY created_at DESC on the read replica (about 5 to 20 ms with the index on notes(user_id, created_at)), saves the result in the cache with a TTL of 5 minutes, and responds. The next request will be a hit.
The app server returns 200 OK with the JSON list.

Requests with filters or a search word (?category=work&search=report) skip the cache and go straight to the read replica, because there are too many possible combinations to cache.

5.2 POST /notes (write)
The client sends POST /notes with the token and the JSON body { "text": "Buy milk", "category": "personal" }.
The load balancer forwards it to any healthy app server.
The app server checks the token, then validates the data: the text must be 1 to 200 characters and the category must be one of the three allowed values. If not, it replies 400 Bad Request.
It writes the note to the primary database, with the owner taken from the token (about 5 to 10 ms). The database checks its own rules again.
It deletes the key notes:user:1 from the cache, so the next read fetches fresh data instead of an old list.
It replies 201 Created with the new note.
Within a few milliseconds the primary copies the new row to the read replica. If a read arrives before that, it may briefly miss the new note (see the trade-offs below).

The queue is not used for these two requests because they are fast. It is used for slow work, for example a welcome email after registration: the app server adds a job, replies at once, and a worker sends the email later.

5.3 When something breaks

If App Server 2 crashes, the load balancer's health check gets no reply and stops sending traffic there within seconds. Requests that were in progress fail, and a well-built client simply retries them on a healthy server. Because the app servers are stateless, no data is lost. An alert notifies an engineer, or an automatic system starts a replacement server. Most users notice nothing.

6. Trade-offs
Speed versus freshness. The cache and the read replica make reads fast and protect the database, but their data can be slightly out of date. We delete a user's cached list whenever they change a note, and we keep a short TTL. Because the replica copies the primary a few milliseconds late, a list read straight after a write could briefly miss the new note. This is acceptable for a notes app. If it were a problem, the app could read from the primary for a few seconds after a user writes.
Consistency versus availability. If the primary database fails, we promote the read replica so the service stays online, accepting that a few of the most recent changes might not have been copied yet. For notes, being available matters more than perfect consistency. A bank balance would make the opposite choice.
Simplicity versus scalability. QuickNotes is one well-organised application (a monolith), with no microservices and no database sharding. At 200 requests per second and 180 GB per year this is enough, and a simpler system is easier to build, debug and run. We can split parts out later if there is a clear reason.
Cost versus reliability. Extra app servers, a replica, a cache and a CDN cost money, but they remove single points of failure and keep the service up when one part fails. We use two or three app servers rather than dozens, to match the real load.
7. Avoiding single points of failure
Component	What would happen if it failed	How we avoid the problem
App server	Requests to that server fail	Two or more identical, stateless servers behind the load balancer, which skips unhealthy ones
Load balancer	No requests reach the app servers	Run a redundant pair, or use a managed cloud load balancer that is itself highly available
Primary database	Writes stop	The read replica can be promoted to primary (failover), and nightly backups are stored separately
Read replica	Reads fall back to the primary	The primary can answer reads temporarily, and a new replica can be created from it
Cache	Reads are slower, but nothing is lost	The cache only holds copies, so on failure requests go to the database, and the cache is rebuilt as it is used
Queue and worker	Background jobs are delayed	Jobs wait safely in the queue, and extra workers can be started
CDN	Pages load more slowly	The CDN keeps copies on many edge servers, and the origin can still serve the files
DNS	Users cannot find the site	Use a managed DNS provider with several servers
8. Monitoring and protection
Logs, metrics and alerts. Key measurements are the time GET /notes takes for 95% of requests, the percentage of requests that fail, and the percentage of reads served from the cache. An alert fires if, for example, more than 1% of requests fail.
Rate limiting. Each user is limited to about 100 requests per minute, and extra requests receive 429 Too Many Requests. This stops a buggy script from overwhelming the servers.
Timeouts and retries. Requests to the database or cache time out instead of waiting forever, and clients retry failed requests with increasing waits.
Graceful degradation. If search is down, users can still read and write notes.