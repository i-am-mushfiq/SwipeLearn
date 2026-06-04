import { useState } from 'react';
import { BookOpen, ChevronRight, Flag, Star, RotateCcw, MoreHorizontal, Folder } from 'lucide-react';
import { S, F } from '../../theme.js';
import { hap } from '../../audio.js';
import { CircularProgress } from '../CircularProgress.jsx';

export function DirectoryNode({ node, depth, onSelect, completionMap, progressMap, confusedIds = [], starredIds = [], onSelectFlagged, onSelectStarred, onResetTopic, onOpenEditor }) {
  const [open, setOpen] = useState(depth < 2);

  /* ── Topic row ────────────────────────────────────────────────────────────── */
  if (node.type === "topic") {
    const done = node.cards.filter(c => completionMap[c.id]).length;
    const pct = node.cards.length ? Math.round(done / node.cards.length * 100) : 0;
    const flaggedCount = node.cards.filter(c => confusedIds.includes(c.id)).length;
    const starredCount = node.cards.filter(c => starredIds.includes(c.id)).length;
    const hasProgress = pct > 0 || starredCount > 0 || flaggedCount > 0;

    const chipBtn = (children, color, onClick) => (
      <button onClick={e => { e.stopPropagation(); hap.light(); onClick(); }}
        style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 500, padding: "2px 8px", cursor: "pointer", fontFamily: F, transition: "all 0.15s", lineHeight: 1.6, display: "inline-flex", alignItems: "center", gap: 4 }}>
        {children}
      </button>
    );

    return (
      <div
        onClick={() => { if (node.cards.length) { hap.light(); onSelect(node); } }}
        style={{ background: S.elevated, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: node.cards.length ? "pointer" : "default", transition: "background 0.15s" }}
        onMouseEnter={e => { if (node.cards.length) e.currentTarget.style.background = S.card; }}
        onMouseLeave={e => e.currentTarget.style.background = S.elevated}
      >
        {/* Book icon */}
        <div style={{ width: 44, height: 44, borderRadius: 10, background: S.card, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BookOpen size={20} color={S.subdued} />
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.white, fontFamily: F, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.title}</div>
          <div style={{ fontSize: 12, color: S.subdued, fontFamily: F, marginTop: 2 }}>
            {node.cards.length} card{node.cards.length !== 1 ? "s" : ""}
            {!node.cards.length ? " · add cards in library" : ""}
          </div>
          {(flaggedCount > 0 || starredCount > 0) && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }} onClick={e => e.stopPropagation()}>
              {flaggedCount > 0 && chipBtn(<><Flag size={11} />{flaggedCount} flagged</>, S.green, () => onSelectFlagged?.(node))}
              {starredCount > 0 && chipBtn(<><Star size={11} />{starredCount} starred</>, S.star, () => onSelectStarred?.(node))}
            </div>
          )}
        </div>

        {/* Circular progress + per-topic reset */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <CircularProgress pct={pct} />
          {hasProgress && onResetTopic && (
            <button
              onClick={() => onResetTopic(node)}
              aria-label="Reset topic progress"
              title="Reset progress"
              style={{ background: "none", border: "none", color: S.faint, cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", borderRadius: 4, transition: "color 0.15s", touchAction: "manipulation" }}
              onMouseEnter={e => e.currentTarget.style.color = S.danger}
              onMouseLeave={e => e.currentTarget.style.color = S.faint}
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Root directory (depth 0) — no header, just render children ───────────── */
  if (depth === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {node.children?.map(c => (
          <DirectoryNode key={c.id} node={c} depth={depth + 1}
            onSelect={onSelect} completionMap={completionMap} progressMap={progressMap}
            confusedIds={confusedIds} starredIds={starredIds}
            onSelectFlagged={onSelectFlagged} onSelectStarred={onSelectStarred}
            onResetTopic={onResetTopic} onOpenEditor={onOpenEditor}
          />
        ))}
      </div>
    );
  }

  /* ── Folder directory (depth ≥ 1) ─────────────────────────────────────────── */
  return (
    <div>
      {/* Folder header row */}
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, cursor: "pointer", userSelect: "none" }}
      >
        <ChevronRight size={16} color={S.subdued}
          style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
        <Folder size={18} color={S.green} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: S.white, fontFamily: F, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.title}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onOpenEditor?.(); }}
          aria-label="Folder options"
          style={{ background: "none", border: "none", color: S.subdued, cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, transition: "color 0.15s", flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = S.white}
          onMouseLeave={e => e.currentTarget.style.color = S.subdued}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Children */}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {node.children?.map(c => (
            <DirectoryNode key={c.id} node={c} depth={depth + 1}
              onSelect={onSelect} completionMap={completionMap} progressMap={progressMap}
              confusedIds={confusedIds} starredIds={starredIds}
              onSelectFlagged={onSelectFlagged} onSelectStarred={onSelectStarred}
              onResetTopic={onResetTopic} onOpenEditor={onOpenEditor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
