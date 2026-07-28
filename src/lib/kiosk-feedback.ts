"use client";

/**
 * Sound and haptics for the kiosk.
 *
 * Silence makes people press twice. A wall tablet gets tapped with wet hands,
 * gloves, and without reading glasses, so every press needs an answer the user
 * can hear as well as see: a soft click on a key, a rising two-tone on
 * success, a low tone on refusal.
 *
 * Generated with WebAudio rather than shipped as audio files — three short
 * tones are not worth three network requests on a tablet that may be offline,
 * and a synthesised tone always plays instantly.
 *
 * Muted by default until the first user gesture, because browsers block audio
 * before one and a blocked tone is worse than no tone.
 */

const MUTE_KEY = "foct.kiosk.sound";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    // iOS suspends the context until a gesture resumes it
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "off";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "off" : "on");
}

/** One short tone. Volume is deliberately low — this is a room people work in. */
function tone(freq: number, ms: number, volume = 0.06, delayMs = 0): void {
  const a = audio();
  if (!a || isMuted()) return;
  const start = a.currentTime + delayMs / 1000;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  // a tiny attack and a real decay: a square-edged tone sounds like a fault
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + ms / 1000 + 0.02);
}

function buzz(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || isMuted()) return;
  navigator.vibrate?.(pattern);
}

/** A keypad press. */
export function feedbackTap(): void {
  tone(880, 60, 0.045);
  buzz(8);
}

/** Signed in or out. */
export function feedbackSuccess(): void {
  tone(660, 110, 0.07);
  tone(990, 190, 0.07, 90);
  buzz([12, 40, 18]);
}

/** Wrong PIN, already signed in, anything refused. */
export function feedbackRefuse(): void {
  tone(300, 220, 0.07);
  buzz([30, 60, 30]);
}
