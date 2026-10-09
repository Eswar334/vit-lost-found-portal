import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const MetaContext = createContext(null);

/** Venues, categories and checkpoints come from the server so both sides agree. */
export function MetaProvider({ children }) {
  const [state, setState] = useState({ meta: null, error: null });

  const load = () => {
    setState({ meta: null, error: null });
    api('/meta')
      .then((meta) => setState({ meta, error: null }))
      .catch((error) => setState({ meta: null, error }));
  };

  useEffect(load, []);

  return <MetaContext.Provider value={{ ...state, retry: load }}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
