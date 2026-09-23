import { useEffect, useState, useCallback } from 'react';

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Xato ${r.status}`);
  return r.json();
}

export const api = {
  matches: (from, to) => getJson(`/api/matches?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  match: (id) => getJson(`/api/matches/${id}`),
  analysis: (id) => getJson(`/api/matches/${id}/analysis`),
  timeline: (id) => getJson(`/api/matches/${id}/timeline`),
  leagues: () => getJson('/api/leagues'),
};

/** Oddiy fetch hook: { data, error, loading, reload } */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    load()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => {
      alive = false;
    };
  }, [load]);
  useEffect(() => reload(), [reload]);
  return { ...state, reload };
}

/** Server-Sent Events hook (live ma'lumotlar uchun) */
export function useSSE(url) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!url) return undefined;
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        setData(JSON.parse(e.data));
      } catch {
        /* e'tiborsiz */
      }
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [url]);
  return { data, connected };
}
