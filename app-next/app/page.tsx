'use client';
import dynamic from 'next/dynamic';

// The whole game is client-only (WebGL, localStorage, WebSocket) — disable SSR.
const App = dynamic(() => import('@/client/App'), { ssr: false });

export default function Page() {
  return <App />;
}
