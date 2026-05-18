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

// Auth gate paused per Bryan's request — flip to false to require login again.
const BYPASS_AUTH = true;

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
