import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  manifest: {
    name: 'Pinned Repos for GitHub',
    description: 'Pin your favorite repositories to the top of your GitHub home dashboard.',
    homepage_url: 'https://github.com/leynier/pinned-repos-for-github',
    permissions: ['storage'],
    host_permissions: ['https://github.com/*'],
    action: {
      default_title: 'Pinned Repos for GitHub',
    },
  },
});
