# DevSpace API

Run the backend:

```powershell
npm.cmd run api:dev
```

Base URL:

```txt
http://localhost:4000/api
```

Useful endpoints:

```txt
GET  /api/health
GET  /api/users/me
GET  /api/posts
POST /api/posts
POST /api/posts/:id/save
GET  /api/saved-posts
GET  /api/missions
POST /api/missions/:id/join
GET  /api/notifications
PATCH /api/notifications/:id/read
```

The API uses a local SQLite database at:

```txt
server/data/devspace.sqlite
```

For now, every request uses the seeded demo user:

```txt
demo-user
```
