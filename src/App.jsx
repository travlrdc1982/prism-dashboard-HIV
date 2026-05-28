import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Shell from "./components/Shell";
import SegmentMap from "./pages/SegmentMap";
import AudienceROI from "./pages/AudienceROI";
import MessageMap from "./pages/MessageMap";
import SegmentProfile from "./pages/SegmentProfile";
import Topline from "./components/Topline/Topline";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import Admin from "./pages/Admin";

// Auth gate. Set BYPASS_AUTH = true to skip the login screen entirely (used
// for early-stage review when the dashboard wasn't yet locked down).
// Production: false — the dashboard requires a valid Supabase session,
// scoped to the project configured in src/supabaseClient.js.
const BYPASS_AUTH = false;

// Detect a fresh invite/recovery redirect BEFORE supabase-js consumes the
// URL hash. If type=invite or type=recovery is present, we'll route the
// user through the "Set your password" screen after their session lands.
function detectInviteFlow() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  return hash.includes("type=invite") || hash.includes("type=recovery");
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [needsPasswordSet, setNeedsPasswordSet] = useState(detectInviteFlow());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!BYPASS_AUTH) {
    if (session === undefined) {
      return <div style={{ minHeight:"100vh", background:"#080c16", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748b", fontFamily:"'Nunito',sans-serif", fontSize:12 }}>Loading...</div>;
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
          <Route path="topline" element={<Topline />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
