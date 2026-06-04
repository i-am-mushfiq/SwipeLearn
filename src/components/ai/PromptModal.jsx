import { Modal } from '../ui/Modal.jsx';
import { PromptContent } from './PromptContent.jsx';

export function PromptModal({onClose,onImport,aiUsage=0,aiLimit=1000,onUsageUpdate}){
  return(
    <Modal title="Generate with AI" onClose={onClose} width={560} data-testid="generate-modal">
      <PromptContent inline={false} onImport={onImport} aiUsage={aiUsage} aiLimit={aiLimit} onUsageUpdate={onUsageUpdate}/>
    </Modal>
  );
}
