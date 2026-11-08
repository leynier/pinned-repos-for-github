import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  manifest: ({ browser }) => ({
    name: 'Pinned Repos for GitHub',
    description: 'Pin your favorite repositories to the top of your GitHub home dashboard.',
    homepage_url: 'https://github.com/leynier/pinned-repos-for-github',
    permissions: ['storage'],
    host_permissions: ['https://github.com/*'],
    action: {
      default_title: 'Pinned Repos for GitHub',
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Permanent once published on addons.mozilla.org; `storage.sync` requires it.
          id: 'pinned-repos-for-github@leynier',
          // 142 is the first version (desktop and Android) that supports `data_collection_permissions`.
          strict_min_version: '142.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
