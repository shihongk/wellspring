'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'form' | 'testing' | 'tested' | 'provisioning' | 'saving' | 'done';

interface TestResult {
  title: string;
  sheetNames: string[];
  missingTabs: string[];
}

interface ProvisionResult {
  created: string[];
  skipped: string[];
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);

  const [fields, setFields] = useState({
    spreadsheetId: '',
    serviceAccountEmail: '',
    privateKey: '',
  });

  const set = (key: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }));

  const busy = step === 'testing' || step === 'provisioning' || step === 'saving';

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTestResult(null);
    setProvisionResult(null);
    setStep('testing');

    const res = await fetch('/api/setup/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? 'Connection failed.');
      setStep('form');
      return;
    }

    setTestResult(data);
    setStep('tested');
  }

  async function handleProvision() {
    setError(null);
    setStep('provisioning');

    const res = await fetch('/api/setup/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? 'Provisioning failed.');
      setStep('tested');
      return;
    }

    setProvisionResult(data);
    // Re-run test to refresh tab list
    const res2 = await fetch('/api/setup/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data2 = await res2.json();
    if (data2 && !data2.error) setTestResult(data2);

    setStep('tested');
  }

  async function handleSave() {
    setError(null);
    setStep('saving');

    const res = await fetch('/api/setup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? 'Failed to save.');
      setStep('tested');
      return;
    }

    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-bold">Setup complete</h1>
        <Card className="space-y-3">
          <p className="text-gain font-medium">✓ Credentials saved to .env.local</p>
          <p className="text-sm text-gray-600">
            Restart the dev server for the new environment variables to take effect, then head to the dashboard.
          </p>
          <div className="pt-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </div>
        </Card>
        <RestartNote />
      </div>
    );
  }

  const tabsOk = testResult && testResult.missingTabs.length === 0;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Connect Google Sheets</h1>
        <p className="text-sm text-gray-500 mt-1">
          Wellspring stores all data in a Google Spreadsheet. You can start with a completely blank sheet — the app will create all the tabs for you.
        </p>
      </div>

      <HowToGuide />

      <form onSubmit={handleTest} className="space-y-4">
        <Card className="space-y-4">
          <div>
            <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
            <Input
              id="spreadsheetId"
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              value={fields.spreadsheetId}
              onChange={set('spreadsheetId')}
              required
              disabled={busy}
            />
            <p className="text-xs text-gray-400 mt-1">From the URL: docs.google.com/spreadsheets/d/<strong>THIS_PART</strong>/edit</p>
          </div>

          <div>
            <Label htmlFor="serviceAccountEmail">Service Account Email</Label>
            <Input
              id="serviceAccountEmail"
              type="email"
              placeholder="my-account@my-project.iam.gserviceaccount.com"
              value={fields.serviceAccountEmail}
              onChange={set('serviceAccountEmail')}
              required
              disabled={busy}
            />
          </div>

          <div>
            <Label htmlFor="privateKey">Private Key</Label>
            <textarea
              id="privateKey"
              rows={5}
              placeholder={'-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
              value={fields.privateKey}
              onChange={set('privateKey')}
              required
              disabled={busy}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Paste the full key including the BEGIN/END lines. Newlines are handled automatically.</p>
          </div>
        </Card>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Connection result */}
        {testResult && (
          <div className={`rounded-lg border px-4 py-3 text-sm space-y-2 ${tabsOk ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <p className="font-medium">✓ Connected to &ldquo;{testResult.title}&rdquo;</p>
            {tabsOk ? (
              <p>All 5 required tabs found. Ready to save.</p>
            ) : (
              <div className="space-y-2">
                <p>
                  Missing tabs: <strong>{testResult.missingTabs.join(', ')}</strong>
                </p>
                <p className="text-xs">Click &ldquo;Set up sheet structure&rdquo; below and the app will create them automatically.</p>
              </div>
            )}
          </div>
        )}

        {/* Provision result */}
        {provisionResult && provisionResult.created.length > 0 && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-green-800 text-sm space-y-1">
            <p className="font-medium">✓ Sheet structure created</p>
            <p>Created: {provisionResult.created.join(', ')}</p>
            {provisionResult.skipped.length > 0 && (
              <p className="text-xs text-green-600">Already existed: {provisionResult.skipped.join(', ')}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Step 1: Test */}
          <Button type="submit" variant="secondary" disabled={busy}>
            {step === 'testing' ? 'Testing…' : 'Test Connection'}
          </Button>

          {/* Step 2 (optional): Provision missing tabs */}
          {testResult && !tabsOk && (
            <Button type="button" variant="secondary" onClick={handleProvision} disabled={busy}>
              {step === 'provisioning' ? 'Setting up…' : 'Set up sheet structure'}
            </Button>
          )}

          {/* Step 3: Save credentials */}
          {tabsOk && (
            <Button type="button" variant="primary" onClick={handleSave} disabled={busy}>
              {step === 'saving' ? 'Saving…' : 'Save & Continue'}
            </Button>
          )}
        </div>
      </form>

    </div>
  );
}

function HowToGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>How to get these credentials</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ol className="px-4 pb-4 space-y-2 text-sm text-gray-600 list-decimal list-inside border-t border-gray-100 pt-3">
          <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a> and create a project.</li>
          <li>Enable the <strong>Google Sheets API</strong> for that project.</li>
          <li>Go to <strong>IAM &amp; Admin → Service Accounts</strong> and create a service account.</li>
          <li>On the service account page, go to <strong>Keys → Add Key → Create new key → JSON</strong>. Download the file.</li>
          <li>Copy <code className="bg-gray-100 px-1 rounded">client_email</code> from the JSON → paste into Service Account Email above.</li>
          <li>Copy <code className="bg-gray-100 px-1 rounded">private_key</code> from the JSON → paste into Private Key above.</li>
          <li>Create a <strong>blank</strong> Google Spreadsheet and share it with the service account email as <strong>Editor</strong>.</li>
          <li>Copy the spreadsheet ID from the URL → paste above.</li>
          <li>Click <strong>Test Connection</strong>, then <strong>Set up sheet structure</strong> — done.</li>
        </ol>
      )}
    </div>
  );
}

function RestartNote() {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
      <strong>Important:</strong> Stop and restart <code className="bg-amber-100 px-1 rounded">npm run dev</code> — Next.js only reads <code className="bg-amber-100 px-1 rounded">.env.local</code> at startup.
    </div>
  );
}

