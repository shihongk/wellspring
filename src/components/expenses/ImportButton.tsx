'use client';

import { useState, useEffect } from 'react';
import { FileResult } from '@/lib/expenses/pipeline';

const FOLDER_KEY = 'wellspring:statements-folder';

type State = 'idle' | 'loading' | 'done' | 'error';

interface DoneData {
  imported: number;
  skipped: number;
  files: FileResult[];
}

export function ImportButton() {
  const [folder, setFolder] = useState('');
  const [state, setState] = useState<State>('idle');
  const [done, setDone] = useState<DoneData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setFolder(localStorage.getItem(FOLDER_KEY) ?? '');
  }, []);

  useEffect(() => {
    if (state !== 'done' && state !== 'error') return;
    const t = setTimeout(() => setState('idle'), 8000);
    return () => clearTimeout(t);
  }, [state]);

  function saveFolder(value: string) {
    setFolder(value);
    localStorage.setItem(FOLDER_KEY, value);
  }

  async function handleImport() {
    if (!folder.trim()) return;
    setState('loading');
    try {
      const res = await fetch('/api/expenses/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folder.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Import failed');
        setState('error');
      } else {
        setDone(json);
        setState('done');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setState('error');
    }
  }

  const warns = done?.files.filter(f => !f.error && f.parsed === 0) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={folder}
          onChange={e => saveFolder(e.target.value)}
          placeholder="/path/to/Pending"
          className="flex-1 px-3 py-2 rounded-md text-sm border border-slate-300 bg-white font-mono"
        />
        <button
          onClick={handleImport}
          disabled={state === 'loading' || !folder.trim()}
          className="px-4 py-2 rounded-md text-sm font-medium bg-cyan-700 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {state === 'loading' ? 'Importing…' : 'Import Statements'}
        </button>
      </div>
      {state === 'done' && done && (
        <div className="text-sm flex flex-col gap-0.5">
          <span className="text-green-600">
            {done.imported} imported, {done.skipped} skipped
          </span>
          {warns.map(f => (
            <span key={f.file} className="text-amber-600">
              {f.file}: 0 transactions parsed (type={f.type})
            </span>
          ))}
        </div>
      )}
      {state === 'error' && (
        <span className="text-sm text-red-600">{errorMsg}</span>
      )}
    </div>
  );
}
