# Ambient Audio — PRD (registered 2026-07-18, owner directive)

> **Status: REGISTERED, NOT BUILT.** Owner: "register now, build post-Stage 9."
> Until then this module exists ONLY as a coming-soon shell (nav entry +
> module card). Per CLAUDE.md rule 7, do not start it — even if asked
> casually — without the owner explicitly opening the build stage.

## Purpose
Scheduled background music at reception/lobby, played through a provisioned
browser **player device** — the same pairing pattern as the kiosk: a device
record, a 6-digit pair code, bound to a building.

## Sources (v1)
1. **Uploaded tracks** — MP3/AAC to an org-scoped Supabase Storage bucket
   (storage RLS). Metadata table: title, duration, tags (calm / morning /
   evening), uploaded_by. No server-side transcode in v1; validate type +
   size (< 25 MB).
2. **Radio streams** — curated catalogue table of AU station stream URLs
   (name, genre, stream_url, logo). Admin can add custom stream URLs.

**NO Spotify/YouTube integration — prohibited by their terms for commercial
background playback. Never add casually.**

## Tables
`audio_devices`, `audio_tracks`, `audio_playlists`, `playlist_tracks`,
`audio_schedules` (building, days-of-week, start/end time, playlist OR
stream, volume, fade_in_seconds), `audio_playback_log`.

## Player route — `/player/:deviceToken`
- Fullscreen minimal UI (dark theme): now playing, schedule name, clock,
  connection status. HTML5 `<audio>` element.
- Subscribes to a Supabase Realtime channel for its device: play / pause /
  skip / volume commands apply instantly.
- **Scheduler:** on load + every minute, resolve the active schedule window;
  crossfade (3 s gain ramp via Web Audio API) between schedule transitions;
  default = silence outside schedules.
- **Resilience:** autoplay policies require one initial user gesture — show
  "Tap to start audio" on first load; reconnect logic for realtime drops; if
  a stream URL fails, fall back to a designated local playlist.
- Uploaded tracks cached via the Cache Storage API so brief network drops
  don't stop music.

## Concierge UI (module page)
- Device list with live status (playing / idle / offline, current track).
- Playlist builder (drag tracks, reorder, shuffle toggle).
- Schedule editor on a week grid — e.g. Mon–Fri 06:00–09:00 "Morning Calm"
  playlist vol 40%, 21:00–23:00 "Evening" vol 25%.
- Instant controls: play now / pause / skip / volume slider (overrides the
  schedule until the next window).
- Disclaimer line on the module page: **"Public playback of music may
  require a OneMusic Australia licence. Licensing is the venue's
  responsibility."**

## RLS
Tracks / playlists / schedules scoped to org × building; the concierge role
gets control permission via the standard `can()` model; `audio_playback_log`
is append-only.
