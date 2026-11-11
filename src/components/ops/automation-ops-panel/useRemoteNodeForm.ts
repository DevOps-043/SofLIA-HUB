import { useCallback, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { RemoteImageState } from './types';

type Draft = { name: string; baseUrl: string; token: string; image: RemoteImageState | null };
const empty = (): Draft => ({ name: '', baseUrl: 'http://127.0.0.1:47825', token: '', image: null });

/** Un borrador o una captura tardía no se transfieren a otra sesión del panel. */
export function useRemoteNodeForm(owner: string) {
  const identity = useMemo(() => ({ owner }), [owner]);
  const live = useRef<{ identity: typeof identity } | null>(null);
  const [stored, setStored] = useState<{ identity: typeof identity; data: Draft } | null>(null);
  if (stored && stored.identity !== identity) setStored(null);
  useLayoutEffect(() => {
    live.current = { identity };
    return () => { live.current = null; };
  }, [identity]);
  const setField = useCallback(<K extends keyof Draft>(field: K, value: SetStateAction<Draft[K]>) => {
    const lease = live.current;
    if (!owner || lease?.identity !== identity) return;
    setStored(previous => {
      if (live.current !== lease) return previous;
      const data = previous?.identity === identity ? previous.data : empty();
      const next = typeof value === 'function' ? (value as (current: Draft[K]) => Draft[K])(data[field]) : value;
      return { identity, data: { ...data, [field]: next } };
    });
  }, [identity, owner]);
  const setters = useMemo(() => ({
    setName: (value: SetStateAction<string>) => setField('name', value),
    setBaseUrl: (value: SetStateAction<string>) => setField('baseUrl', value),
    setToken: (value: SetStateAction<string>) => setField('token', value),
    setImage: (value: SetStateAction<RemoteImageState | null>) => setField('image', value),
  }), [setField]);
  return { ...(stored?.identity === identity ? stored.data : empty()), ...setters };
}
