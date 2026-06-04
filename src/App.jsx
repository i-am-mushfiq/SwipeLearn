import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { uid, flattenTopics, rebuildPaths, insertInto, KEYS, lsLoad, lsSave, migrateLocalStorage, pruneOrphanedIds } from "./lib.js";
import { S, F, THEMES } from "./theme.js";
import { hap } from "./audio.js";
import { DEMO_DATA } from "./constants.js";
import { AI_TIERS } from "./ai.js";
import { useSync } from "./hooks/useSync.js";
import { useAiUsage } from "./hooks/useAiUsage.js";

// Components
import { Menu, X, ChevronLeft, RotateCcw } from "lucide-react";
import { SpotifyBtn } from "./components/ui/SpotifyBtn.jsx";
import { DraggableCard } from "./components/DraggableCard.jsx";
import { ActionBar } from "./components/ActionBar.jsx";
import { ProgressBar } from "./components/ProgressBar.jsx";
import { CompletionScreen } from "./components/CompletionScreen.jsx";
import { AuthModal } from "./components/AuthModal.jsx";
import { MergeModal } from "./components/MergeModal.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { LibraryEditor } from "./components/library/LibraryEditor.jsx";
import { DirectoryNode } from "./components/library/DirectoryNode.jsx";
import { PromptContent } from "./components/ai/PromptContent.jsx";
import { PromptModal } from "./components/ai/PromptModal.jsx";
import { HighlightsModal } from "./components/HighlightsModal.jsx";

