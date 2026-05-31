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
GET  /api/posts?feed=new|top|rising|controversial&tag=Space&unseen=1
POST /api/posts
DELETE /api/posts/:id
POST /api/posts/:id/save
DELETE /api/posts/:id/save
POST /api/posts/:id/seen
DELETE /api/posts/:id/seen
POST /api/posts/:id/vote
GET  /api/posts/:id/comments
POST /api/posts/:id/comments
GET  /api/saved-posts
GET  /api/users/me/crewmates
POST /api/users/:id/follow
POST /api/users/:id/unfollow
GET  /api/missions
POST /api/missions/:id/join
GET  /api/notifications
PATCH /api/notifications/:id/read
```

Post payload:

```json
{
  "title": "Short transmission title",
  "body": "Full post body",
  "tag": "Space",
  "roomId": "cafeteria"
}
```

Post response shape:

```json
{
  "id": "uuid",
  "authorId": "demo-user",
  "authorName": "DevSpace Crew",
  "title": "Short transmission title",
  "body": "Full post body",
  "tag": "Space",
  "roomId": "cafeteria",
  "score": 3,
  "upvotes": 4,
  "downvotes": 1,
  "commentCount": 2,
  "savedByMe": false,
  "seenByMe": false,
  "createdAt": "2026-05-30T00:00:00.000Z"
}
```

The API uses a local SQLite database at:

```txt
server/data/devspace.sqlite
```

For now, every request uses the seeded demo user:

```txt
demo-user
```
