# Cameras & doors on the dashboard — setup guide

The dashboard's "Cameras & doors" panel shows live camera feeds and big
Lock/Unlock buttons for building doors. Everything runs LOCALLY on the
concierge PC — no cloud, no third-party service.

---

## Part A — Live RTSP cameras

Browsers cannot play RTSP directly. You run **go2rtc** (a free, single-file
program) on the same PC; it pulls RTSP from your cameras/NVR and re-serves
it in a browser-friendly format. The dashboard embeds those feeds.

### 1. Download go2rtc (once)
- Go to https://github.com/AlexxIT/go2rtc/releases
- Download `go2rtc_win64.zip`, unzip it somewhere permanent,
  e.g. `C:\go2rtc\go2rtc.exe`

### 2. Create `C:\go2rtc\go2rtc.yaml`
List each camera under `streams:` — the NAME on the left is what you enter
in the dashboard's Configure dialog:

```yaml
streams:
  lobby: rtsp://admin:PASSWORD@192.168.1.108/profile2/media.smp
  dock: rtsp://admin:PASSWORD@192.168.1.109/profile2/media.smp
  carpark: rtsp://admin:PASSWORD@192.168.1.110/profile2/media.smp
```

RTSP URL patterns for common brands (check your camera/NVR manual):
- **Hanwha / Wisenet**: `rtsp://user:pass@IP/profile2/media.smp`
  (profile2 is usually the lower-bandwidth sub-stream — ideal here)
- **Hikvision**: `rtsp://user:pass@IP:554/Streaming/Channels/102`
  (`102` = camera 1 sub-stream, `202` = camera 2 sub-stream…)
- **Dahua**: `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=1`
- **Akuvox intercom**: `rtsp://user:pass@IP/live/ch00_1`

Tip: always use the SUB-stream (lower resolution). Dashboard tiles are
small; sub-streams keep CPU and bandwidth low.

### 3. Run it
Double-click `go2rtc.exe` (or add it to Windows startup: Win+R →
`shell:startup` → paste a shortcut). Verify at **http://127.0.0.1:1984** —
you should see your streams listed and playable.

### 4. Connect the dashboard
Dashboard → Cameras & doors → **Configure** → gateway URL
`http://127.0.0.1:1984` (the default) → add each camera with the stream
name from your yaml (`lobby`, `dock`…). Tiles go **Live** automatically;
when go2rtc isn't running they show a calm "Gateway offline" state.

---

## Part B — Door soft-triggers

Each door button has two modes (Configure dialog):

- **Demo** (default): the button flips Locked/Unlocked on screen and logs
  the action — safe to demo anywhere, controls nothing.
- **HTTP**: additionally calls your door controller's LAN trigger URL.
  Most controllers expose one:
  - **Akuvox**: `http://user:pass@IP/fcgi/do?action=OpenDoor&UserName=...&DoorNum=1`
  - **Hikvision ISAPI**: door/relay endpoints under `http://IP/ISAPI/AccessControl/RemoteControl/door/1`
  - **Relay boards** (Shelly, ESP, etc.): `http://192.168.1.50/relay/0?turn=on`

To arm HTTP mode, add one line to `.env.local` on the concierge PC and
restart the app:

```
SECURITY_TRIGGERS_ENABLED=1
```

Safety rails built in:
- Without that flag, HTTP triggers do nothing (403).
- Trigger URLs are only accepted for PRIVATE-network addresses
  (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost, *.local).
- Every press lands in the on-screen security log with who and when.
- Optional **auto-relock** per door (e.g. main entrance relocks after 15 s).

> Stage 2 upgrade path: door permissions move behind the standard
> role/permission model (`can()`), and the log becomes audit_logs rows in
> the database.
