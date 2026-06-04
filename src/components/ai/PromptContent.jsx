import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { S, F, inpStyle } from '../../theme.js';
import { hap, snd } from '../../audio.js';
import { generateCards, AI_TIERS } from '../../ai.js';
import { supabase } from '../../supabase.js';
import { Field } from '../ui/Field.jsx';
import { SpotifyBtn } from '../ui/SpotifyBtn.jsx';

export function PromptContent({inline=false,onImport,aiUsage=0,aiLimit=AI_TIERS.free.dailyLimit,onUsageUpdate}){
  const[topic,setTopic]=useState("");
  const[audience,setAudience]=useState("");
  const[difficulty,setDifficulty]=useState(null);
  const[cardCount,setCardCount]=useState(30);
  const[copied,setCopied]=useState(null);
  const[generating,setGenerating]=useState(false);
  const[genResult,setGenResult]=useState(null);
  const[genError,setGenError]=useState(null);

  const generate=async()=>{
    if(!topic.trim()){setGenError("Enter a topic first.");return;}
    if(aiUsage>=aiLimit){setGenError(`Daily limit of ${aiLimit} AI cards reached. Resets at 00:00 GMT.`);return;}
    setGenerating(true);setGenError(null);setGenResult(null);
    try{
      let jwt=null;
      if(supabase){try{const{data:{session}}=await supabase.auth.getSession();jwt=session?.access_token??null;}catch{}}
      const result=await generateCards(buildMaster(),jwt);
      hap.success();snd.reveal();
      setGenResult(result);
      const added=result.cards?.length??0;
      onUsageUpdate&&onUsageUpdate(added,result._usage?.used??null);
    }catch(e){hap.error();setGenError(e.message);}
    finally{setGenerating(false);}
  };

  const diffNote={
    beginner:"Focus on difficulty 1 (Intro) cards. Use everyday language and analogies. Define every term you introduce.",
    intermediate:"Mix of difficulty 1–2. Assume basic domain familiarity but no deep expertise.",
    expert:"Difficulty 2–3. Skip the basics. Go deep on mechanisms, tradeoffs, and edge cases.",
  };

  const buildMaster=()=>{
    const t=topic.trim()||"[YOUR TOPIC]";
    const a=audience.trim()?`\nAUDIENCE: ${audience.trim()}`:"";
    const d=difficulty?`\nDIFFICULTY: ${difficulty} — ${diffNote[difficulty]}`:"";
    return `You are an expert curriculum designer creating content for a sequential card-based learning app.

TOPIC: ${t}${a}${d}
CARD COUNT: Generate exactly ${cardCount} cards.

Design a carefully sequenced set of learning cards. The order IS the curriculum — later cards assume the user understood earlier ones.

CARD RULES:
- One atomic idea per card. If you want to say two things, make two cards.
- body: 2–4 sentences. Plain language. Define any jargon you introduce.
- context: The deeper "so what" — why it matters, how it connects, the underlying mechanism.
- Cards must build on each other. Never reference a concept before introducing it.
- tags: reflect concept type e.g. "foundational", "mechanism", "tradeoff", "example".
- difficulty: 1 = Intro, 2 = Core, 3 = Advanced.

OUTPUT: Raw JSON only. No markdown, no code fences, no explanation before or after.

{
  "id": "topic-abc123",
  "title": "${t}",
  "type": "topic",
  "path": [],
  "cards": [
    {
      "id": "card-1",
      "order": 1,
      "title": "Concept name (short noun-phrase)",
      "body": "2–4 sentences. One idea only. Plain language.",
      "context": "Deeper why or how. What a practitioner would add.",
      "tags": ["foundational"],
      "difficulty": 1
    }
  ]
}`;
  };

  const buildSimple=()=>{
    const t=topic.trim()||"[YOUR TOPIC]";
    const a=audience.trim()?` for ${audience.trim()}`:"";
    const d=difficulty?` Difficulty focus: ${difficulty}.`:"";
    return `You are a curriculum designer. Break "${t}"${a} into a sequential card set of exactly ${cardCount} cards.${d}
Output ONLY valid JSON: { "id": "topic-abc", "title": "${t}", "type": "topic", "path": [], "cards": [{ "id": "card-1", "order": 1, "title": "...", "body": "2–4 sentences, one idea only.", "context": "deeper why/how", "tags": ["foundational"], "difficulty": 1 }] }
Rules: one idea per card, each card builds on the last, difficulty 1=Intro 2=Core 3=Advanced. No markdown. Raw JSON only.`;
  };

  const copy=(type)=>{
    const text=type==="master"?buildMaster():buildSimple();
    navigator.clipboard.writeText(text).then(()=>{hap.success();snd.reveal();setCopied(type);setTimeout(()=>setCopied(null),2200);}).catch(()=>{hap.error();});
  };

  const aiSteps=[
    ["1","Enter a topic above (audience and difficulty are optional)"],
    ["2","Click Generate with AI and wait a few seconds"],
    ["3","Review the cards then tap Add to Library"],
  ];

  return(
    <div data-testid="prompt-panel">
      <Field label="Topic">
        <input style={inpStyle()} value={topic} onChange={e=>setTopic(e.target.value)} placeholder='e.g. How transformers work' autoFocus={!inline} onFocus={e=>e.target.style.borderColor=S.white} onBlur={e=>e.target.style.borderColor=S.border}/>
      </Field>
      <Field label="Audience (optional)">
        <input style={inpStyle()} value={audience} onChange={e=>setAudience(e.target.value)} placeholder='e.g. software engineers with no ML background' onFocus={e=>e.target.style.borderColor=S.white} onBlur={e=>e.target.style.borderColor=S.border}/>
      </Field>
      <Field label="Difficulty (optional)">
        <div style={{display:"flex",gap:8}}>
          {[["Beginner","beginner",S.d1],["Intermediate","intermediate",S.d2],["Expert","expert",S.d3]].map(([label,val,color])=>(
            <button key={val} onClick={()=>{hap.light();setDifficulty(difficulty===val?null:val);}}
              style={{flex:1,padding:"10px 0",borderRadius:4,border:`1px solid ${difficulty===val?color:S.border}`,background:difficulty===val?`${color}22`:"transparent",color:difficulty===val?color:S.subdued,cursor:"pointer",fontSize:13,fontFamily:F,fontWeight:700,transition:"all 0.15s"}}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label={`Number of cards — ${cardCount}`}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:12,color:S.faint,fontFamily:F,flexShrink:0}}>1</span>
          <div style={{flex:1,position:"relative"}}>
            <style>{`
              .sl-slider{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;background:linear-gradient(to right,${S.green} ${cardCount}%,${S.faint} ${cardCount}%);outline:none;cursor:pointer;}
              .sl-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:${S.green};cursor:pointer;box-shadow:0 0 0 3px ${S.card},0 0 0 5px ${S.green}44;}
              .sl-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:${S.green};cursor:pointer;border:none;box-shadow:0 0 0 3px ${S.card},0 0 0 5px ${S.green}44;}
            `}</style>
            <input
              type="range" min={1} max={100} value={cardCount}
              onChange={e=>setCardCount(Number(e.target.value))}
              className="sl-slider"
            />
          </div>
          <span style={{fontSize:12,color:S.faint,fontFamily:F,flexShrink:0}}>100</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:S.faint,fontFamily:F}}>
          <span>Quick overview</span>
          <span>Deep dive</span>
        </div>
      </Field>

      {/* ── Action buttons ── */}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:20}}>
        {!generating&&!genResult&&(
          <SpotifyBtn fullWidth onClick={generate}><span style={{display:"inline-flex",alignItems:"center",gap:7}}>Generate with AI <Sparkles size={14}/></span></SpotifyBtn>
        )}
        {generating&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"14px",background:S.elevated,border:`1px solid ${S.border}`,borderRadius:500}}>
            <div style={{width:14,height:14,border:`2px solid ${S.green}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
            <span style={{fontSize:14,fontWeight:700,color:S.subdued,fontFamily:F}}>Generating cards…</span>
          </div>
        )}
        {!generating&&(
          <>
            <SpotifyBtn fullWidth variant="secondary" onClick={()=>copy("master")}>
              {copied==="master"?<span style={{display:"inline-flex",alignItems:"center",gap:5}}><Check size={13}/>Copied</span>:"Copy Master Prompt"}
            </SpotifyBtn>
            <SpotifyBtn fullWidth variant="secondary" onClick={()=>copy("simple")}>
              {copied==="simple"?<span style={{display:"inline-flex",alignItems:"center",gap:5}}><Check size={13}/>Copied</span>:"Copy Simple Prompt"}
            </SpotifyBtn>
          </>
        )}
      </div>

      {/* ── Error ── */}
      {genError&&(
        <div style={{marginTop:12,padding:"10px 14px",background:`${S.danger}15`,border:`1px solid ${S.danger}44`,borderRadius:6,fontSize:13,color:S.danger,fontFamily:F,lineHeight:1.5}}>
          {genError}
        </div>
      )}

      {/* ── Generation result preview ── */}
      {genResult&&(
        <div style={{marginTop:16,background:S.card,borderRadius:6,padding:"16px 18px"}}>
          <div style={{fontSize:11,fontWeight:700,color:S.green,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10,fontFamily:F,display:"flex",alignItems:"center",gap:5}}><Check size={12}/>Generated</div>
          <div style={{fontSize:15,fontWeight:700,color:S.white,fontFamily:F,marginBottom:4}}>{genResult.title||topic}</div>
          <div style={{fontSize:12,color:S.subdued,fontFamily:F,marginBottom:12}}>{genResult.cards.length} cards</div>
          {genResult.cards.slice(0,4).map(c=>(
            <div key={c.id||c.order} style={{fontSize:12,color:S.faint,fontFamily:F,padding:"4px 0",borderBottom:`1px solid ${S.border}`}}>#{c.order} {c.title}</div>
          ))}
          {genResult.cards.length>4&&<div style={{fontSize:12,color:S.faint,fontFamily:F,marginTop:6}}>+{genResult.cards.length-4} more</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
            {onImport&&(
              <SpotifyBtn fullWidth onClick={()=>{onImport(genResult);setGenResult(null);}}>Add to Library</SpotifyBtn>
            )}
            <SpotifyBtn fullWidth variant="secondary" onClick={()=>{setGenResult(null);generate();}}>Regenerate</SpotifyBtn>
            <SpotifyBtn fullWidth variant="ghost" onClick={()=>setGenResult(null)}>Discard</SpotifyBtn>
          </div>
        </div>
      )}

      {/* ── How to use ── */}
      {!genResult&&(
        <div style={{marginTop:20,background:S.card,borderRadius:6,padding:"16px 18px"}}>
          <div style={{fontSize:11,fontWeight:700,color:S.subdued,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,fontFamily:F}}>How to use</div>
          {aiSteps.map(([n,text])=>(
            <div key={n} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:S.elevated,border:`1px solid ${S.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:S.green,flexShrink:0,fontFamily:F,marginTop:1}}>{n}</div>
              <div style={{fontSize:13,color:S.subdued,fontFamily:F,lineHeight:1.6}}>{text}</div>
            </div>
          ))}
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${S.border}`,fontSize:12,color:S.faint,fontFamily:F,lineHeight:1.6}}>
            Prefer your own LLM? Copy a prompt above and paste into any AI — then use Import JSON.
          </div>
        </div>
      )}
    </div>
  );
}
