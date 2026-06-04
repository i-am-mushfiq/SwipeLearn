import { useState } from 'react';
import { X, Trash2, ChevronRight, FileText, Folder, Download } from 'lucide-react';
import { S, F } from '../../theme.js';
import { hap } from '../../audio.js';
import { SpotifyBtn } from '../ui/SpotifyBtn.jsx';

export function EditorTree({node,depth=0,isRoot,onAddDir,onAddTopic,onEdit,onDelete,onCards,onExport}){
  const[open,setOpen]=useState(true);
  // Cap indent so deeply-nested trees don't overflow phone screens
  const pad=Math.min(depth*16, 48);
  const DelBtn=({id,title="",stopProp=false})=>(
    <button onClick={e=>{if(stopProp)e.stopPropagation();onDelete(id,title);}}
      aria-label="Delete"
      style={{background:"none",border:"none",color:S.subdued,cursor:"pointer",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",flexShrink:0,touchAction:"manipulation"}}
      onMouseEnter={e=>e.currentTarget.style.color=S.danger}
      onMouseLeave={e=>e.currentTarget.style.color=S.subdued}>
      <Trash2 size={15}/>
    </button>
  );
  if(node.type==="topic"){
    return(
      <div style={{padding:"10px 10px 8px",marginLeft:pad,marginBottom:2,borderRadius:6,transition:"background 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=S.card}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        {/* Title row */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:34,height:34,borderRadius:4,background:S.card,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <FileText size={15} color={S.subdued}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:S.white,fontFamily:F,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{node.title}</div>
            <div style={{fontSize:12,color:S.subdued,fontFamily:F}}>{node.cards.length} card{node.cards.length!==1?"s":""}</div>
          </div>
        </div>
        {/* Action row — sits below title so buttons always have enough room */}
        <div style={{display:"flex",gap:6,marginTop:8,paddingLeft:42,alignItems:"center",flexWrap:"wrap"}}>
          <SpotifyBtn size="sm" variant="ghost" onClick={()=>onCards(node)}>Cards</SpotifyBtn>
          <SpotifyBtn size="sm" variant="ghost" onClick={()=>onEdit(node)}>Rename</SpotifyBtn>
          {onExport&&(
            <SpotifyBtn size="sm" variant="ghost" onClick={()=>onExport(node)}>
              <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Download size={11}/>Export</span>
            </SpotifyBtn>
          )}
          <DelBtn id={node.id} title={node.title}/>
        </div>
      </div>
    );
  }
  return(
    <div style={{marginBottom:4}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 10px",marginLeft:pad,borderRadius:6,cursor:"pointer",transition:"background 0.15s",touchAction:"manipulation"}}
        onClick={()=>setOpen(!open)}
        onMouseEnter={e=>e.currentTarget.style.background=S.card}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <ChevronRight size={14} color={S.subdued} style={{transition:"transform 0.2s",transform:open?"rotate(90deg)":"rotate(0deg)",flexShrink:0}}/>
        <Folder size={16} color={S.subdued} style={{flexShrink:0}}/>
        <span style={{fontSize:14,fontWeight:700,color:S.white,flex:1,fontFamily:F,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{node.title}</span>
        {!isRoot&&<>
          <SpotifyBtn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();onEdit(node);}}>Rename</SpotifyBtn>
          <DelBtn id={node.id} title={node.title} stopProp/>
        </>}
      </div>
      {open&&<>
        {node.children?.map(c=><EditorTree key={c.id} node={c} depth={depth+1} onAddDir={onAddDir} onAddTopic={onAddTopic} onEdit={onEdit} onDelete={onDelete} onCards={onCards} onExport={onExport}/>)}
        <div style={{display:"flex",gap:8,marginLeft:Math.min(pad+38,80),marginTop:4,marginBottom:8,flexWrap:"wrap"}}>
          <SpotifyBtn size="sm" variant="ghost" onClick={()=>onAddDir(node.id)}>+ Folder</SpotifyBtn>
          <SpotifyBtn size="sm" variant="ghost" onClick={()=>onAddTopic(node.id)}>+ Topic</SpotifyBtn>
        </div>
      </>}
    </div>
  );
}
