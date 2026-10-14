import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ParticipantQr } from '../components/ParticipantQr';
import { ResponseTable } from '../components/ResponseTable';
import { WordCloud } from '../components/WordCloud';
import { ApiError, getAdminCloud, hideCloud, revealCloud } from '../lib/api';
import { shuffleItems } from '../lib/shuffle';

const EMPTY_TEXTS: readonly string[] = [];

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
  const [pending, setPending] = useState<'show' | 'hide' | 'update' | null>(null);
  const [viewMode, setViewMode] = useState<'cloud' | 'table'>('cloud');
  const actionGen = useRef(0);
  const responseTexts = view?.texts ?? EMPTY_TEXTS;
  const responseKey = responseTexts.join('\u0000');
  const [shuffled, setShuffled] = useState(() => ({
    key: responseKey,
    rows: shuffleItems(responseTexts),
  }));
  let tableRows = shuffled.rows;
  if (shuffled.key !== responseKey) {
    tableRows = shuffleItems(responseTexts);
    setShuffled({ key: responseKey, rows: tableRows });
  }

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    async function tick() {
      const genAtStart = actionGen.current;
      try {
        const cloud = await getAdminCloud(id, secret);
        if (cancelled || actionGen.current !== genAtStart) return;
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
        } else {
          setView(null);
        }
      } catch (err) {
        if (cancelled || actionGen.current !== genAtStart) return;
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
    const gen = ++actionGen.current;
    setPending('show');
    setActionError('');
    try {
      await revealCloud(id, secret);
      const cloud = await getAdminCloud(id, secret);
      if (actionGen.current !== gen) return;
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
      if (actionGen.current !== gen) return;
      setActionError(err instanceof ApiError ? err.message : 'Could not show the cloud.');
    } finally {
      finishAction(gen);
    }
  }

  async function onHide() {
    const gen = ++actionGen.current;
    setPending('hide');
    setActionError('');
    try {
      await hideCloud(id, secret);
      if (actionGen.current !== gen) return;
      setSummary((current) => (current ? { ...current, revealed: false } : current));
      setView(null);
    } catch (err) {
      if (actionGen.current !== gen) return;
      setActionError(err instanceof ApiError ? err.message : 'Could not hide the cloud.');
    } finally {
      finishAction(gen);
    }
  }

  async function onUpdate() {
    const gen = ++actionGen.current;
    setPending('update');
    setActionError('');
    try {
      const cloud = await getAdminCloud(id, secret);
      if (actionGen.current !== gen) return;
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
      if (actionGen.current !== gen) return;
      setActionError(err instanceof ApiError ? err.message : 'Could not update the cloud.');
    } finally {
      finishAction(gen);
    }
  }

  function finishAction(gen: number) {
    if (actionGen.current !== gen) return;
    actionGen.current += 1;
    setPending(null);
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
        <header className="cloud-bar">
          <p className="cloud-title">{summary.title}</p>
          <div className="view-toggle" role="group" aria-label="View">
            <button type="button" aria-pressed={viewMode === 'cloud'} onClick={() => setViewMode('cloud')}>
              Cloud
            </button>
            <button type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}>
              Table
            </button>
          </div>
          <button className="secondary hide-cloud" type="button" onClick={() => void onHide()} disabled={pending !== null}>
            {pending === 'hide' ? 'Hiding…' : 'Hide word cloud'}
          </button>
        </header>
        {viewMode === 'table' ? <ResponseTable texts={tableRows} /> : <WordCloud texts={view.texts} />}
        {newer > 0 ? (
          <button className="secondary update-cloud" type="button" onClick={() => void onUpdate()} disabled={pending !== null}>
            {pending === 'update' ? 'Updating…' : `Update cloud (${newer} new)`}
          </button>
        ) : null}
        {actionError ? <p className="toast-error">{actionError}</p> : null}
      </main>
    );
  }

  const responses = summary.submissionCount === 1 ? 'response' : 'responses';
  const participantUrl = `${window.location.origin}/c/${id}`;

  return (
    <main className="stage admin-wait">
      <p className="eyebrow">{summary.title}</p>
      <ParticipantQr url={participantUrl} />
      <p className="count">{summary.submissionCount}</p>
      <p className="lede">{responses}</p>
      {actionError ? <p className="form-error">{actionError}</p> : null}
      <button className="primary show-button" type="button" onClick={() => void onShow()} disabled={pending !== null}>
        {pending === 'show' ? 'Showing…' : 'Show word cloud'}
      </button>
      <p className="hint">Participants cannot see this screen.</p>
    </main>
  );
}
