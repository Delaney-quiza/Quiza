import React, { useState, useEffect, useCallback, useRef } from "react";
import * as api from "../api";

const TIME_LIMIT = 15;
const CAT = {
  "SA Rugby":{bg:"#1a3a1a",text:"#4ade80",e:"🏉"},"SA Cricket":{bg:"#1a3a2a",text:"#34d399",e:"🏏"},
  "SA Football":{bg:"#3a3a1a",text:"#fbbf24",e:"⚽"},"Formula 1":{bg:"#3a1a1a",text:"#f87171",e:"🏎️"},
  Golf:{bg:"#1a3a2a",text:"#4ade80",e:"⛳"},Tennis:{bg:"#3a2a1a",text:"#fbbf24",e:"🎾"},
  "Premier League":{bg:"#2a1a3a",text:"#c084fc",e:"⚽"},"Champions League":{bg:"#1a1a3a",text:"#60a5fa",e:"🏆"},
  Olympics:{bg:"#3a2a1a",text:"#fb923c",e:"🥇"},"World Football":{bg:"#1a2a3a",text:"#38bdf8",e:"🌍"},
};

const Pill = ({cat}) => { const c=CAT[cat]||{bg:"#2a2a2a",text:"#aaa",e:"🏅"}; return <span style={{background:c.bg,color:c.text,padding:"4px 12px",borderRadius:100,fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:.5,textTransform:"uppercase",fontWeight:600}}>{c.e} {cat}</span>; };

function Timer({timeLeft,max,expired}){
  const r=22,circ=2*Math.PI*r,off=circ*(1-timeLeft/max);
  let col=timeLeft<=5?"#ef4444":timeLeft<=10?"#f59e0b":"#22c55e";
  return <div style={{position:"relative",width:56,height:56,flexShrink:0}}>
    <svg width={56} height={56} style={{transform:"rotate(-90deg)"}}>
      <circle cx={28} cy={28} r={r} fill="none" stroke="#1a1a1e" strokeWidth={3}/>
      <circle cx={28} cy={28} r={r} fill="none" stroke={expired?"#ef4444":col} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={expired?circ:off} strokeLinecap="round" style={{transition:"stroke-dashoffset .3s linear,stroke .3s"}}/>
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:16,color:expired?"#ef4444":col,animation:timeLeft<=5&&!expired?"pulse .5s ease infinite":"none"}}>{expired?"✗":timeLeft}</div>
  </div>;
}

