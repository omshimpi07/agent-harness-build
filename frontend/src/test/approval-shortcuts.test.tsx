import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalDialog } from '@/components/console/approval-dialog';

afterEach(cleanup);
const req = { approval_id: 'approval-1', tool: 'filesystem.write', filename: '/workspace/config.yaml', content_preview: 'enabled: true' };
describe('Human approval keyboard controls', () => {
  it('Escape denies and dismisses a sensitive operation', () => {
    const respond = vi.fn();
    render(<ApprovalDialog req={req} onRespond={respond}/>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(respond).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('Command+Enter authorizes the pending operation', () => {
    const respond = vi.fn();
    render(<ApprovalDialog req={req} onRespond={respond}/>);
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    expect(respond).toHaveBeenCalledExactlyOnceWith(true);
  });
});