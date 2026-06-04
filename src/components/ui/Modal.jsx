import { X } from 'lucide-react';
import { S, F } from '../../theme.js';
import { hap } from '../../audio.js';

export function Modal({title,onClose,children,width=480,"data-testid":testId}){
  return(
    <div data-testid={testId} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:200,padding:"12px 8px 16px",overflowY:"auto"}}>
      <div style={{background:S.elevated,borderRadius:8,width:"100%",maxWidth:width,boxShadow:"0 16px 64px rgba(0,0,0,0.8)",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 14px",position:"sticky",top:0,background:S.elevated,zIndex:1,borderRadius:"8px 8px 0 0"}}>
          <div style={{fontSize:19,fontWeight:700,color:S.white,fontFamily:F,letterSpacing:"-0.02em"}}>{title}</div>
          <button aria-label="Close" onClick={()=>{hap.light();onClose();}} style={{background:"transparent",border:"none",color:S.subdued,cursor:"pointer",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.color=S.white}
            onMouseLeave={e=>e.currentTarget.style.color=S.subdued}>
            <X size={16}/>
          </button>
        </div>
        <div style={{padding:"0 16px 20px"}}>{children}</div>
      </div>
    </div>
  );
}
