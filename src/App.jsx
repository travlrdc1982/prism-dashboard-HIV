import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { C } from './data/theme';
import { supabase } from "./supabaseClient";
import Shell from "./components/Shell";
import SegmentMap from "./pages/SegmentMap";
import AudienceROI from "./pages/AudienceROI";
import MessageMap from "./pages/MessageMap";
import SegmentProfile from "./pages/SegmentProfile";
import ExecutiveSummary from "./pages/ExecutiveSummary";
import Topline from "./components/Topline/Topline";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import Admin from "./pages/Admin";

// Auth gate. Set VITE_BYPASS_AUTH=true in the deployment env vars to skip
// the login screen entirely (used for early-stage review when a study
// isn't yet locked down). Production: leave unset / false — the dashboard
// requires a valid Supabase session, scoped to the project configured in
// src/supabaseClient.js.
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

// Capture the URL hash at module-load time (synchronously, before
// supabase-js has a chance to consume it). React render is async in
// React 18 concurrent mode, so reading window.location.hash from inside
// the component body is too late.
const INITIAL_URL_HASH = (typeof window !== "undefined") ? (window.location.hash || "") : "";
const INITIAL_INVITE_FLOW =
  INITIAL_URL_HASH.includes("type=invite") ||
  INITIAL_URL_HASH.includes("type=recovery");

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [needsPasswordSet, setNeedsPasswordSet] = useState(INITIAL_INVITE_FLOW);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!BYPASS_AUTH) {
    if (session === undefined) {
      return <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:"#64748b", fontFamily:"'Nunito',sans-serif", fontSize:12 }}>Loading...</div>;
    }
    if (!session) {
      return <Login onAuth={() => {}} />;
    }
    if (needsPasswordSet) {
      return <SetPassword email={session.user?.email} onDone={() => setNeedsPasswordSet(false)} />;
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<SegmentMap />} />
          <Route path="roi" element={<AudienceROI />} />
          <Route path="messages" element={<MessageMap />} />
          <Route path="profile" element={<SegmentProfile />} />
          <Route path="executive-summary" element={<ExecutiveSummary />} />
          <Route path="topline" element={<Topline />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
