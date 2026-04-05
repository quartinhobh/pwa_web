# Quartinho API Specification

Source of truth for API contracts. QA writes Red tests from this document; feature-builder implements against it. Any contract change must be made here first by architect.

Base URL: `${API_URL}` (dev: `http://localhost:3001`)
Content-Type: `application/json` unless noted.

## Conventions

- **Auth**: bearer token in `Authorization: Bearer <firebaseIdToken>` except `POST /auth/guest`.
- **Roles**: `guest | user | moderator | admin`. Role enforcement via middleware.
- **Rate limits**: global 60 req/min per IP; write endpoints 20 req/min; `POST /auth/guest` 10 req/min.
- **Error shape**: `{ "error": "message", "code": "SNAKE_CASE" }`
- **Error codes**: `400` bad request, `401` no/invalid token, `403` wrong role, `404` not found, `409` conflict (e.g. concurrent vote write), `429` rate limited, `500` server.
- **Timestamps**: numeric epoch ms unless wrapping Firestore Timestamp.

---

## Auth

### POST /auth/guest
No auth. Creates an anonymous session with a generated guest name.
- Body: `{}`
- 200: `{ sessionId: string, guestName: string, firebaseUid: string }`
- 429: rate limited

### POST /auth/link
No auth (token supplied in body for first-time link).
- Body: `{ sessionId: string, firebaseIdToken: string }`
- 200: `{ userId: string }`
- 400: invalid token / missing session
- 409: session already linked to a different user

---

## Events

### GET /events
Auth: any authenticated user.
- Query: `{ page?: number (default 1), limit?: number (default 20, max 50), status?: EventStatus }`
- 200: `PaginatedResponse<Event>`

### GET /events/current
Auth: any authenticated user.
- 200: `Event | null` — the single `status: 'live'` event if any, else `null`.

### GET /events/:id
Auth: any authenticated user.
- 200: `Event`
- 404: not found

### POST /events  [Admin]
- Body: `EventCreatePayload` = `Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>`
- 201: `Event`
- 400: validation
- 403: not admin

### PUT /events/:id  [Admin]
- Body: `Partial<EventCreatePayload>`
- 200: `Event`
- 403/404

### DELETE /events/:id  [Admin]
- 204
- 403/404

### PUT /events/:id/spotify  [Admin]
- Body: `{ spotifyPlaylistUrl: string }`
- 200: `Event`

---

## MusicBrainz proxy

### GET /mb/album/:mbid
Auth: any. Cached server-side 24h.
- 200: `MusicBrainzRelease`
- 400: invalid mbid
- 404: not found upstream

### GET /mb/release-groups/:mbid/tracks
Auth: any.
- 200: `MusicBrainzTrack[]`

---

## Lyrics

### GET /lyrics/:artist/:title
Auth: any. URL-encoded path params.
- 200: `{ lyrics: string | null, source: LyricsSource, cached: boolean }`

### POST /lyrics/refresh  [Admin]
- Body: `{ artist: string, title: string }`
- 204

---

## Votes

### POST /votes/:eventId
Auth: any authenticated user. Only allowed while event `status === 'live'`.
- Body: `{ favoriteTrackId: string, leastLikedTrackId: string }`
- 200: `VoteRecord` (updated aggregate, user's previous vote replaced atomically via Firestore transaction)
- 400: same track for favorite + leastLiked; unknown trackId
- 403: event not live
- 409: transaction retry exhausted

### GET /votes/:eventId  [Admin during live / any after archived]
- 200: `VoteRecord`
- 403: not admin and event still live

### GET /votes/:eventId/user
Auth: any authenticated user.
- 200: `{ favoriteTrackId: string, leastLikedTrackId: string } | null`

---

## Moderation

### GET /moderation/bans  [Mod|Admin]
- 200: `Ban[]`

### POST /moderation/ban  [Mod|Admin]
- Body: `{ userId: string, reason?: string }`
- 201: `Ban`
- 403

### DELETE /moderation/ban/:userId  [Admin]
- 204

### GET /moderation/logs  [Admin]
- 200: `ModerationLog[]`

### POST /moderation/chat/:eventId/delete  [Mod|Admin]
- Body: `{ messageId: string, reason?: string }`
- 204

---

## Photos

### GET /photos/:eventId
Public. Returns all photos across both categories for an event, sorted by `createdAt` desc.
- 200: `{ photos: Photo[] }` where `Photo = { id, url, category: 'category1'|'category2', uploadedBy, createdAt }`

### POST /photos/:eventId/category1/upload  [Admin]
- multipart/form-data, field `file` (image, ≤5MB, jpg/png/webp)
- 201: `EventPhoto`
- 400: invalid file

### POST /photos/:eventId/category2/upload  [Admin]
- Same as above, category2 bucket path.

### DELETE /photos/:eventId/:category/:photoId  [Admin]
- 204
- 404

---

## Errors summary

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 400  | Validation / malformed body              |
| 401  | Missing or invalid Firebase ID token     |
| 403  | Authenticated but insufficient role      |
| 404  | Resource not found                       |
| 409  | Conflict (dup link, vote txn retry fail) |
| 429  | Rate limit exceeded                      |
| 500  | Unhandled server error                   |
