import "./Quiz.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_QUESTIONS = 5;
const MAX_POINTS_PER_Q = 100;
const TOTAL_MAX_POINTS = TOTAL_QUESTIONS * MAX_POINTS_PER_Q; // 500
const TIME_LIMIT = 15; // seconds per question

function calcScore(secondsTaken) {
  if (secondsTaken < 1) return 100;
  if (secondsTaken >= TIME_LIMIT) return 0;
  // Linear decay: 100 → 0 over 15 seconds, floored at 0
  return Math.max(0, Math.round(100 - (secondsTaken / TIME_LIMIT) * 100));
}

// ─── Scoring Modal ─────────────────────────────────────────────────────────────
function ScoringModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">How Scoring Works</h2>
        <div className="modal-body">
          <p>Each question is worth <strong>up to 100 points</strong>.</p>
          <ul>
            <li>⚡ Answer in under <strong>1 second</strong> → <strong>100 pts</strong></li>
            <li>⏱ Points decrease linearly over the 15-second timer</li>
            <li>❌ Wrong answer or time out → <strong>0 pts</strong></li>
          </ul>
          <p>Max possible score: <strong>{TOTAL_MAX_POINTS} points</strong> across {TOTAL_QUESTIONS} questions.</p>
          <p>Beat the clock — speed is everything! 🚀</p>
        </div>
      </div>
    </div>
  );
}

