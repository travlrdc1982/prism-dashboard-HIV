import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000/api";
const STUDY_ID = "hiv-wave1";

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

export function useSegments(studyId = STUDY_ID) {
  return useFetch(`${API_BASE}/studies/${studyId}/segments`);
}

export function useSegmentProfile(segmentCode, studyId = STUDY_ID) {
  const url = segmentCode
    ? `${API_BASE}/studies/${studyId}/segments/${segmentCode}`
    : null;
  return useFetch(url);
}

export function useMessages(studyId = STUDY_ID) {
  return useFetch(`${API_BASE}/studies/${studyId}/messages`);
}

export function useSurveyItems(studyId = STUDY_ID, construct = null) {
  const base = `${API_BASE}/studies/${studyId}/items`;
  const url = construct ? `${base}?construct=${construct}` : base;
  return useFetch(url);
}

export function useComposites(studyId = STUDY_ID, benchmarkGroup = null) {
  const base = `${API_BASE}/studies/${studyId}/composites`;
  const url = benchmarkGroup ? `${base}?benchmark_group=${benchmarkGroup}` : base;
  return useFetch(url);
}

export function useTrustRatings(studyId = STUDY_ID, segmentCode = null) {
  const base = `${API_BASE}/studies/${studyId}/trust`;
  const url = segmentCode ? `${base}?segment_code=${segmentCode}` : base;
  return useFetch(url);
}

export function useMessagePerformance(studyId = STUDY_ID) {
  return useFetch(`${API_BASE}/studies/${studyId}/performance`);
}

export function useStudy(studyId = STUDY_ID) {
  return useFetch(`${API_BASE}/studies/${studyId}`);
}
