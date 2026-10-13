import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { WordCloud } from '../components/WordCloud';
import { ApiError, getAdminCloud, revealCloud } from '../lib/api';

type Summary = {
  title: string;
  revealed: boolean;
  submissionCount: number;
};

type CloudView = {
  texts: string[];
  count: number;
};

export function AdminPage() {
  const { id = '', secret = '' } = useParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [view, setView] = useState<CloudView | null>(null);
  const [fatal, setFatal] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    async function tick() {
      try {
        const cloud = await getAdminCloud(id, secret);
        if (cancelled) return;
        setSummary({
          title: cloud.title,
          revealed: cloud.revealed,
          submissionCount: cloud.submissionCount,
        });
        if (cloud.revealed) {
          setView((current) => {
            if (current) return current;
            return {
              texts: cloud.submissions.map((submission) => submission.text),
              count: cloud.submissionCount,
            };
          });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          setFatal(err.status === 404 ? 'This word cloud does not exist.' : 'This admin link is not valid.');
          window.clearInterval(timer);
        }
      }
    }

    void tick();
    timer = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, secret]);

  async function onShow() {
    setPending(true);
    setActionError('');
    try {
      await revealCloud(id, secret);
      const cloud = await getAdminCloud(id, secret);
      setSummary({
        title: cloud.title,
        revealed: true,
        submissionCount: cloud.submissionCount,
      });
      setView({
        texts: cloud.submissions.map((submission) => submission.text),
        count: cloud.submissionCount,
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not show the cloud.');
    } finally {
      setPending(false);
    }
  }

  async function onUpdate() {
    setPending(true);
    setActionError('');
    try {
      const cloud = await getAdminCloud(id, secret);
      setSummary({
        title: cloud.title,
        revealed: cloud.revealed,
        submissionCount: cloud.submissionCount,
      });
      setView({
        texts: cloud.submissions.map((submission) => submission.text),
        count: cloud.submissionCount,
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update the cloud.');
    } finally {
      setPending(false);
    }
  }

  if (fatal) {
    return (
      <main className="stage">
        <h1>{fatal}</h1>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="stage">
        <p className="lede">Opening the admin screen…</p>
      </main>
    );
  }

  if (view) {
    const newer = summary.submissionCount - view.count;
    return (
      <main className="cloud-screen">
        <p className="cloud-title">{summary.title}</p>
        <WordCloud texts={view.texts} />
        {newer > 0 ? (
          <button className="secondary update-cloud" type="button" onClick={() => void onUpdate()} disabled={pending}>
            {pending ? 'Updating…' : `Update cloud (${newer} new)`}
          </button>
        ) : null}
        {actionError ? <p className="toast-error">{actionError}</p> : null}
      </main>
    );
  }

  const responses = summary.submissionCount === 1 ? 'response' : 'responses';

  return (
    <main className="stage">
      <p className="eyebrow">{summary.title}</p>
      <p className="count">{summary.submissionCount}</p>
      <p className="lede">{responses}</p>
      {actionError ? <p className="form-error">{actionError}</p> : null}
      <button className="primary show-button" type="button" onClick={() => void onShow()} disabled={pending}>
        {pending ? 'Showing…' : 'Show word cloud'}
      </button>
      <p className="hint">Participants cannot see this screen.</p>
    </main>
  );
}
