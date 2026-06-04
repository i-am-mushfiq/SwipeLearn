import { X, Check, Highlighter } from 'lucide-react';
import { S, F, THEME_META } from '../theme.js';
import { hap, snd } from '../audio.js';
import { flattenTopics } from '../lib.js';
import { COMMUNITY_DECKS } from '../constants.js';

export function Sidebar({open,onClose,themeName,onTheme,library,onAddDeck,user,onSignIn,onSignOut,syncStatus="idle",aiUsage=0,aiLimit=1000,highlightCount=0,onShowHighlights,onReset}){
  const syncLabel={
    idle:{text:"Synced",color:S.faint,dot:S.faint,check:false},
    pending:{text:"Saving…",color:S.subdued,dot:S.subdued,check:false},
    syncing:{text:"Syncing…",color:S.green,dot:S.green,check:false},
    synced:{text:"Synced",color:S.green,dot:S.green,check:true},
    error:{text:"Sync failed",color:S.danger,dot:S.danger,check:false},
    offline:{text:"Offline — saved locally",color:"#f59e0b",dot:"#f59e0b",check:false},
  }[syncStatus]||{text:"",color:S.faint,dot:S.faint,check:false};
  // A deck is "added" if the library contains a topic whose id OR sourceId matches
  // the community deck's id. sourceId is stamped on topics by handleDirectImport
  // so that "already added" detection survives the fresh-ID assignment.
  const libraryTopics=flattenTopics(library||{id:"root",type:"directory",children:[]});
  const addedIds=new Set([...libraryTopics.map(t=>t.id),...libraryTopics.map(t=>t.sourceId).filter(Boolean)]);
  return(
    <>
      {/* Backdrop */}
      <div onClick={()=>{hap.light();onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,pointerEvents:open?"auto":"none",opacity:open?1:0,transition:"opacity 0.28s"}}/>
      {/* Panel */}
      <div style={{position:"fixed",top:0,left:0,height:"100%",width:272,background:S.surface,borderRight:`1px solid ${S.border}`,zIndex:301,transform:open?"translateX(0)":"translateX(-280px)",transition:"transform 0.28s cubic-bezier(0.4,0,0.2,1)",overflowY:"auto",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"20px 16px 16px",borderBottom:`1px solid ${S.border}`,flexShrink:0}}>
          <img src="/icon-192.png" alt="Deckwise" style={{width:28,height:28,borderRadius:6}}/>
          <span style={{fontSize:16,fontWeight:700,color:S.white,fontFamily:F,flex:1,letterSpacing:"-0.01em"}}>Deckwise</span>
          <button aria-label="Close sidebar" onClick={()=>{hap.light();onClose();}} style={{background:"transparent",border:"none",color:S.subdued,cursor:"pointer",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.color=S.white}
            onMouseLeave={e=>e.currentTarget.style.color=S.subdued}>
            <X size={16}/>
          </button>
        </div>

        {/* ── Account ── */}
        {user?(
          <div style={{padding:"16px",borderBottom:`1px solid ${S.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              {user.user_metadata?.avatar_url?(
                <img src={user.user_metadata.avatar_url} alt="" style={{width:36,height:36,borderRadius:"50%",flexShrink:0}}/>
              ):(
                <div style={{width:36,height:36,borderRadius:"50%",background:`${S.green}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,color:S.green,fontWeight:700}}>
                  {(user.user_metadata?.full_name||user.email||"?")[0].toUpperCase()}
                </div>
              )}
              <div style={{flex:1,minWidth:0}}>
                {user.user_metadata?.full_name&&<div style={{fontSize:13,fontWeight:700,color:S.white,fontFamily:F,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.user_metadata.full_name}</div>}
                <div style={{fontSize:11,color:S.faint,fontFamily:F,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
              </div>
            </div>
            <div style={{fontSize:11,color:syncLabel.color,fontFamily:F,marginBottom:10,display:"flex",alignItems:"center",gap:5,transition:"color 0.3s"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:syncLabel.dot,display:"inline-block",transition:"background 0.3s"}}/>
              {syncLabel.text}
              {syncLabel.check&&<Check size={11} color={syncLabel.color} style={{marginLeft:1}}/>}
            </div>
            <button onClick={()=>{hap.medium();onSignOut();}}
              style={{width:"100%",padding:"8px 0",background:"transparent",border:`1px solid ${S.border}`,borderRadius:500,color:S.subdued,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=S.danger;e.currentTarget.style.color=S.danger;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=S.border;e.currentTarget.style.color=S.subdued;}}>
              Sign out
            </button>
          </div>
        ):(
          <div style={{padding:"16px",borderBottom:`1px solid ${S.border}`}}>
            <div style={{fontSize:13,fontWeight:700,color:S.white,fontFamily:F,marginBottom:4}}>Sign in to sync</div>
            <div style={{fontSize:12,color:S.faint,fontFamily:F,marginBottom:12,lineHeight:1.5}}>Access your library on any device.</div>
            <button onClick={()=>{hap.medium();onSignIn();}}
              style={{width:"100%",padding:"10px 0",background:S.green,border:"none",borderRadius:500,color:"#1c1208",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F,transition:"transform 0.1s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              Sign in
            </button>
          </div>
        )}

        {/* ── Color Profiles ── */}
        <div style={{padding:"20px 16px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:S.subdued,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,fontFamily:F}}>Color Profiles</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {THEME_META.map(tm=>{
              const active=themeName===tm.id;
              return(
                <button key={tm.id} onClick={()=>{onTheme(tm.id);}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:6,background:active?`${tm.accent}18`:"transparent",border:`1px solid ${active?tm.accent:S.border}`,cursor:"pointer",textAlign:"left",transition:"all 0.15s",width:"100%"}}>
                  {/* Swatch */}
                  <div style={{width:32,height:32,borderRadius:7,background:tm.bg,border:`2px solid ${tm.accent}`,flexShrink:0,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",bottom:0,right:0,width:"52%",height:"52%",background:tm.accent,borderTopLeftRadius:5}}/>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:active?S.white:S.subdued,fontFamily:F,flex:1,transition:"color 0.15s"}}>{tm.name}</span>
                  {active&&<Check size={15} color={tm.accent}/>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── AI Usage ── */}
        <div style={{padding:"0 16px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:S.subdued,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,fontFamily:F}}>AI Cards Today</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontFamily:F,marginBottom:6}}>
            <span style={{color:S.faint}}>{aiUsage} of {aiLimit} used</span>
            <span style={{color:aiUsage>=aiLimit?S.danger:aiUsage/aiLimit>=0.9?"#f59e0b":S.faint}}>
              {aiUsage>=aiLimit?"Limit reached":aiUsage/aiLimit>=0.9?"Almost full":`${aiLimit-aiUsage} remaining`}
            </span>
          </div>
          <div style={{height:4,background:S.faint,borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(100,(aiUsage/aiLimit)*100)}%`,background:aiUsage>=aiLimit?S.danger:aiUsage/aiLimit>=0.9?"#f59e0b":S.green,borderRadius:2,transition:"width 0.4s"}}/>
          </div>
          <div style={{marginTop:6,fontSize:11,color:S.faint,fontFamily:F}}>Resets at 00:00 GMT</div>
        </div>

        {/* ── Highlights ── */}
        <div style={{padding:"0 16px 16px"}}>
          <button onClick={()=>{hap.light();onShowHighlights?.();onClose();}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:S.elevated,border:`1px solid ${S.border}`,borderRadius:6,cursor:"pointer",transition:"border-color 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=S.subdued}
            onMouseLeave={e=>e.currentTarget.style.borderColor=S.border}>
            <Highlighter size={15} color="#f59e0b"/>
            <span style={{fontSize:13,fontWeight:700,color:S.white,fontFamily:F,flex:1,textAlign:"left"}}>My Highlights</span>
            {highlightCount>0&&<span style={{fontSize:11,fontWeight:700,color:"#f59e0b",background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:500,padding:"2px 8px",fontFamily:F}}>{highlightCount}</span>}
          </button>
        </div>

        {/* ── Settings ── */}
        <div style={{padding:"0 16px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:S.subdued,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,fontFamily:F}}>Settings</div>
          <button onClick={()=>{hap.error();onReset?.();onClose();}}
            style={{width:"100%",padding:"10px 0",background:"transparent",border:`1px solid ${S.border}`,borderRadius:500,color:S.subdued,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=S.danger;e.currentTarget.style.color=S.danger;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=S.border;e.currentTarget.style.color=S.subdued;}}>
            Reset all progress
          </button>
        </div>

        {/* Divider */}
        <div style={{height:1,background:S.border,margin:"0 16px"}}/>

        {/* ── Community Decks ── */}
        <div style={{padding:"20px 16px",flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:S.subdued,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4,fontFamily:F}}>Community Decks</div>
          <div style={{fontSize:12,color:S.faint,fontFamily:F,marginBottom:16,lineHeight:1.5}}>Curated decks you can add to your library</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {COMMUNITY_DECKS.map(deck=>{
              const added=addedIds.has(deck.id);
              return(
                <div key={deck.id} style={{background:S.elevated,borderRadius:8,padding:"14px",border:`1px solid ${S.border}`}}>
                  <div style={{fontSize:14,fontWeight:700,color:S.white,fontFamily:F,marginBottom:3}}>{deck.title}</div>
                  <div style={{fontSize:12,color:S.subdued,fontFamily:F,marginBottom:2,lineHeight:1.5}}>{deck.description}</div>
                  <div style={{fontSize:11,color:S.faint,fontFamily:F,marginBottom:12}}>{deck.cards.length} cards</div>
                  <button
                    onClick={()=>{if(!added){hap.success();snd.reveal();onAddDeck(deck);}}}
                    style={{width:"100%",padding:"8px 0",borderRadius:500,background:added?`${S.green}18`:"transparent",border:`1px solid ${added?S.green:S.border}`,color:added?S.green:S.subdued,cursor:added?"default":"pointer",fontSize:12,fontWeight:700,fontFamily:F,transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}
                    onMouseEnter={e=>{if(!added){e.currentTarget.style.borderColor=S.subdued;e.currentTarget.style.color=S.white;}}}
                    onMouseLeave={e=>{if(!added){e.currentTarget.style.borderColor=S.border;e.currentTarget.style.color=S.subdued;}}}>
                    {added?<><Check size={13}/>Added</>:"Add to Library"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
