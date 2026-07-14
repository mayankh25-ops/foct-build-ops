"use client";

/**
 * Live Melbourne weather for the dashboard widget — Open-Meteo (no API key,
 * fine for a public forecast). Falls back to the demo snapshot from
 * demo-data when the request fails (offline kiosk, blocked egress), so the
 * widget never looks broken.
 */
import * as React from "react";
import { weather as demoWeather } from "@/lib/demo-data";

export interface WeatherView {
  city: string;
  tempC: number;
  feelsLikeC: number;
  condition: string;
  windKmh: number;
  hourly: Array<{ at: string; tempC: number; kind: "rain" | "cloud" }>;
  live: boolean;
}

/** WMO weather codes → short label + rain flag. */
function describe(code: number): { label: string; rain: boolean } {
  if (code === 0) return { label: "Clear", rain: false };
  if (code <= 2) return { label: "Partly cloudy", rain: false };
  if (code === 3) return { label: "Overcast", rain: false };
  if (code <= 49) return { label: "Fog", rain: false };
  if (code <= 59) return { label: "Drizzle", rain: true };
  if (code <= 69) return { label: "Rain", rain: true };
  if (code <= 79) return { label: "Snow", rain: true };
  if (code <= 84) return { label: "Showers", rain: true };
  return { label: "Storm", rain: true };
}

const URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-37.8136&longitude=144.9631" +
  "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
  "&hourly=temperature_2m,weather_code&forecast_days=2&timezone=Australia%2FMelbourne";

export function useLiveWeather(): WeatherView {
  const [view, setView] = React.useState<WeatherView>({ ...demoWeather, hourly: [...demoWeather.hourly], live: false });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(URL);
        if (!res.ok) return;
        const data = (await res.json()) as {
          current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number };
          hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] };
        };
        const nowIdx = Math.max(
          0,
          data.hourly.time.findIndex((t) => new Date(t) >= new Date())
        );
        const hourly = [0, 3, 6, 9, 12, 15].map((off) => {
          const i = Math.min(nowIdx + off, data.hourly.time.length - 1);
          const d = new Date(data.hourly.time[i]!);
          return {
            at: off === 0 ? "Now" : d.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true }).replace(" ", ""),
            tempC: Math.round(data.hourly.temperature_2m[i]!),
            kind: describe(data.hourly.weather_code[i]!).rain ? ("rain" as const) : ("cloud" as const),
          };
        });
        if (cancelled) return;
        setView({
          city: "Melbourne",
          tempC: Math.round(data.current.temperature_2m),
          feelsLikeC: Math.round(data.current.apparent_temperature),
          condition: describe(data.current.weather_code).label,
          windKmh: Math.round(data.current.wind_speed_10m),
          hourly,
          live: true,
        });
      } catch {
        /* demo fallback stays */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return view;
}