// ─── Share Buttons ─────────────────────────────────────────────────────────────
function ShareButtons({ score, correctCount }) {
  const shareText = `🏆 I scored ${score}/${TOTAL_MAX_POINTS} on QuiZa today! (${correctCount}/${TOTAL_QUESTIONS} correct)\nThink you can beat me? Play at quiza.co.za`;
  const encoded = encodeURIComponent(shareText);
  const url = encodeURIComponent("https://quiza.co.za");

  return (
    <div className="share-row">
      <span className="share-label">Share your result:</span>
      <div className="share-buttons">
        <a
          className="share-btn whatsapp"
          href={`https://wa.me/?text=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.861L.057 23.744a.5.5 0 0 0 .614.637l6.094-1.597A11.96 11.96 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.795 9.795 0 0 1-5.065-1.407l-.363-.215-3.766.987 1.004-3.667-.237-.375A9.795 9.795 0 0 1 2.182 12C2.182 6.563 6.563 2.182 12 2.182S21.818 6.563 21.818 12 17.437 21.818 12 21.818z"/></svg>
          WhatsApp
        </a>
        <a
          className="share-btn twitter"
          href={`https://twitter.com/intent/tweet?text=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          X (Twitter)
        </a>
        <a
          className="share-btn facebook"
          href={`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </a>
      </div>
    </div>
  );
}

// ─── Timer Bar ──────────────────────────────────────────────────────────────────
function TimerBar({ secondsLeft, total }) {
  const pct = (secondsLeft / total) * 100;
  const isWarning = secondsLeft <= 5;
  return (
    <div className="timer-track">
      <div
        className={`timer-fill ${isWarning ? "warning" : ""}`}
        style={{ width: `${pct}%` }}
      />
      <span className={`timer-label ${isWarning ? "warning" : ""}`}>
        {secondsLeft}s
      </span>
    </div>
  );
}

// ─── Main Quiz Component ────────────────────────────────────────────────────────
export default function Quiz() {
  const navigate = useNavigate();

  // phase: "loading" | "ready" | "question" | "feedback" | "results" | "error"
  const [phase, setPhase] = useState("loading");
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [scores, setScores] = useState([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [startTime, setStartTime] = useState(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [alreadyPlayedData, setAlreadyPlayedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const timerRef = useRef(null);

  // ── Fetch today's quiz ──
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch("/api/quiz/today", { headers });
        const data = await res.json();

        if (res.status === 403 && data.alreadyPlayed) {
          // Already played — show results screen with stored data
          setAlreadyPlayedData(data);
          setPhase("results");
          return;
        }

        if (!res.ok) {
          throw new Error(data.message || "Failed to load quiz");
        }

        setQuiz(data);
        setPhase("ready");
      } catch (err) {
        setErrorMessage(err.message || "Something went wrong loading today's quiz.");
        setPhase("error");
      }
    };

    fetchQuiz();
  }, []);

  // ── Timer logic ──
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTimeout = useCallback(() => {
    stopTimer();
    setSelectedAnswer("__timeout__");
    setIsCorrect(false);
    setScores((prev) => [...prev, 0]);
    setPhase("feedback");
  }, [stopTimer]);

  useEffect(() => {
    if (phase === "question") {
      setTimeLeft(TIME_LIMIT);
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => stopTimer();
  }, [phase, currentQ, handleTimeout, stopTimer]);

  // ── Answer selection ──
  const handleAnswer = (choice) => {
    if (selectedAnswer !== null) return;
    stopTimer();

    const elapsed = (Date.now() - startTime) / 1000;
    const question = quiz.questions[currentQ];
    const correct = choice === question.correctAnswer;
    const pointsEarned = correct ? calcScore(elapsed) : 0;

    setSelectedAnswer(choice);
    setIsCorrect(correct);
    setScores((prev) => [...prev, pointsEarned]);
    if (correct) setCorrectCount((prev) => prev + 1);
    setPhase("feedback");
  };

  // ── Advance to next question or results ──
  const handleNext = async () => {
    const nextIndex = currentQ + 1;

    if (nextIndex >= TOTAL_QUESTIONS) {
      // Submit results to backend
      const totalScore = [...scores].reduce((a, b) => a + b, 0);
      try {
        const token = localStorage.getItem("token");
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        await fetch("/api/quiz/submit", {
          method: "POST",
          headers,
          body: JSON.stringify({
            quizId: quiz.id,
            score: totalScore,
            correctAnswers: correctCount + (isCorrect ? 0 : 0), // already updated via state
          }),
        });
      } catch (_) {
        // Silent fail — still show results
      }
      setPhase("results");
    } else {
      setCurrentQ(nextIndex);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setPhase("question");
    }
  };

  // ── Derived values ──
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const question = quiz?.questions?.[currentQ];

  // ════════════════════════════════════════════════
  // RENDER PHASES
  // ════════════════════════════════════════════════

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div className="quiz-shell">
        <div className="quiz-loading">
          <div className="loading-spinner" />
          <p>Loading today's quiz...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (phase === "error") {
    return (
      <div className="quiz-shell">
        <div className="quiz-card error-card">
          <div className="quiz-logo-wrap" onClick={() => navigate("/")}>
            <span className="quiz-logo-text">QuiZa</span>
          </div>
          <div className="error-icon">😬</div>
          <h2 className="card-title">Eish! Something went wrong</h2>
          <p className="card-subtitle">{errorMessage}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Ready ──
  if (phase === "ready") {
    return (
      <div className="quiz-shell">
        {showScoringModal && <ScoringModal onClose={() => setShowScoringModal(false)} />}
        <div className="quiz-card ready-card">
          <div className="quiz-logo-wrap" onClick={() => navigate("/")}>
            <span className="quiz-logo-text">QuiZa</span>
          </div>
          <div className="ready-badge">Daily Sports Trivia</div>
          <h2 className="card-title">Ready to play?</h2>
          <div className="ready-meta">
            <div className="meta-item">
              <span className="meta-icon">❓</span>
              <span>{TOTAL_QUESTIONS} Questions</span>
            </div>
            <div className="meta-item">
              <span className="meta-icon">🏆</span>
              <span>Up to {TOTAL_MAX_POINTS} points</span>
            </div>
            <div className="meta-item warning-meta">
              <span className="meta-icon">⏱</span>
              <span>Only <strong>{TIME_LIMIT} seconds</strong> per question!</span>
            </div>
          </div>
          <p className="ready-hint">
            Speed matters — the faster you answer, the more points you earn.{" "}
            <button
              className="link-btn"
              onClick={() => setShowScoringModal(true)}
            >
              How scoring works →
            </button>
          </p>
          <button className="btn-primary btn-large" onClick={() => setPhase("question")}>
            Let's Go! 🚀
          </button>
        </div>
      </div>
    );
  }

  // ── Question ──
  if (phase === "question" && question) {
    return (
      <div className="quiz-shell">
        <div className="quiz-card question-card">
          <div className="q-header">
            <div className="quiz-logo-wrap small" onClick={() => navigate("/")}>
              <span className="quiz-logo-text">QuiZa</span>
            </div>
            <div className="q-progress">
              {currentQ + 1} / {TOTAL_QUESTIONS}
            </div>
          </div>

          <TimerBar secondsLeft={timeLeft} total={TIME_LIMIT} />

          <div className="q-score-tally">
            Score so far: <strong>{totalScore}</strong> pts
          </div>

          <p className="question-text">{question.question}</p>

          <div className="answers-grid">
            {question.options.map((option, i) => (
              <button
                key={i}
                className="answer-btn"
                onClick={() => handleAnswer(option)}
                disabled={selectedAnswer !== null}
              >
                <span className="answer-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Feedback ──
  if (phase === "feedback" && question) {
    const lastScore = scores[scores.length - 1];
    const timedOut = selectedAnswer === "__timeout__";

    return (
      <div className="quiz-shell">
        <div className="quiz-card feedback-card">
          <div className="q-header">
            <div className="quiz-logo-wrap small" onClick={() => navigate("/")}>
              <span className="quiz-logo-text">QuiZa</span>
            </div>
            <div className="q-progress">
              {currentQ + 1} / {TOTAL_QUESTIONS}
            </div>
          </div>

          <div className={`feedback-result ${isCorrect ? "correct" : "wrong"}`}>
            {timedOut ? (
              <>
                <span className="feedback-icon">⏰</span>
                <span>Time's up! +0 pts</span>
              </>
            ) : isCorrect ? (
              <>
                <span className="feedback-icon">✅</span>
                <span>Correct! +{lastScore} pts</span>
              </>
            ) : (
              <>
                <span className="feedback-icon">❌</span>
                <span>Wrong! +0 pts</span>
              </>
            )}
          </div>

          <p className="question-text faded">{question.question}</p>

          <div className="answers-grid">
            {question.options.map((option, i) => {
              const isCorrectAnswer = option === question.correctAnswer;
              const isSelected = option === selectedAnswer;
              let cls = "answer-btn disabled";
              if (isCorrectAnswer) cls += " correct-answer";
              else if (isSelected && !isCorrect) cls += " wrong-answer";

              return (
                <button key={i} className={cls} disabled>
                  <span className="answer-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          {question.explanation && (
            <p className="explanation">{question.explanation}</p>
          )}

          <button className="btn-primary" onClick={handleNext}>
            {currentQ + 1 >= TOTAL_QUESTIONS ? "See Results 🏆" : "Next Question →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Results (both fresh play and already-played) ──
  if (phase === "results") {
    const isAlreadyPlayed = !!alreadyPlayedData;
    const displayScore = isAlreadyPlayed
      ? alreadyPlayedData.score ?? 0
      : totalScore;
    const displayCorrect = isAlreadyPlayed
      ? alreadyPlayedData.correctAnswers ?? 0
      : correctCount;

    const pct = Math.round((displayScore / TOTAL_MAX_POINTS) * 100);
    const grade =
      pct === 100
        ? "🏆 Perfect!"
        : pct >= 80
        ? "🔥 Excellent!"
        : pct >= 60
        ? "👏 Good Work!"
        : pct >= 40
        ? "💪 Keep Going!"
        : "📚 Keep Practising!";

    return (
      <div className="quiz-shell">
        <div className="quiz-card results-card">
          <div className="quiz-logo-wrap" onClick={() => navigate("/")}>
            <span className="quiz-logo-text">QuiZa</span>
          </div>

          {isAlreadyPlayed && (
            <div className="already-played-banner">
              ✅ You've already played today — here are your results
            </div>
          )}

          <div className="results-grade">{grade}</div>

          <div className="results-score-big">
            <span className="score-number">{displayScore}</span>
            <span className="score-denom">/{TOTAL_MAX_POINTS}</span>
          </div>

          <div className="results-meta">
            <div className="results-meta-item">
              <span className="results-meta-label">Correct</span>
              <span className="results-meta-value">
                {displayCorrect}/{TOTAL_QUESTIONS}
              </span>
            </div>
            <div className="results-meta-item">
              <span className="results-meta-label">Score</span>
              <span className="results-meta-value">{pct}%</span>
            </div>
          </div>

          <div className="score-bar-track">
            <div
              className="score-bar-fill"
              style={{ width: `${pct}%` }}
            />
          </div>

          <ShareButtons score={displayScore} correctCount={displayCorrect} />

          <p className="results-return">
            Come back tomorrow for a new quiz!
          </p>
          <button className="btn-secondary" onClick={() => navigate("/")}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
