import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, RotateCcw, ChevronUp, ChevronDown, Star, Highlighter } from 'lucide-react';
import { S, F } from '../theme.js';
import { hap, snd } from '../audio.js';

/** Splits `body` text into alternating plain/highlighted React spans. */
function renderWithHighlights(body, cardHighlights) {
  if (!cardHighlights || !cardHighlights.length) return body;

  // Collect all match ranges for every saved highlight string
  const marks = [];
  for (const hl of cardHighlights) {
    if (!hl.text) continue;
    let idx = body.indexOf(hl.text);
    while (idx !== -1) {
      marks.push({ start: idx, end: idx + hl.text.length });
      idx = body.indexOf(hl.text, idx + hl.text.length);
    }
  }
  if (!marks.length) return body;

  // Sort and merge overlapping ranges
  marks.sort((a, b) => a.start - b.start);
  const merged = [{ ...marks[0] }];
  for (let i = 1; i < marks.length; i++) {
    const last = merged[merged.length - 1];
    if (marks[i].start <= last.end) {
      last.end = Math.max(last.end, marks[i].end);
    } else {
      merged.push({ ...marks[i] });
    }
  }

  // Build React element array
  const parts = [];
  let cursor = 0;
  for (const { start, end } of merged) {
    if (start > cursor) parts.push(body.slice(cursor, start));
    parts.push(
      <mark key={start} style={{ background: '#f59e0b33', color: 'inherit', borderRadius: 2, padding: '0 1px', WebkitTextFillColor: 'inherit' }}>
        {body.slice(start, end)}
      </mark>
    );
    cursor = end;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

export function DraggableCard({ card, onSwipe, stackIndex, isTop, confused, onConfused, starred, onStarred, highlights = [], onHighlight }) {
  const ref = useRef(null);
  const scrollZoneRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0, rot: 0 });
  const [flyOut, setFlyOut] = useState(null);
  const [showCtx, setShowCtx] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const drag = useRef({ active: false, startX: 0, startY: 0 });
  const done = useRef(false);
  const THRESH = 85;

  const fire = useCallback((dir, dx, dy) => {
    if (done.current) return;
    done.current = true;
    if (dir === "left") { hap.success(); snd.swipeLeft(); } else { hap.error(); snd.swipeRight(); }
    setFlyOut(dir === "left" ? { x: -700, y: (dy || 0) * 0.3, rot: -18 } : { x: 700, y: (dy || 0) * 0.3, rot: 18 });
    setTimeout(() => onSwipe(dir), 280);
  }, [onSwipe]);

  // Swipe drag handler (outer card)
  useEffect(() => {
    if (!isTop) return;
    const el = ref.current; if (!el) return;
    const pt = e => e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];
    const down = e => { const [x, y] = pt(e); drag.current = { active: true, startX: x, startY: y, lastFrictDist: 0 }; snd.grab(); };
    const move = e => {
      if (!drag.current.active) return;
      const [x, y] = pt(e); const dx = x - drag.current.startX, dy = y - drag.current.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 12 && Math.abs(dist - drag.current.lastFrictDist) > 28) { snd.friction(); drag.current.lastFrictDist = dist; }
      setPos({ x: dx, y: 0, rot: dx * 0.05 });
    };
    const up = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      setPos(p => {
        if (p.x < -THRESH) fire("left", p.x, p.y);
        else if (p.x > THRESH) fire("right", p.x, p.y);
        else { hap.light(); snd.snapBack(); return { x: 0, y: 0, rot: 0 }; }
        return p;
      });
    };
    el.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    el.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      el.removeEventListener("mousedown", down); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      el.removeEventListener("touchstart", down); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
    };
  }, [isTop, fire]);

  // Text selection detection — only the top card listens
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { setHasSelection(false); return; }
    const text = sel.toString().trim();
    if (!text) { setHasSelection(false); return; }
    // Only respond when the selection lives inside this card's scroll zone
    const range = sel.getRangeAt(0);
    if (scrollZoneRef.current && scrollZoneRef.current.contains(range.commonAncestorContainer)) {
      setHasSelection(true);
      setPendingText(text);
    } else {
      setHasSelection(false);
    }
  }, []);

  useEffect(() => {
    if (!isTop) { setHasSelection(false); return; }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [isTop, handleSelectionChange]);

  const saveHighlight = useCallback(() => {
    if (!pendingText || !onHighlight) return;
    hap.success();
    onHighlight({ text: pendingText, cardId: card.id, cardTitle: card.title, topicTitle: card.topicTitle });
    window.getSelection()?.removeAllRanges();
    setHasSelection(false);
    setPendingText('');
  }, [pendingText, onHighlight, card]);

  const cardHighlights = highlights.filter(h => h.cardId === card.id);
  const tx = flyOut ? `translate(${flyOut.x}px,${flyOut.y}px) rotate(${flyOut.rot}deg)` : isTop ? `translate(${pos.x}px,${pos.y}px) rotate(${pos.rot}deg)` : `scale(${1 - stackIndex * 0.03}) translateY(${stackIndex * 14}px)`;
  const tr = flyOut ? "transform 0.28s ease-in" : drag.current?.active ? "none" : "transform 0.3s cubic-bezier(0.34,1.4,0.64,1)";
  const lOp = Math.min(1, Math.max(0, -pos.x / 70));
  const rOp = Math.min(1, Math.max(0, pos.x / 70));
  const dc = card.difficulty === 1 ? S.d1 : card.difficulty === 2 ? S.d2 : S.d3;
  const dl = card.difficulty === 1 ? "Intro" : card.difficulty === 2 ? "Core" : "Advanced";

  return (
    <div ref={ref} data-testid={isTop ? "active-card" : "background-card"} style={{ position: "absolute", width: "100%", maxWidth: 440, left: "50%", top: 0, height: "100%", transform: `translateX(-50%) ${tx}`, transition: tr, cursor: isTop ? "grab" : "default", userSelect: "none", zIndex: 10 - stackIndex, touchAction: "none", filter: stackIndex > 0 ? `brightness(${1 - stackIndex * 0.15})` : "none" }}>
      <div style={{ background: S.card, borderRadius: 8, overflow: "hidden", position: "relative", boxShadow: isTop ? "0 8px 40px rgba(0,0,0,0.6)" : "0 2px 12px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Difficulty bar — pinned top */}
        <div style={{ height: 3, background: dc, width: "100%", flexShrink: 0 }} />
        {/* Swipe overlays — position:absolute, don't affect flex flow */}
        {isTop && lOp > 0.08 && (
          <div style={{ position: "absolute", top: 20, left: 16, opacity: lOp, transform: "rotate(-8deg)", zIndex: 10, border: `2px solid ${S.green}`, borderRadius: 4, padding: "4px 14px", color: S.green, fontWeight: 700, fontSize: 18, fontFamily: F, pointerEvents: "none", display: "flex", alignItems: "center", gap: 6 }}>
            Got it <Check size={18} />
          </div>
        )}
        {isTop && rOp > 0.08 && (
          <div style={{ position: "absolute", top: 20, right: 16, opacity: rOp, transform: "rotate(8deg)", zIndex: 10, border: `2px solid ${S.danger}`, borderRadius: 4, padding: "4px 14px", color: S.danger, fontWeight: 700, fontSize: 18, fontFamily: F, pointerEvents: "none", display: "flex", alignItems: "center", gap: 6 }}>
            Again <RotateCcw size={16} />
          </div>
        )}
        {/* Card header — pinned top */}
        <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: S.subdued, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontFamily: F }}>{card.topicTitle}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: S.white, lineHeight: 1.25, fontFamily: F, letterSpacing: "-0.01em" }}>{card.title}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: dc, fontFamily: F, letterSpacing: "0.05em" }}>{dl}</span>
            <span style={{ fontSize: 11, color: S.faint, fontFamily: F }}>#{card.order}</span>
          </div>
        </div>
        <div style={{ margin: "16px 20px", height: 1, background: S.border, flexShrink: 0 }} />
        {/* Scrollable zone — body + deep dive.
            userSelect:text overrides the parent's "none" so text can be selected here.
            touch-action:pan-y lets vertical finger drags scroll instead of swiping. */}
        <div ref={scrollZoneRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, touchAction: "pan-y", userSelect: "text" }}>
          <div style={{ padding: "0 20px", fontSize: 15, lineHeight: 1.75, color: `${S.white}cc`, fontFamily: F, minHeight: 108 }}>
            {renderWithHighlights(card.body, cardHighlights)}
          </div>
          {showCtx && (
            <div style={{ margin: "14px 14px 0", background: S.elevated, borderRadius: 6, padding: "14px 16px", borderLeft: `2px solid ${S.green}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.green, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontFamily: F }}>Deep dive</div>
              <div style={{ fontSize: 13, lineHeight: 1.75, color: S.subdued, fontFamily: F }}>{card.context}</div>
            </div>
          )}
          <div style={{ height: 14 }} />
        </div>
        {/* Action buttons — pinned bottom */}
        <div style={{ padding: "10px 20px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0, borderTop: `1px solid ${S.border}` }}>
          {!showCtx
            ? <button aria-label="Expand" onClick={() => { hap.light(); snd.reveal(); setShowCtx(true); }} style={{ fontSize: 12, fontWeight: 700, color: S.white, background: "transparent", border: `1px solid ${S.border}`, borderRadius: 500, padding: "6px 16px", cursor: "pointer", fontFamily: F, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }} onMouseEnter={e => e.currentTarget.style.borderColor = S.white} onMouseLeave={e => e.currentTarget.style.borderColor = S.border}><ChevronUp size={14} />Expand</button>
            : <button aria-label="Collapse" onClick={() => { hap.light(); setShowCtx(false); }} style={{ fontSize: 12, fontWeight: 700, color: S.subdued, background: "transparent", border: `1px solid ${S.border}`, borderRadius: 500, padding: "6px 16px", cursor: "pointer", fontFamily: F, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }} onMouseEnter={e => e.currentTarget.style.borderColor = S.subdued} onMouseLeave={e => e.currentTarget.style.borderColor = S.border}><ChevronDown size={14} />Collapse</button>
          }
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {/* Highlight button — appears when text is selected in the body */}
            {isTop && hasSelection && (
              <button
                aria-label="Highlight selection"
                onMouseDown={e => e.preventDefault()} // prevent focus-steal that clears the selection
                onClick={saveHighlight}
                style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', background: '#f59e0b18', border: '1px solid #f59e0b66', borderRadius: 500, padding: "6px 12px", cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = '#f59e0b30'}
                onMouseLeave={e => e.currentTarget.style.background = '#f59e0b18'}
              >
                <Highlighter size={13} />Highlight
              </button>
            )}
            <button aria-label={starred ? "Starred" : "Star"} onClick={() => { hap.light(); onStarred(); }} style={{ color: starred ? S.star : S.subdued, background: starred ? `${S.star}18` : "transparent", border: `1px solid ${starred ? S.star : S.border}`, borderRadius: 500, padding: "6px 14px", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={15} color={starred ? S.star : S.subdued} fill={starred ? S.star : "none"} />
            </button>
            <button onClick={() => { hap.medium(); onConfused(); }} style={{ fontSize: 12, fontWeight: 700, color: confused ? S.green : S.subdued, background: confused ? `${S.green}18` : "transparent", border: `1px solid ${confused ? S.green : S.border}`, borderRadius: 500, padding: "6px 14px", cursor: "pointer", fontFamily: F, transition: "all 0.15s" }}>
              {confused ? "Flagged" : "Flag"}
            </button>
          </div>
        </div>
        {/* Tags — pinned bottom */}
        <div style={{ paddingBottom: 14, paddingTop: 6, paddingLeft: 20, display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          {card.tags.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 700, color: S.subdued, background: S.elevated, borderRadius: 500, padding: "3px 10px", fontFamily: F, letterSpacing: "0.04em" }}>{t}</span>)}
        </div>
      </div>
    </div>
  );
}