export default function App(){
  const[ready,setReady]=useState(false);
  const[library,setLibrary]=useState(null);
  const[completionMap,setCompletionMap]=useState({});

  const[revisitIds,setRevisitIds]=useState([]);
  const[confusedIds,setConfusedIds]=useState([]);
  const[starredIds,setStarredIds]=useState([]);
  const[progressMap,setProgressMap]=useState({});
  const[screen,setScreen]=useState("home");
  const[activeTopic,setActiveTopic]=useState(null);
  const[cardIndex,setCardIndex]=useState(0);
  const[activeQueue,setActiveQueue]=useState([]);
  const[showEditor,setShowEditor]=useState(false);
  const[showPromptPanel,setShowPromptPanel]=useState(false);
  const[showQuickGenerate,setShowQuickGenerate]=useState(false);
  const[sidebarOpen,setSidebarOpen]=useState(false);
  const[themeName,setThemeName]=useState(()=>{try{return JSON.parse(localStorage.getItem("sl-theme"))||"autumn";}catch{return"autumn";}});
  const[cardHistory,setCardHistory]=useState([]);
  const[highlights,setHighlights]=useState(()=>lsLoad(KEYS.highlights,[]));
  const[showHighlights,setShowHighlights]=useState(false);

  // ── Auth state ────────────────────────────────────────────────────────────────
  const[user,setUser]=useState(null);
  const[showAuth,setShowAuth]=useState(false);
  const[mergeCandidate,setMergeCandidate]=useState(null);
  const userRef=useRef(null);
  useEffect(()=>{userRef.current=user;},[user]);

  // ── Hooks ─────────────────────────────────────────────────────────────────────
  const { aiUsage, handleUsageUpdate, initAiUsage } = useAiUsage();

  const { syncStatus, syncNow, cloudSyncEnabled, applyCloudData, loadCloudData } = useSync({
    library, completionMap, revisitIds, confusedIds, starredIds, progressMap, highlights,
    setLibrary, setCompletionMap, setRevisitIds, setConfusedIds, setStarredIds, setProgressMap, setHighlights,
    setMergeCandidate,
    userRef,
    DEMO_DATA,
  });

  // ── Actions ──────────────────────────────────────────────────────────────────

  // Resets all in-memory state and localStorage to demo defaults.
  // Defined early so the auth listener below can reference it.
  // Called from signOut() and from the SIGNED_OUT auth event (session expiry).
  const clearLocalSession=useCallback((userId)=>{
    cloudSyncEnabled.current=false;
    const today=new Date().toISOString().slice(0,10);
    setLibrary(DEMO_DATA);
    setCompletionMap({});
    setRevisitIds([]);
    setConfusedIds([]);
    setStarredIds([]);
    setProgressMap({});
    setScreen("home");
    lsSave(KEYS.library,DEMO_DATA);
    lsSave(KEYS.completion,{});
    lsSave(KEYS.revisit,[]);
    lsSave(KEYS.confused,[]);
    lsSave(KEYS.starred,[]);
    lsSave(KEYS.progress,{});
    lsSave(KEYS.aiUsage,{date:today,count:0});
    setHighlights([]);
    lsSave(KEYS.highlights,[]);
    if(userId)localStorage.removeItem(`sl-synced-${userId}`);
  },[]);

  const signOut=useCallback(async()=>{
    if(!supabase)return;
    const userId=userRef.current?.id;
    // Reset UI immediately — user must never see their data after clicking sign out,
    // regardless of whether the server call succeeds.
    clearLocalSession(userId);
    // Fire-and-forget: the UI is already clean; ignore network errors.
    try{await supabase.auth.signOut();}catch{}
  },[clearLocalSession]);

  // ── Supabase session listener ─────────────────────────────────────────────────
  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getSession().then(({data:{session}})=>{
      const u=session?.user??null;
      setUser(u);userRef.current=u;
      if(u)loadCloudData(u.id);
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      const prevUserId=userRef.current?.id; // capture before overwrite
      const u=session?.user??null;
      setUser(u);userRef.current=u;
      if(event==="SIGNED_IN"&&u){setShowAuth(false);loadCloudData(u.id);}
      // SIGNED_OUT fires for both manual sign-out and automatic session expiry.
      // clearLocalSession is idempotent — safe to call even if signOut() already ran it.
      if(event==="SIGNED_OUT"){clearLocalSession(prevUserId);}
    });
    return()=>subscription.unsubscribe();
  },[loadCloudData,clearLocalSession]);

  // ── Load from localStorage on boot ──────────────────────────────────────────
  useEffect(()=>{
    migrateLocalStorage(); // run any pending schema migrations before reading data
    const lib=lsLoad(KEYS.library,null)||DEMO_DATA;
    // Prune any card/topic IDs that no longer exist in the library.
    // This prevents ghost progress from deleted topics and eliminates stale
    // entries left by the pre-6e880d4 hardcoded-ID era.
    const pruned=pruneOrphanedIds(lib,{
      completionMap:lsLoad(KEYS.completion,{}),
      starredIds:lsLoad(KEYS.starred,[]),
      confusedIds:lsLoad(KEYS.confused,[]),
      revisitIds:lsLoad(KEYS.revisit,[]),
      progressMap:lsLoad(KEYS.progress,{}),
    });
    // Persist pruned copies so orphaned IDs don't reappear on next boot.
    lsSave(KEYS.completion,pruned.completionMap);
    lsSave(KEYS.starred,pruned.starredIds);
    lsSave(KEYS.confused,pruned.confusedIds);
    lsSave(KEYS.revisit,pruned.revisitIds);
    lsSave(KEYS.progress,pruned.progressMap);
    setLibrary(lib);
    setCompletionMap(pruned.completionMap);
    setRevisitIds(pruned.revisitIds);
    setConfusedIds(pruned.confusedIds);
    setStarredIds(pruned.starredIds);
    setProgressMap(pruned.progressMap);
    initAiUsage();
    setReady(true);
  },[]);

  const handleKeepLocal=useCallback(async()=>{
    const userId=userRef.current?.id;
    setMergeCandidate(null);
    cloudSyncEnabled.current=true;
    await syncNow(userId);
    if(userId)lsSave(`sl-synced-${userId}`,true);
  },[syncNow]);

  const handleUseCloud=useCallback(()=>{
    const userId=userRef.current?.id;
    if(mergeCandidate)applyCloudData(mergeCandidate);
    setMergeCandidate(null);
    if(userId)lsSave(`sl-synced-${userId}`,true);
  },[mergeCandidate,applyCloudData]);

  const switchTheme=useCallback((name)=>{
    Object.assign(S,THEMES[name]||THEMES.autumn);
    document.body.style.background=S.bg;
    document.documentElement.style.background=S.bg;
    setThemeName(name);
    lsSave("sl-theme",name);
  },[]);

  const saveLibrary=useCallback((tree)=>{setLibrary(tree);lsSave(KEYS.library,tree);},[]);

  const handleDirectImport=useCallback((data)=>{
    setLibrary(prev=>{
      // Always generate fresh IDs for every inserted topic and its cards.
      // This ensures community decks, re-imports, and AI-generated decks always
      // start at 0% — no stale completionMap entries from a previous copy can
      // bleed into the freshly added deck.
      const freshTopic={
        ...data,
        id:`topic-${uid()}`,
        sourceId:data.id||null, // original ID kept for "already added" detection in Sidebar
        type:"topic",
        path:[],
        cards:(data.cards||[]).map((c,i)=>({...c,id:`card-${uid()}`,order:i+1})),
      };
      const updated=rebuildPaths(insertInto(prev,"root",freshTopic));
      lsSave(KEYS.library,updated);
      return updated;
    });
  },[]);

  const topics=library?flattenTopics(library):[];
  const currentCard=activeQueue[cardIndex];
  const totalCards=topics.reduce((s,t)=>s+t.cards.length,0);
  const doneCards=topics.reduce((s,t)=>s+t.cards.filter(c=>completionMap[c.id]).length,0);
  const pct=totalCards?Math.round(doneCards/totalCards*100):0;

  const startTopic=(topic,mode="normal")=>{
    let cards;
    if(mode==="revisit")cards=topic.cards.filter(c=>revisitIds.includes(c.id));
    else if(mode==="flagged")cards=topic.cards.filter(c=>confusedIds.includes(c.id));
    else if(mode==="starred")cards=topic.cards.filter(c=>starredIds.includes(c.id));
    else cards=topic.cards;
    const queue=cards.map(c=>({...c,topicId:topic.id,topicTitle:topic.title}));
    const saved=mode==="normal"&&progressMap[topic.id]?progressMap[topic.id]:0;
    setCardHistory([]);
    setActiveTopic(topic);setActiveQueue(queue);setCardIndex(Math.min(saved,Math.max(0,queue.length-1)));setScreen("learn");
  };

  const advance=useCallback((dir)=>{
    const card=activeQueue[cardIndex];if(!card)return;
    setCardHistory(h=>[...h,{cardId:card.id,dir}]);
    if(dir==="left"){
      const nc={...completionMap,[card.id]:true};const nr=revisitIds.filter(id=>id!==card.id);
      setCompletionMap(nc);setRevisitIds(nr);lsSave(KEYS.completion,nc);lsSave(KEYS.revisit,nr);
    }else if(dir==="right"&&!revisitIds.includes(card.id)){
      const nr=[...revisitIds,card.id];setRevisitIds(nr);lsSave(KEYS.revisit,nr);
    }
    const next=cardIndex+1;
    if(next>=activeQueue.length){
      const np={...progressMap,[card.topicId]:0};setProgressMap(np);lsSave(KEYS.progress,np);setScreen("complete");
    }else{
      const np={...progressMap,[card.topicId]:next};setProgressMap(np);lsSave(KEYS.progress,np);setCardIndex(next);
    }
  },[activeQueue,cardIndex,completionMap,revisitIds,progressMap]);

  const goBack=useCallback(()=>{
    if(!cardHistory.length)return;
    const prev=cardHistory[cardHistory.length-1];
    setCardHistory(h=>h.slice(0,-1));
    if(prev.dir==="left"){
      const nc={...completionMap};delete nc[prev.cardId];
      setCompletionMap(nc);lsSave(KEYS.completion,nc);
    }else if(prev.dir==="right"){
      const nr=revisitIds.filter(id=>id!==prev.cardId);
      setRevisitIds(nr);lsSave(KEYS.revisit,nr);
    }
    const prevIndex=cardIndex-1;
    const prevCard=activeQueue[prevIndex];
    if(prevCard){const np={...progressMap,[prevCard.topicId]:prevIndex};setProgressMap(np);lsSave(KEYS.progress,np);}
    setCardIndex(prevIndex);
  },[cardHistory,cardIndex,completionMap,revisitIds,progressMap,activeQueue]);

  const toggleConfused=useCallback((id)=>{
    const next=confusedIds.includes(id)?confusedIds.filter(x=>x!==id):[...confusedIds,id];
    setConfusedIds(next);lsSave(KEYS.confused,next);
  },[confusedIds]);

  const toggleStarred=useCallback((id)=>{
    const next=starredIds.includes(id)?starredIds.filter(x=>x!==id):[...starredIds,id];
    setStarredIds(next);lsSave(KEYS.starred,next);
  },[starredIds]);

  const addHighlight=useCallback(({text,cardId,cardTitle,topicTitle})=>{
    // Deduplicate: don't save the exact same text for the same card twice
    const isDupe=highlights.some(h=>h.cardId===cardId&&h.text===text);
    if(isDupe)return;
    const hl={id:uid(),cardId,cardTitle,topicTitle,text,createdAt:Date.now()};
    const next=[...highlights,hl];
    setHighlights(next);lsSave(KEYS.highlights,next);
  },[highlights]);

  const removeHighlight=useCallback((id)=>{
    const next=highlights.filter(h=>h.id!==id);
    setHighlights(next);lsSave(KEYS.highlights,next);
  },[highlights]);

  const handleReset=()=>{
    hap.error();
    setCompletionMap({});setRevisitIds([]);setConfusedIds([]);setProgressMap({});
    [KEYS.completion,KEYS.revisit,KEYS.confused,KEYS.progress].forEach(k=>lsSave(k,k===KEYS.revisit||k===KEYS.confused?[]:{}) );
    setScreen("home");
  };

  const revisitCards=activeTopic?activeTopic.cards.filter(c=>revisitIds.includes(c.id)):[];
  const confusedCards=activeTopic?activeTopic.cards.filter(c=>confusedIds.includes(c.id)):[];
  const starredCards=activeTopic?activeTopic.cards.filter(c=>starredIds.includes(c.id)):[];

  if(!ready)return(
    <div style={{minHeight:"100vh",background:S.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:40,height:40,border:`3px solid ${S.green}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:S.bg,fontFamily:F,color:S.white}}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}button{font-family:${F};}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:${S.faint};border-radius:2px;}`}</style>

      {screen==="home"&&(
        <div style={{maxWidth:520,margin:"0 auto",padding:"24px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showPromptPanel?16:28}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>{hap.light();setSidebarOpen(true);}} style={{background:"transparent",border:"none",color:S.subdued,fontSize:20,cursor:"pointer",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",transition:"color 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.color=S.white}
                onMouseLeave={e=>e.currentTarget.style.color=S.subdued} aria-label="Open menu"><Menu size={20}/></button>
              <img src="/icon-192.png" alt="Deckwise" style={{width:36,height:36,borderRadius:8}}/>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>{hap.light();setShowPromptPanel(p=>!p);}} style={{background:showPromptPanel?`${S.green}18`:"transparent",border:`1px solid ${showPromptPanel?S.green:S.border}`,color:showPromptPanel?S.green:S.subdued,borderRadius:500,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F,transition:"all 0.15s",whiteSpace:"nowrap"}}
                onMouseEnter={e=>{if(!showPromptPanel){e.currentTarget.style.borderColor=S.subdued;e.currentTarget.style.color=S.white;}}}
                onMouseLeave={e=>{if(!showPromptPanel){e.currentTarget.style.borderColor=S.border;e.currentTarget.style.color=S.subdued;}}}>
                {showPromptPanel?<span style={{display:"inline-flex",alignItems:"center",gap:5}}><X size={13}/>Close</span>:"AI Prompt"}
              </button>
              <SpotifyBtn size="sm" onClick={()=>setShowEditor(true)}>Edit library</SpotifyBtn>
            </div>
          </div>
          {showPromptPanel&&(
            <div data-testid="prompt-panel" style={{background:S.elevated,border:`1px solid ${S.border}`,borderRadius:8,padding:"20px",marginBottom:24}}>
              <div style={{fontSize:13,fontWeight:700,color:S.green,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:16,fontFamily:F}}>Generate with AI</div>
              <PromptContent inline onImport={handleDirectImport} aiUsage={aiUsage.count} aiLimit={AI_TIERS.free.dailyLimit} onUsageUpdate={handleUsageUpdate}/>
            </div>
          )}
          <div style={{background:S.card,borderRadius:8,padding:"20px",marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:14}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:S.subdued,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:6}}>Overall progress</div>
                <div style={{fontSize:13,color:S.subdued,fontFamily:F}}>{doneCards} of {totalCards} cards</div>
              </div>
              <div style={{fontSize:32,fontWeight:700,color:S.green}}>{pct}<span style={{fontSize:18,color:S.subdued}}>%</span></div>
            </div>
            <div style={{height:4,background:S.faint,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,background:S.green,borderRadius:2,transition:"width 0.5s"}}/>
            </div>
            {(revisitIds.length>0||confusedIds.length>0)&&(
              <div style={{display:"flex",gap:16,marginTop:14}}>
                {revisitIds.length>0&&<span style={{fontSize:13,color:S.danger,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><RotateCcw size={12}/>{revisitIds.length} to review</span>}
                {confusedIds.length>0&&<span style={{fontSize:13,color:S.green,fontWeight:700}}>{confusedIds.length} flagged</span>}
              </div>
            )}
          </div>
          {library&&<DirectoryNode node={library} depth={0} onSelect={startTopic} completionMap={completionMap} progressMap={progressMap} confusedIds={confusedIds} starredIds={starredIds} onSelectFlagged={t=>startTopic(t,"flagged")} onSelectStarred={t=>startTopic(t,"starred")}/>}
          <div style={{marginTop:20,padding:"20px",background:S.elevated,borderRadius:8,border:`1px solid ${S.border}`,textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:S.white,fontFamily:F,marginBottom:4}}>Generate a topic with AI</div>
            <div style={{fontSize:13,color:S.subdued,fontFamily:F,marginBottom:16}}>Turn any subject into a ready-to-swipe card deck</div>
            <SpotifyBtn fullWidth onClick={()=>{hap.medium();setShowQuickGenerate(true);}}>Generate with AI ✦</SpotifyBtn>
          </div>
          <div style={{marginTop:12,background:S.card,borderRadius:8,padding:"16px 20px"}}>
            <div style={{fontSize:13,fontWeight:700,color:S.subdued,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:14}}>How to swipe</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["← Left","Got it ✓",S.green],["→ Right","Review ↺",S.danger],["↑ Up","Deep dive",S.white],["Flag btn","Research",S.subdued]].map(([k,v,c])=>(
                <div key={k}><div style={{fontSize:13,fontWeight:700,color:c,marginBottom:2}}>{k}</div><div style={{fontSize:12,color:S.faint}}>{v}</div></div>
              ))}
            </div>
          </div>
          <div style={{marginTop:10,textAlign:"center",fontSize:12,color:S.faint}}>All progress saved automatically</div>
        </div>
      )}

      {screen==="learn"&&currentCard&&(
        <div style={{maxWidth:520,margin:"0 auto",padding:"16px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <button onClick={()=>{hap.light();setScreen("home");}} style={{background:"transparent",border:"none",color:S.subdued,fontSize:22,cursor:"pointer",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%"}}
              onMouseEnter={e=>e.currentTarget.style.color=S.white}
              onMouseLeave={e=>e.currentTarget.style.color=S.subdued} aria-label="Back to library"><ChevronLeft size={24}/></button>
            <div style={{flex:1,fontSize:15,fontWeight:700,color:S.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeTopic?.title}</div>
          </div>
          <ProgressBar current={cardIndex} total={activeQueue.length} revisitCount={revisitIds.filter(id=>activeQueue.some(c=>c.id===id)).length} confusedCount={confusedIds.filter(id=>activeQueue.some(c=>c.id===id)).length}/>
          <div style={{position:"relative",minHeight:500,marginTop:20}}>
            {[2,1,0].map(offset=>{const c=activeQueue[cardIndex+offset];if(!c)return null;return <DraggableCard key={`${c.id}-${cardIndex}`} card={c} isTop={offset===0} stackIndex={offset} confused={confusedIds.includes(c.id)} onConfused={()=>toggleConfused(c.id)} starred={starredIds.includes(c.id)} onStarred={()=>toggleStarred(c.id)} onSwipe={advance} highlights={highlights} onHighlight={addHighlight}/>;}).filter(Boolean)}
          </div>
          <ActionBar onLeft={()=>advance("left")} onRight={()=>advance("right")} onBack={goBack} canBack={cardHistory.length>0}/>
          <div style={{textAlign:"center",fontSize:12,color:S.faint,marginTop:8}}>Drag or tap · progress saved</div>
        </div>
      )}

      {screen==="complete"&&activeTopic&&(
        <div style={{maxWidth:520,margin:"0 auto",padding:"20px 16px"}}>
          <CompletionScreen topic={activeTopic} revisitCards={revisitCards} confusedCards={confusedCards} starredCards={starredCards} onHome={()=>setScreen("home")} onRevisitAll={()=>startTopic(activeTopic,"revisit")} onStudyFlagged={()=>startTopic(activeTopic,"flagged")} onStudyStarred={()=>startTopic(activeTopic,"starred")}/>
        </div>
      )}

      {showEditor&&library&&<LibraryEditor library={library} onSave={saveLibrary} onClose={()=>setShowEditor(false)}/>}
      {showQuickGenerate&&<PromptModal onClose={()=>setShowQuickGenerate(false)} onImport={handleDirectImport} aiUsage={aiUsage.count} aiLimit={AI_TIERS.free.dailyLimit} onUsageUpdate={handleUsageUpdate}/>}
      <Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} themeName={themeName} onTheme={switchTheme} library={library||{id:"root",type:"directory",children:[]}} onAddDeck={handleDirectImport} user={user} onSignIn={()=>{setSidebarOpen(false);setShowAuth(true);}} onSignOut={signOut} syncStatus={syncStatus} aiUsage={aiUsage.count} aiLimit={AI_TIERS.free.dailyLimit} highlightCount={highlights.length} onShowHighlights={()=>setShowHighlights(true)} onReset={handleReset}/>
      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)}/>}
      {showHighlights&&<HighlightsModal highlights={highlights} onRemove={removeHighlight} onClose={()=>setShowHighlights(false)}/>}
      {mergeCandidate&&<MergeModal onKeepLocal={handleKeepLocal} onUseCloud={handleUseCloud}/>}
    </div>
  );
}
