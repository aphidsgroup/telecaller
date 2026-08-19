'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <div className="card mt-3 flex items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Install this app</p>
        <p className="text-xs text-slate-500">Full screen, works through weak signal, gets notifications.</p>
      </div>
      <button
        className="btn-primary shrink-0"
        onClick={async () => {
          deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        Install
      </button>
    </div>
  );
}
