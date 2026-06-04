import { useState } from 'react';
import { S } from '../../theme.js';
import { hap } from '../../audio.js';
import { uid, rebuildPaths, findAndUpdate, findAndDelete, insertInto, downloadJson, exportTopicData, toJsonFilename } from '../../lib.js';
import { Modal } from '../ui/Modal.jsx';
import { SpotifyBtn } from '../ui/SpotifyBtn.jsx';
import { EditorTree } from './EditorTree.jsx';
import { DirectoryModal } from './DirectoryModal.jsx';
import { TopicModal } from './TopicModal.jsx';
import { CardSetManager } from './CardSetManager.jsx';
import { ImportModal } from './ImportModal.jsx';
import { PromptModal } from '../ai/PromptModal.jsx';

export function LibraryEditor({library,onSave,onClose}){
  const[tree,setTree]=useState(library);
  const[modal,setModal]=useState(null);
  const[pendingDelete,setPendingDelete]=useState(null); // {id, title}
  const addDir=(pid,t)=>{setTree(p=>rebuildPaths(insertInto(p,pid,{id:`dir-${uid()}`,title:t,type:"directory",children:[]})));setModal(null);};
  const addTopic=(pid,t)=>{setTree(p=>rebuildPaths(insertInto(p,pid,{id:`topic-${uid()}`,title:t,type:"topic",path:[],cards:[]})));setModal(null);};
  const renameNode=(id,t)=>{setTree(p=>rebuildPaths(findAndUpdate(p,id,n=>({...n,title:t}))));setModal(null);};
  const requestDelete=(id,title)=>{setPendingDelete({id,title});};
  const confirmDelete=()=>{hap.error();setTree(p=>rebuildPaths(findAndDelete(p,pendingDelete.id)));setPendingDelete(null);};
  const saveCards=(topic)=>{setTree(p=>rebuildPaths(findAndUpdate(p,topic.id,()=>topic)));setModal(null);};
  const handleImport=(data)=>{setTree(p=>rebuildPaths(insertInto(p,"root",{...data,id:data.id||`topic-${uid()}`,type:"topic",path:data.path||[]})));setModal(null);};
  const handleExportTopic=(node)=>{hap.success();downloadJson(toJsonFilename(node.title),exportTopicData(node));};
  const handleExportLibrary=()=>{hap.success();downloadJson("library.json",tree);};
  return(
    <>
      <Modal title="Your Library" onClose={onClose} width={640}>
        <EditorTree node={tree} isRoot onAddDir={id=>setModal({type:"dir",pid:id})} onAddTopic={id=>setModal({type:"topic",pid:id})} onEdit={n=>setModal({type:n.type==="directory"?"dir":"topic",node:n})} onDelete={requestDelete} onCards={n=>setModal({type:"cards",node:n})} onExport={handleExportTopic}/>
        <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${S.border}`}}>
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <SpotifyBtn variant="ghost" onClick={()=>setModal({type:"prompt"})}>Generate prompt</SpotifyBtn>
            <SpotifyBtn variant="ghost" onClick={()=>setModal({type:"import"})}>Import JSON</SpotifyBtn>
            <SpotifyBtn variant="ghost" onClick={handleExportLibrary}>Export library</SpotifyBtn>
          </div>
          <SpotifyBtn fullWidth onClick={()=>{hap.success();onSave(tree);onClose();}}>Save library</SpotifyBtn>
        </div>
      </Modal>
      {modal?.type==="dir"&&!modal.node&&<DirectoryModal onSave={t=>addDir(modal.pid,t)} onClose={()=>setModal(null)}/>}
      {modal?.type==="dir"&&modal.node&&<DirectoryModal existing={modal.node} onSave={t=>renameNode(modal.node.id,t)} onClose={()=>setModal(null)}/>}
      {modal?.type==="topic"&&!modal.node&&<TopicModal onSave={t=>addTopic(modal.pid,t)} onClose={()=>setModal(null)}/>}
      {modal?.type==="topic"&&modal.node&&<TopicModal existing={modal.node} onSave={t=>renameNode(modal.node.id,t)} onClose={()=>setModal(null)}/>}
      {modal?.type==="cards"&&<CardSetManager topic={modal.node} onSave={saveCards} onClose={()=>setModal(null)}/>}
      {modal?.type==="import"&&<ImportModal onClose={()=>setModal(null)} onImport={handleImport}/>}
      {modal?.type==="prompt"&&<PromptModal onClose={()=>setModal(null)} onImport={handleImport}/>}
      {pendingDelete&&(
        <Modal title="Delete?" onClose={()=>setPendingDelete(null)} width={360}>
          <p style={{fontSize:14,color:S.subdued,fontFamily:"inherit",marginBottom:20,lineHeight:1.6}}>
            Delete <strong style={{color:S.white}}>"{pendingDelete.title}"</strong>? This cannot be undone.
          </p>
          <div style={{display:"flex",gap:10}}>
            <SpotifyBtn variant="ghost" onClick={()=>setPendingDelete(null)}>Cancel</SpotifyBtn>
            <button onClick={confirmDelete}
              style={{flex:1,padding:"14px 32px",borderRadius:500,background:"transparent",border:`1px solid ${S.danger}`,color:S.danger,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"background 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background=`${S.danger}18`;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
