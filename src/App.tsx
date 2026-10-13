import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CreatePage } from './pages/CreatePage';
import { ParticipantPage } from './pages/ParticipantPage';

const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<main className="stage"><p className="lede">Opening…</p></main>}>
        <Routes>
          <Route path="/" element={<CreatePage />} />
          <Route path="/c/:id" element={<ParticipantPage />} />
          <Route path="/a/:id/:secret" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
