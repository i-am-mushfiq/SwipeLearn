import { RotateCcw, Star, Flag } from 'lucide-react';
import { S, F } from '../theme.js';

export function ProgressBar({current,total,revisitCount,confusedCount,starredCount=0}){
  const pct=total?Math.round(current/total*100):0;
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12,fontFamily:F}}>
        <span style={{color:S.subdued,fontWeight:700}}>{current} / {total}</span>
        <span style={{display:"flex",gap:12,alignItems:"center"}}>
          {revisitCount>0&&<span data-testid="revisit-count" style={{color:S.danger,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}><RotateCcw size={11}/>{revisitCount}</span>}
          {confusedCount>0&&<span style={{color:S.green,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}><Flag size={11} fill={S.green}/>{confusedCount}</span>}
          {starredCount>0&&<span style={{color:S.star,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}><Star size={11} fill={S.star}/>{starredCount}</span>}
          <span style={{color:S.white,fontWeight:700}}>{pct}%</span>
        </span>
      </div>
      <div style={{height:4,background:S.faint,borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:S.green,borderRadius:2,transition:"width 0.4s"}}/>
      </div>
    </div>
  );
}