export default function Quiz() {
  const [phase, setPhase] = useState("loading");
  const [questions, setQuestions] = useState([]);
  const [correctAnswers, setCorrectAnswers] = useState([]); // ← KEY FIX: stored from server
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([null,null,null]);
  const [timings, setTimings] = useState([null,null,null]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [badges, setBadges] = useState([]);
  const [showBadges, setShowBadges] = useState(false);
  const [newBadge, setNewBadge] = useState(null);
  const startRef = useRef(null);
  const quizStartRef = useRef(null);
  const timerRef = useRef(null);

  // Init: ensure player + load quiz
  useEffect(() => {
    (async () => {
      try {
        await api.ensurePlayer();
        const [quizData, statsData, todayData] = await Promise.all([
          api.getTodayQuiz(), api.getPlayerStats(), api.getTodayResult()
        ]);
        setQuestions(quizData.questions);
        // Store correct answers from server response
        if (quizData.correct_answers) {
          setCorrectAnswers(quizData.correct_answers);
        }
        setStats(statsData);
        setBadges(statsData.badges || []);
        if (todayData.played) {
          setResult(todayData.result);
          setPhase("results");
        } else {
          setPhase("ready");
        }
      } catch (err) {
        setError(err.message);
        setPhase("error");
      }
    })();
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== "playing") return;
    startRef.current = Date.now();
    setTimeLeft(TIME_LIMIT);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, TIME_LIMIT - (Date.now() - startRef.current) / 1000);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setTimings(p => { const n=[...p]; n[currentQ]=null; return n; });
        setPhase("reveal");
      }
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [phase, currentQ]);

  const handleStart = () => { quizStartRef.current = Date.now(); setPhase("playing"); };

  const handleAnswer = useCallback((i) => {
    if (phase !== "playing") return;
    clearInterval(timerRef.current);
    const elapsed = (Date.now() - startRef.current) / 1000;
    setAnswers(p => { const n=[...p]; n[currentQ]=i; return n; });
    setTimings(p => { const n=[...p]; n[currentQ]=elapsed; return n; });
    setPhase("reveal");
  }, [phase, currentQ]);

  const handleNext = async () => {
    if (currentQ < 2) {
      setCurrentQ(p => p + 1);
      setPhase("playing");
    } else {
      // Submit to server for official scoring
      try {
        const res = await api.submitQuiz(answers, timings, quizStartRef.current);
        setResult(res);
        setStats(res.player_stats);
        setBadges(res.all_badges || []);
        if (res.new_badges?.length) setTimeout(() => setNewBadge(res.new_badges[0]), 1200);
        setPhase("results");
      } catch (err) {
        // If submit fails (e.g. already played), still show local results
        const localCorrect = answers.map((a, i) => a === correctAnswers[i]);
        const localScore = answers.reduce((acc, a, i) => {
          if (a === correctAnswers[i] && timings[i] !== null) {
            return acc + Math.max(0, Math.round(((TIME_LIMIT - timings[i]) / TIME_LIMIT) * 100));
          }
          return acc;
        }, 0);
        setResult({
          correct: localCorrect,
          correct_count: localCorrect.filter(Boolean).length,
          score: localScore,
          total_time: timings.reduce((a, t) => a + (t === null ? TIME_LIMIT : t), 0),
          correct_answers: correctAnswers,
        });
        setPhase("results");
      }
    }
  };

  // Get the correct answer for the current question during reveal
  const getCurrentCorrectAnswer = () => {
    if (correctAnswers.length > currentQ) return correctAnswers[currentQ];
    return undefined;
  };

  const handleShare = async () => {
    if (!result) return;
    const today = new Date().toISOString().split("T")[0];
    const grid = result.correct.map(c => c ? "🟩" : "🟥").join("");
    const spd = (result.total_time||0) < 15 ? "⚡" : (result.total_time||0) < 30 ? "💨" : "🕐";
    const text = `🇿🇦 SportQ ${today}\n${grid} ${result.correct_count}/3\n${spd} ${(result.total_time||0).toFixed(1)}s · ${result.score}/300 pts\n\nPlay daily → sportq.app`;
    if (navigator.share) { try { await navigator.share({text}); return; } catch {} }
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  // Countdown to next quiz
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (phase !== "results") return;
    const tick = () => {
      const now = new Date(), tom = new Date(now); tom.setDate(tom.getDate()+1); tom.setHours(0,0,0,0);
      const d = tom - now;
      setCountdown(`${String(Math.floor(d/36e5)).padStart(2,"0")}:${String(Math.floor(d%36e5/6e4)).padStart(2,"0")}:${String(Math.floor(d%6e4/1e3)).padStart(2,"0")}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [phase]);

  const unlockedCount = badges.filter(b => b.unlocked).length;
  const q = questions[currentQ];
  const S = { mono: "'JetBrains Mono', monospace", serif: "'Playfair Display', serif" };

  return (
    <div style={{maxWidth:520,margin:"0 auto",padding:"24px 20px 48px",minHeight:"100vh",background:"#08080a",fontFamily:S.mono}}>
      {/* Header */}
      <div style={{textAlign:"center",marginBottom:24,animation:"slideUp .4s ease both"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4}}>
          <span style={{fontSize:28}}>🇿🇦</span>
          <h1 style={{fontFamily:S.serif,fontSize:32,fontWeight:800,color:"#fff",margin:0,letterSpacing:-.5}}>Sport<span style={{color:"#22c55e"}}>Q</span></h1>
        </div>
        <p style={{color:"#444",fontSize:11,margin:0,textTransform:"uppercase",letterSpacing:3}}>Daily Sports Trivia · {TIME_LIMIT}s per question</p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8,animation:"slideUp .4s ease .1s both"}}>
          <div style={{display:"flex",gap:20}}>
            {[{l:"Streak",v:stats.streak,i:"🔥"},{l:"Played",v:stats.total_games,i:"📅"},{l:"Avg Pts",v:stats.avg_score||0,i:"📊"}].map(s => (
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:18,color:"#fff",fontWeight:700}}>{s.i} {s.v}</div>
                <div style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setShowBadges(true)} style={{background:"#1a1a1e",border:"1px solid #2a2a2e",borderRadius:100,padding:"8px 16px",color:"#aaa",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
            🏅 {unlockedCount}/{badges.length}
          </button>
        </div>
      )}
      <div style={{height:1,background:"linear-gradient(90deg,transparent,#222,transparent)",margin:"8px 0 24px"}}/>

      {/* Loading */}
      {phase === "loading" && (
        <div style={{textAlign:"center",padding:"80px 0"}}>
          <div style={{fontSize:40,animation:"spin 1s linear infinite",display:"inline-block"}}>⚽</div>
          <p style={{color:"#555",marginTop:16,fontSize:13}}>Loading today's quiz...</p>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div style={{textAlign:"center",padding:"60px 0",animation:"fadeScale .5s ease both"}}>
          <div style={{fontSize:48,marginBottom:16}}>😔</div>
          <h2 style={{fontFamily:S.serif,fontSize:22,color:"#fff",margin:"0 0 8px",fontWeight:700}}>Eish!</h2>
          <p style={{color:"#666",fontSize:13,maxWidth:320,margin:"0 auto"}}>{error || "Something went wrong. Try refreshing."}</p>
          <button onClick={() => window.location.reload()} style={{marginTop:24,background:"#1a1a1e",border:"1px solid #2a2a2e",borderRadius:100,padding:"12px 32px",color:"#ccc",fontSize:13,fontWeight:600}}>Try Again</button>
        </div>
      )}

      {/* Ready */}
      {phase === "ready" && (
        <div style={{textAlign:"center",padding:"40px 0",animation:"fadeScale .5s ease both"}}>
          <div style={{fontSize:64,marginBottom:16}}>⚡</div>
          <h2 style={{fontFamily:S.serif,fontSize:24,color:"#fff",margin:"0 0 12px",fontWeight:700}}>Ready?</h2>
          <p style={{color:"#666",fontSize:13,lineHeight:1.7,margin:"0 0 8px",maxWidth:320,marginLeft:"auto",marginRight:"auto"}}>3 questions. {TIME_LIMIT} seconds each.</p>
          <p style={{color:"#555",fontSize:12,margin:"0 0 12px"}}>Answer faster for more points. Max 100 pts per question.</p>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginBottom:32}}>
            {questions.map((q,i) => <Pill key={i} cat={q.category}/>)}
          </div>
          <button onClick={handleStart} style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",border:"none",borderRadius:100,padding:"18px 64px",fontSize:15,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Start Quiz</button>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && q && <ActiveQuestion question={q} qi={currentQ} onAnswer={handleAnswer} timeLeft={timeLeft} max={TIME_LIMIT}/>}

      {/* Reveal — now uses correctAnswers from state */}
      {phase === "reveal" && q && (
        <AnswerReveal
          question={q}
          correctAnswer={getCurrentCorrectAnswer()}
          selected={answers[currentQ]}
          time={timings[currentQ]}
          expired={timings[currentQ]===null}
          onNext={handleNext}
          isLast={currentQ===2}
        />
      )}

      {/* Results */}
      {phase === "results" && result && (
        <>
          <div style={{background:"linear-gradient(135deg,#0a0a0c,#111118)",border:"1px solid #222",borderRadius:20,padding:32,textAlign:"center",animation:"fadeScale .6s ease both",marginTop:16}}>
            <div style={{fontSize:48,marginBottom:8}}>{result.correct_count===3?"🏆":result.correct_count>=2?"💪":result.correct_count>=1?"🤔":"😅"}</div>
            <h2 style={{fontFamily:S.serif,fontSize:28,color:"#fff",margin:"0 0 4px",fontWeight:700}}>
              {result.correct_count===3?"Perfect!":result.correct_count>=2?"Lekker!":result.correct_count>=1?"Not Bad":"Better Luck Tomorrow"}
            </h2>
            <p style={{color:"#666",fontSize:13,margin:"0 0 24px"}}>{result.correct_count}/3 correct · {result.score} points</p>
            {questions.map((q,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"#0d0d0f",borderRadius:12,marginBottom:8,border:`1px solid ${result.correct[i]?"#1a3a2a":"#2a1a1a"}`,animation:`slideUp .4s ease ${i*.1}s both`,textAlign:"left"}}>
                <span style={{fontSize:20}}>{result.correct[i]?"🟩":"🟥"}</span>
                <div style={{flex:1}}><div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:.5}}>Q{i+1} · {q.category}</div></div>
              </div>
            ))}
            <div style={{background:"#0a0a0c",borderRadius:12,padding:20,margin:"20px 0 24px",border:"1px solid #1a1a1e"}}>
              <pre style={{fontFamily:S.mono,fontSize:13,color:"#aaa",margin:0,whiteSpace:"pre-wrap",lineHeight:1.8,textAlign:"center"}}>
                {`🇿🇦 SportQ ${new Date().toISOString().split("T")[0]}\n${result.correct.map(c=>c?"🟩":"🟥").join("")} ${result.correct_count}/3\n${(result.total_time||0)<15?"⚡":"💨"} ${(result.total_time||0).toFixed(1)}s · ${result.score}/300 pts`}
              </pre>
            </div>
            <button onClick={handleShare} style={{background:copied?"linear-gradient(135deg,#064e2a,#0a6e3a)":"linear-gradient(135deg,#e8e8e8,#d0d0d0)",color:copied?"#fff":"#000",border:"none",borderRadius:100,padding:"16px 48px",fontSize:14,fontWeight:700,letterSpacing:.5,transition:"all .3s",textTransform:"uppercase"}}>
              {copied?"✓ Copied!":"Share Result"}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:16}}>
            <p style={{color:"#555",fontSize:12,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:1}}>Next quiz in</p>
            <p style={{fontFamily:S.serif,fontSize:32,color:"#fff",margin:0,fontWeight:700,letterSpacing:4}}>{countdown}</p>
          </div>
        </>
      )}

      {/* Badge drawer */}
      {showBadges && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn .3s ease"}} onClick={() => setShowBadges(false)}>
          <div style={{background:"#111113",borderRadius:"24px 24px 0 0",padding:"32px 24px 48px",width:"100%",maxWidth:480,maxHeight:"70vh",overflowY:"auto",animation:"slideUp .4s ease"}} onClick={e => e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <h3 style={{fontFamily:S.serif,fontSize:22,color:"#fff",margin:0,fontWeight:700}}>Badges</h3>
              <button onClick={() => setShowBadges(false)} style={{background:"none",border:"none",color:"#666",fontSize:24}}>×</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {badges.map(b => (
                <div key={b.id} style={{background:b.unlocked?"#1a1a1e":"#0a0a0c",border:`1px solid ${b.unlocked?"#333":"#1a1a1e"}`,borderRadius:16,padding:"20px 16px",textAlign:"center",opacity:b.unlocked?1:.4}}>
                  <div style={{fontSize:32,marginBottom:8,filter:b.unlocked?"none":"grayscale(1)"}}>{b.icon}</div>
                  <div style={{fontSize:12,color:b.unlocked?"#e8e8e8":"#555",fontWeight:700,marginBottom:4}}>{b.name}</div>
                  <div style={{fontSize:10,color:"#555"}}>{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New badge toast */}
      {newBadge && (
        <div style={{position:"fixed",top:24,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#1a1a1e,#222)",border:"1px solid #333",borderRadius:16,padding:"20px 28px",display:"flex",alignItems:"center",gap:14,zIndex:200,animation:"badgePop .5s ease both",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
          <span style={{fontSize:36}}>{newBadge.icon}</span>
          <div>
            <div style={{color:"#fbbf24",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Badge Unlocked!</div>
            <div style={{color:"#fff",fontSize:16,fontFamily:S.serif,fontWeight:700}}>{newBadge.name}</div>
          </div>
          <button onClick={() => setNewBadge(null)} style={{background:"none",border:"none",color:"#555",fontSize:18,marginLeft:8}}>×</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════

function ActiveQuestion({question:q, qi, onAnswer, timeLeft, max}) {
  const expired = timeLeft <= 0, low = timeLeft <= 5 && timeLeft > 0;
  const S = { mono: "'JetBrains Mono', monospace", serif: "'Playfair Display', serif" };
  return (
    <div style={{background:"#111113",border:`1px solid ${expired?"#4e0606":low?"#4e3a06":"#222"}`,borderRadius:16,padding:24,animation:"fadeScale .5s ease both",transition:"border-color .5s"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:S.serif,fontSize:14,color:"#555",fontWeight:700}}>Q{qi+1}/3</span>
          <Pill cat={q.category}/>
        </div>
        <Timer timeLeft={timeLeft} max={max} expired={expired}/>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:20}}>{[0,1,2].map(i=><div key={i} style={{flex:1,height:3,borderRadius:3,background:i<qi?"#22c55e":i===qi?"#3b82f6":"#1a1a1e"}}/>)}</div>
      <p style={{fontFamily:S.serif,fontSize:20,color:"#e8e8e8",lineHeight:1.5,margin:"0 0 24px",fontWeight:500}}>{q.question}</p>
      <div style={{display:"grid",gap:10}}>
        {q.options.map((opt,i) => (
          <button key={i} onClick={() => !expired && onAnswer(i)} disabled={expired}
            style={{background:"#1a1a1e",border:"1px solid #2a2a2e",borderRadius:12,padding:"16px 18px",color:expired?"#333":"#ccc",fontFamily:S.mono,fontSize:14,textAlign:"left",lineHeight:1.4,display:"flex",alignItems:"center",gap:12,transition:"all .2s"}}>
            <span style={{width:28,height:28,borderRadius:8,background:"#0d0d0f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#555",fontWeight:700,flexShrink:0}}>{String.fromCharCode(65+i)}</span>{opt}
          </button>
        ))}
      </div>
      {expired && <div style={{textAlign:"center",marginTop:20,color:"#ef4444",fontSize:13,fontWeight:600,animation:"fadeScale .3s ease both"}}>⏱️ Time's up!</div>}
    </div>
  );
}

function AnswerReveal({question:q, correctAnswer:ca, selected, time, expired, onNext, isLast}) {
  const correct = !expired && ca !== undefined && selected === ca;
  const S = { mono: "'JetBrains Mono', monospace", serif: "'Playfair Display', serif" };
  const pts = correct && time !== null ? Math.max(0, Math.round(((TIME_LIMIT - time) / TIME_LIMIT) * 100)) : 0;

  return (
    <div style={{background:"#111113",border:`1px solid ${correct?"#1a3a2a":"#2a1a1a"}`,borderRadius:16,padding:24,animation:"fadeScale .4s ease both"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div style={{width:48,height:48,borderRadius:14,background:correct?"linear-gradient(135deg,#064e2a,#0a6e3a)":"linear-gradient(135deg,#4e0606,#6e0a0a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,animation:"badgePop .5s ease both"}}>
          {correct?"✓":expired?"⏱":"✗"}
        </div>
        <div>
          <div style={{fontFamily:S.serif,fontSize:18,color:correct?"#4ade80":"#f87171",fontWeight:700}}>{correct?"Correct!":expired?"Time Expired":"Incorrect"}</div>
          <div style={{fontFamily:S.mono,fontSize:12,color:"#555"}}>{expired?"No answer given":`Answered in ${time.toFixed(1)}s`}{correct&&time<5&&" ⚡"}</div>
        </div>
        {correct && <div style={{marginLeft:"auto",background:"linear-gradient(135deg,#064e2a,#0a6e3a)",borderRadius:10,padding:"6px 14px",fontFamily:S.mono,fontSize:14,fontWeight:700,color:"#4ade80"}}>+{pts}</div>}
      </div>
      {!correct && ca !== undefined && (
        <div style={{background:"#0d0d0f",borderRadius:10,padding:"12px 16px",marginBottom:16,border:"1px solid #1a3a2a"}}>
          <span style={{color:"#555",fontFamily:S.mono,fontSize:11}}>Correct answer: </span>
          <span style={{color:"#4ade80",fontFamily:S.mono,fontSize:13,fontWeight:600}}>{q.options[ca]}</span>
        </div>
      )}
      <button onClick={onNext} style={{width:"100%",padding:16,borderRadius:12,border:"none",background:"linear-gradient(135deg,#e8e8e8,#d0d0d0)",color:"#000",fontFamily:S.mono,fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>
        {isLast?"See Results":"Next Question →"}
      </button>
    </div>
  );
}
