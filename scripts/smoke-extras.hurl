# Manual smoke entries for routes that the auto-discovery can't handle:
#   - routes with path params (`:id`, `:eventId`, etc.)
#   - POST/PUT/DELETE routes
#   - GET routes that require a query string to return a useful response
#
# Keep this file tiny — if you find yourself adding many entries here,
# consider whether the route should also have an integration test under
# api/src/__tests__/integration/ so the pre-deploy firestore-index-gen
# check picks up any composite queries it runs.

# MusicBrainz search requires a query string to hit the upstream API.
# Without it, the route returns 400. 4xx is fine for smoke — we only fail on 5xx.
GET {{base_url}}/mb/search?query=radiohead
HTTP *
[Asserts]
status < 500
