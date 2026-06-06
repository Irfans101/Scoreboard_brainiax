import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { socket } from "../socket";
import TeamCard from "./TeamCard";
import DigitalCounter from "./DigitalCounter";
import LeaderBanner from "./LeaderBanner";
import "../styles/scoreboard.css";

const MILESTONE_STEP = 50;
const REFRESH_INTERVAL_SECONDS = 3;
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function normalizeScore(data) {
  return {
    teamA: Number(data?.teamA || 0),
    teamB: Number(data?.teamB || 0)
  };
}

export default function Scoreboard() {
  const [score, setScore] = useState({ teamA: 0, teamB: 0 });
  const prevScoreRef = useRef({ teamA: 0, teamB: 0 });
  const [showTakeover, setShowTakeover] = useState(false);
  const [takeoverText, setTakeoverText] = useState("LEADER CHANGE");
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [lastSyncLabel, setLastSyncLabel] = useState("Waiting for live sync");
  const prevLeader = useRef("TIED");
  const milestones = useRef({ teamA: 0, teamB: 0 });
  const isTvRoute = window.location.pathname.toLowerCase() === "/tv";

  useEffect(() => {
    async function loadInitialScore() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/score`);
        const data = await response.json();
        const normalized = normalizeScore(data);
        setScore(normalized);
        prevScoreRef.current = normalized;
        setLastSyncLabel(
          `Last checked ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
        );
      } catch (error) {
        console.error("Initial score fetch failed", error);
        setLastSyncLabel("Live sheet unavailable");
      }
    }

    loadInitialScore();

    const audioCtxRef = { current: null };

    function ensureAudioCtx() {
      if (!audioCtxRef.current && typeof window !== "undefined") {
        try {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          audioCtxRef.current = null;
        }
      }
      return audioCtxRef.current;
    }

    function beep(team) {
      const ctx = ensureAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = team === "TEAM A" ? 920 : 620;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      o.stop(now + 0.12);
    }

    function speakMessage(text) {
      if (typeof window === "undefined") return;
      if (window.speechSynthesis) {
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 1.02;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
          return;
        } catch (e) {
          // fallback to nothing
        }
      }
    }

    function onScoreUpdate(data) {
      const normalized = normalizeScore(data);

      // detect deltas
      const prev = prevScoreRef.current || { teamA: 0, teamB: 0 };
      const deltaA = Math.max(0, normalized.teamA - prev.teamA);
      const deltaB = Math.max(0, normalized.teamB - prev.teamB);

      // schedule beeps per increment so they align with the digital counter stepping
      const stepDelay = 50; // ms per increment
      if (deltaA > 0) {
        // announce once
        speakMessage("Team A got a sale");
        for (let i = 0; i < deltaA; i++) {
          setTimeout(() => beep("TEAM A"), i * stepDelay + 18);
        }
      }

      if (deltaB > 0) {
        speakMessage("Team B got a sale");
        for (let i = 0; i < deltaB; i++) {
          setTimeout(() => beep("TEAM B"), i * stepDelay + 18);
        }
      }

      prevScoreRef.current = normalized;
      setScore(normalized);
    }

    socket.on("score-update", onScoreUpdate);
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));

    return () => {
      socket.off("score-update", onScoreUpdate);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  const leader = useMemo(() => {
    if (score.teamA === score.teamB) {
      return "TIED";
    }

    return score.teamA > score.teamB ? "TEAM A" : "TEAM B";
  }, [score.teamA, score.teamB]);

  useEffect(() => {
    if (leader !== prevLeader.current && leader !== "TIED") {
      setTakeoverText(`${leader} TAKES THE LEAD`);
      setShowTakeover(true);
      const timer = setTimeout(() => setShowTakeover(false), 1400);
      prevLeader.current = leader;
      return () => clearTimeout(timer);
    }

    prevLeader.current = leader;
    return undefined;
  }, [leader]);

  useEffect(() => {
    const nextMilestoneA = Math.floor(score.teamA / MILESTONE_STEP);
    const nextMilestoneB = Math.floor(score.teamB / MILESTONE_STEP);

    if (nextMilestoneA > milestones.current.teamA && score.teamA > 0) {
      confetti({ particleCount: 140, spread: 70, origin: { x: 0.2, y: 0.5 } });
      milestones.current.teamA = nextMilestoneA;
    }

    if (nextMilestoneB > milestones.current.teamB && score.teamB > 0) {
      confetti({ particleCount: 140, spread: 70, origin: { x: 0.8, y: 0.5 } });
      milestones.current.teamB = nextMilestoneB;
    }
  }, [score.teamA, score.teamB]);

  useEffect(() => {
    if (socketConnected) {
      setLastSyncLabel(`Live connected • refreshes every ${REFRESH_INTERVAL_SECONDS}s`);
    } else {
      setLastSyncLabel(`Disconnected • refreshes every ${REFRESH_INTERVAL_SECONDS}s`);
    }
  }, [socketConnected]);

  const total = score.teamA + score.teamB;
  const teamAProgress = total === 0 ? 50 : Math.round((score.teamA / total) * 100);
  const teamBProgress = 100 - teamAProgress;

  async function requestFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen request failed", error);
    }
  }

  return (
    <div className={`dashboard ${isTvRoute ? "tv-mode" : ""}`}>
      {!isTvRoute ? (
        <button className="tv-button" onClick={requestFullscreen}>
          Enter TV Fullscreen
        </button>
      ) : null}

      <motion.header
        className="title-wrap"
        initial={{ opacity: 0, y: -28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className={`live-status ${socketConnected ? "live-on" : "live-off"}`}>
          <span className="live-dot" />
          <span>{socketConnected ? "LIVE CONNECTED" : "NOT CONNECTED"}</span>
        </div>
        <p className="kicker">BRAINIAX CHAMPIONS LEADERBOARD</p>
        <h1 className="title">SALES BATTLE</h1>
        <p className="subtitle">{lastSyncLabel}</p>
      </motion.header>

      <div className="board">
        <TeamCard
          team="TEAM A"
          score={score.teamA}
          color="#2dd4bf"
          logo="/logos/team-a.svg"
          progress={teamAProgress}
        />

        <div className="center-panel">
            <div className="center-score animated-glow">
              <DigitalCounter value={score.teamA} stepDelay={48} className="center-number" />
              <span className="center-separator">:</span>
              <DigitalCounter value={score.teamB} stepDelay={48} className="center-number" />
            </div>
          <div className="battle-progress">
            <div className="battle-left" style={{ width: `${teamAProgress}%` }} />
            <div className="battle-right" style={{ width: `${teamBProgress}%` }} />
          </div>
        </div>

        <TeamCard
          team="TEAM B"
          score={score.teamB}
          color="#fb7185"
          logo="/logos/team-b.svg"
          progress={teamBProgress}
        />
      </div>

      <LeaderBanner leader={leader} />

      {showTakeover ? (
        <motion.div
          className="takeover-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="takeover-text"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {takeoverText}
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
