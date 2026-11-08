import { defineContentScript } from 'wxt/utils/define-content-script';
import { startContent } from '../../src/content';
import './style.css';

export default defineContentScript({
  matches: ['https://github.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const stop = await startContent();
    ctx.onInvalidated(stop);
  },
});
