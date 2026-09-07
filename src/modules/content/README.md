# Content Module

Owns content keys and translations (i18n). Shared layer.

## Reading copy

Two functions, both fed by one in-process cache (60s TTL, per locale):

- `t(db, key, params?, locale?)` — one key, with `{placeholder}` substitution.
- `tMany(db, keys[], locale?)` — a batch, resolved in **one** query.

`getLabels()` in `src/lib/i18n.ts` is what pages and layouts use; it wraps
`tMany` and falls back to the EN draft passed at the call site whenever a key
is missing or the database is unreachable.

**Always resolve a screen's copy in one `getLabels` call.** This is the app's
hottest read: a single admin page asks for ~120 keys across the root layout,
the admin shell and the page itself. Resolving them one at a time cost ~500
serialized round trips per navigation, which is what made the app feel
unresponsive; the batch costs one.

The cache stores **misses as well as hits**. A key with no row used to re-walk
the whole locale fallback chain against the database on every request, forever.
Missing keys are also warned about only once per process rather than once per
render.
