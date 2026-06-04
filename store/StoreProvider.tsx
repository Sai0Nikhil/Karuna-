// =====================================================================
// KARUNA — Store provider chooser.
//
// At boot, looks at VITE_API_URL: if set, mounts the RemoteCaseStoreProvider
// (REST + WebSocket); else mounts the local CaseStoreProvider (localStorage).
//
// Components that call useCaseStore() don't know or care which store is
// behind it — both expose the same hook surface.
// =====================================================================

import React from 'react';
import { CaseStoreProvider } from './caseStore';
import { RemoteCaseStoreProvider } from './remoteCaseStore';
import { REMOTE_ENABLED } from '../services/api';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (REMOTE_ENABLED) {
    return <RemoteCaseStoreProvider>{children}</RemoteCaseStoreProvider>;
  }
  return <CaseStoreProvider>{children}</CaseStoreProvider>;
};

export { REMOTE_ENABLED };
