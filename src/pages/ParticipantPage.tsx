import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, getCloud, submitText } from '../lib/api';

export function ParticipantPage() {
  const { id = '' } = useParams();
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCloud(id)
      .then((cloud) => {
        if (cancelled) return;
        setTitle(cloud.title);
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setPhase('missing');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not open this word cloud.');
        setPhase('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setNote('');
    try {
      await submitText(id, text);
      setText('');
      setNote('Got it. Add another if you want.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that.');
    } finally {
      setPending(false);
    }
  }

  if (phase === 'loading') {
    return (
      <main className="shell">
        <p className="lede">Opening…</p>
      </main>
    );
  }

  if (phase === 'missing') {
    return (
      <main className="shell">
        <h1>Link not found</h1>
        <p className="lede">Ask the host for a new participant link.</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <p className="eyebrow">{title}</p>
      <h1>Add a word</h1>
      <p className="lede">The host will show the cloud when it is time. You will not see it here.</p>
      <form className="stack" onSubmit={onSubmit}>
        <label htmlFor="entry">Your word or phrase</label>
        <input
          id="entry"
          name="entry"
          type="text"
          maxLength={80}
          required
          placeholder="Something the room should hear"
          value={text}
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
        />
        {note ? <p className="form-note">{note}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary" type="submit" disabled={pending || text.trim().length === 0}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </form>
    </main>
  );
}
