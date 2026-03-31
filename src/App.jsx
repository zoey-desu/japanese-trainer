import { useState, useEffect, useRef } from "react";
import defaultCsv from "./phrases.csv?raw";

// ── CSV パーサー ──────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  const sceneMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 7) continue;
    const [id, label, emoji, en, ja, jaHira, levelStr] = cols.map((c) => c.trim());
    const level = parseInt(levelStr, 10) || 1;
    if (!sceneMap.has(id)) sceneMap.set(id, { id, label, emoji, phrases: [] });
    sceneMap.get(id).phrases.push({ en, ja, jaHira, level });
  }

  return Array.from(sceneMap.values());
}

const levelColors = {
  1: { bg: "#22c55e", label: "初級" },
  2: { bg: "#f59e0b", label: "中級" },
  3: { bg: "#ef4444", label: "上級" },
};

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "ja-JP";
  utt.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const jpVoice = voices.find((v) => v.lang.startsWith("ja"));
  if (jpVoice) utt.voice = jpVoice;
  window.speechSynthesis.speak(utt);
}

export default function App() {
  const [scenes, setScenes] = useState(() => parseCsv(defaultCsv));
  const [sceneId, setSceneId] = useState(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [filterLevel, setFilterLevel] = useState(null);
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);
  useEffect(() => { if (scenes.length > 0 && !sceneId) setSceneId(scenes[0].id); }, [scenes]);

  const scene = scenes.find((s) => s.id === sceneId) || scenes[0];
  const phrases = scene
    ? filterLevel ? scene.phrases.filter((p) => p.level === filterLevel) : scene.phrases
    : [];
  const phrase = phrases[index % Math.max(phrases.length, 1)];

  useEffect(() => {
    setIndex(0); setRevealed(false); setAnswered(0); setSkipped(0);
  }, [sceneId, filterLevel]);

  const next = (wasAnswered) => {
    if (wasAnswered) setAnswered((a) => a + 1);
    else setSkipped((s) => s + 1);
    setRevealed(false);
    setIndex((i) => (i + 1) % phrases.length);
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCsv(ev.target.result);
        if (parsed.length === 0) throw new Error("データが読み込めませんでした");
        setScenes(parsed);
        setSceneId(parsed[0].id);
        setFilterLevel(null);
        setCsvError("");
        setShowCsvPanel(false);
      } catch (err) {
        setCsvError("読み込み失敗: " + err.message);
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDownloadCsv = () => {
    const blob = new Blob([defaultCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "phrases.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const progress = phrases.length ? ((answered + skipped) / phrases.length) * 100 : 0;
  const lv = phrase ? levelColors[phrase.level] || levelColors[1] : levelColors[1];

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0f", color: "#f0ece4",
      fontFamily: "'Noto Serif JP', 'Georgia', serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "24px 16px", gap: "18px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .scene-btn { transition: all 0.15s; cursor: pointer; }
        .scene-btn:hover { background: rgba(255,255,255,0.1) !important; }
        .scene-btn.active { background: rgba(220,38,38,0.2) !important; border-color: #dc2626 !important; color: #fca5a5 !important; }
        .btn { transition: all 0.2s; cursor: pointer; }
        .btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .speak-btn { transition: all 0.2s; cursor: pointer; }
        .speak-btn:hover { transform: scale(1.05); }
        .speak-btn.pulse { animation: pulse 0.6s ease; }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        .flip-in { animation: flipIn 0.3s ease; }
        @keyframes flipIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .csv-panel { animation: slideDown 0.2s ease; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: "460px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#555", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>JAPANESE REFLEX TRAINER</div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>瞬発力トレーニング</h1>
        </div>
        <button className="btn" onClick={() => setShowCsvPanel(!showCsvPanel)} style={{
          background: showCsvPanel ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${showCsvPanel ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
          color: showCsvPanel ? "#a5b4fc" : "#666",
          padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontFamily: "'DM Mono', monospace",
        }}>📂 CSV</button>
      </div>

      {/* CSV パネル */}
      {showCsvPanel && (
        <div className="csv-panel" style={{
          width: "100%", maxWidth: "460px",
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px",
        }}>
          <div style={{ fontSize: "13px", color: "#a5b4fc", fontWeight: 700 }}>📂 CSVでコンテンツ管理</div>
          <div style={{ fontSize: "11px", color: "#555", fontFamily: "'DM Mono', monospace", lineHeight: 1.8 }}>
            列順 → カテゴリID, カテゴリ名, 絵文字, 英語, 日本語, 日本語（ひらがな）, レベル
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn" onClick={handleDownloadCsv} style={{
              flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#aaa", padding: "10px", borderRadius: "8px", fontSize: "12px", fontFamily: "'Noto Serif JP', serif",
            }}>⬇ テンプレートをDL</button>
            <button className="btn" onClick={() => fileInputRef.current?.click()} style={{
              flex: 1, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)",
              color: "#a5b4fc", padding: "10px", borderRadius: "8px", fontSize: "12px", fontFamily: "'Noto Serif JP', serif",
            }}>⬆ CSVを読み込む</button>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCsvUpload} />
          </div>
          {csvError && <div style={{ color: "#f87171", fontSize: "12px", fontFamily: "'DM Mono', monospace" }}>⚠ {csvError}</div>}
          <div style={{ fontSize: "11px", color: "#444", fontFamily: "'DM Mono', monospace", lineHeight: 1.8 }}>
            💡 ひらがな列は文章を全部ひらがなで書いてください<br />
            💡 ExcelやGoogleスプレッドシートで編集OK<br />
            💡 リロードするとデフォルトに戻ります
          </div>
        </div>
      )}

      {/* Scene Selector */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
        {scenes.map((s) => (
          <button key={s.id} className={`scene-btn ${sceneId === s.id ? "active" : ""}`} onClick={() => setSceneId(s.id)} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#aaa", padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontFamily: "'Noto Serif JP', serif",
          }}>{s.emoji} {s.label}</button>
        ))}
      </div>

      {/* Level Filter */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={{ fontSize: "11px", color: "#444", fontFamily: "'DM Mono', monospace" }}>LEVEL:</span>
        {[null, 1, 2, 3].map((l) => (
          <button key={l ?? "all"} className="btn" onClick={() => setFilterLevel(l)} style={{
            background: filterLevel === l ? (l ? levelColors[l].bg + "33" : "rgba(255,255,255,0.15)") : "rgba(255,255,255,0.04)",
            border: `1px solid ${filterLevel === l ? (l ? levelColors[l].bg : "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.12)"}`,
            color: filterLevel === l ? (l ? levelColors[l].bg : "#fff") : "#555",
            padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontFamily: "'DM Mono', monospace",
          }}>{l === null ? "ALL" : levelColors[l].label}</button>
        ))}
      </div>

      {/* Progress */}
      {phrases.length > 0 && (
        <div style={{ width: "100%", maxWidth: "460px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px", color: "#444", fontFamily: "'DM Mono', monospace" }}>
            <span>{(index % phrases.length) + 1} / {phrases.length}</span>
            <span style={{ color: "#22c55e" }}>✓ {answered} <span style={{ color: "#555" }}>— {skipped}</span></span>
          </div>
          <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#dc2626,#f97316)", borderRadius: "2px", transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* Card */}
      {phrase && (
        <div key={`${sceneId}-${index}`} className="flip-in" style={{
          width: "100%", maxWidth: "460px",
          background: "linear-gradient(145deg,#141418,#1a1a20)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px",
          padding: "32px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "22px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", background: "radial-gradient(circle at top right,rgba(220,38,38,0.08),transparent)", borderRadius: "0 16px 0 80px" }} />

          <div style={{ alignSelf: "flex-start", background: lv.bg + "22", border: `1px solid ${lv.bg}44`, color: lv.bg, padding: "3px 10px", borderRadius: "4px", fontSize: "10px", fontFamily: "'DM Mono', monospace", letterSpacing: "2px" }}>{lv.label}</div>

          {/* English */}
          <div style={{ textAlign: "center", width: "100%" }}>
            <div style={{ fontSize: "11px", color: "#444", letterSpacing: "3px", fontFamily: "'DM Mono', monospace", marginBottom: "12px" }}>ENGLISH</div>
            <p style={{ margin: 0, fontSize: "clamp(18px,5vw,26px)", fontWeight: 700, lineHeight: 1.4, color: "#f0ece4" }}>{phrase.en}</p>
          </div>

          <div style={{ width: "40px", height: "1px", background: "rgba(255,255,255,0.1)" }} />

          {!revealed ? (
            <button className="btn" onClick={() => setRevealed(true)} style={{
              background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)",
              color: "#fca5a5", padding: "12px 28px", borderRadius: "8px", fontSize: "14px", fontFamily: "'Noto Serif JP', serif",
            }}>日本語を確認する →</button>
          ) : (
            <div className="flip-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", width: "100%" }}>

              {/* Japanese + Hiragana */}
              <div style={{ textAlign: "center", width: "100%" }}>
                <div style={{ fontSize: "11px", color: "#444", letterSpacing: "3px", fontFamily: "'DM Mono', monospace", marginBottom: "14px" }}>日本語</div>

                {/* 漢字 */}
                <p style={{ margin: "0 0 10px 0", fontSize: "clamp(20px,5vw,28px)", fontWeight: 700, color: "#fbbf24", letterSpacing: "0.05em", lineHeight: 1.5 }}>
                  {phrase.ja}
                </p>

                {/* ひらがな */}
                <p style={{ margin: 0, fontSize: "clamp(13px,3.5vw,16px)", color: "#888", letterSpacing: "0.08em", lineHeight: 1.6, fontWeight: 400 }}>
                  {phrase.jaHira}
                </p>
              </div>

              {/* Speak */}
              <button className={`speak-btn ${speaking ? "pulse" : ""}`} onClick={() => { setSpeaking(true); speak(phrase.ja); setTimeout(() => setSpeaking(false), 1500); }} style={{
                background: speaking ? "rgba(251,191,36,0.25)" : "rgba(251,191,36,0.1)",
                border: `1px solid ${speaking ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.25)"}`,
                color: "#fbbf24", padding: "10px 20px", borderRadius: "8px", fontSize: "14px",
                fontFamily: "'Noto Serif JP', serif", display: "flex", alignItems: "center", gap: "8px",
              }}>
                <span style={{ fontSize: "18px" }}>{speaking ? "🔊" : "🔈"}</span>
                {speaking ? "再生中..." : "音声を聞く"}
              </button>

              {/* Next */}
              <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: "4px" }}>
                <button className="btn" onClick={() => next(false)} style={{
                  flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#666", padding: "10px", borderRadius: "8px", fontSize: "13px", fontFamily: "'Noto Serif JP', serif",
                }}>もう一度</button>
                <button className="btn" onClick={() => next(true)} style={{
                  flex: 2, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                  color: "#86efac", padding: "10px", borderRadius: "8px", fontSize: "13px", fontFamily: "'Noto Serif JP', serif",
                }}>✓ わかった！次へ</button>
              </div>
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: "11px", color: "#2a2a2a", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
        英語を見て、日本語を瞬時に言ってみよう
      </p>
    </div>
  );
}
