import { useState, type FormEvent } from 'react';
import { ApiError, createCloud, type CreatedCloud } from '../lib/api';

export function CreatePage() {
  const [title, setTitle] = useState('');
  const [created, setCreated] = useState<CreatedCloud | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      setCreated(await createCloud(title));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create a word cloud.');
    } finally {
      setPending(false);
    }
  }

  if (created) {
    const origin = window.location.origin;
    const participantUrl = `${origin}/c/${created.id}`;
    const adminUrl = `${origin}/a/${created.id}/${created.adminSecret}`;

    return (
      <main className="shell">
        <p className="eyebrow">{created.title}</p>
        <h1>Save both links</h1>
        <p className="lede">
          Share the participant link with the room. Keep the admin link. Anyone with it can show
          the cloud, and it cannot be recovered if you lose it.
        </p>
        <LinkCard label="Participant link" url={participantUrl} hint="People use this to add words. They never see the cloud." />
        <LinkCard label="Admin link" url={adminUrl} hint="Open this on the screen you will project." />
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setCreated(null);
            setTitle('');
          }}
        >
          Create another
        </button>
      </main>
    );
  }

  return (
    <main className="shell">
      <p className="eyebrow">For the room</p>
      <h1>Start a word cloud</h1>
      <p className="lede">
        Collect words from a shared link. The cloud stays on your admin screen until you choose to
        show it.
      </p>
      <form className="stack" onSubmit={onSubmit}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={80}
          placeholder="Optional, like Offsite 2026"
          value={title}
          autoComplete="off"
          onChange={(event) => setTitle(event.target.value)}
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary" type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create'}
        </button>
      </form>
    </main>
  );
}

function LinkCard({ label, url, hint }: { label: string; url: string; hint: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="link-card">
      <div className="link-card-top">
        <h2>{label}</h2>
        <button className="secondary" type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="url">{url}</p>
      <p className="hint">{hint}</p>
    </section>
  );
}
