import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    watch: {
      // Filesystem events don't cross the WSL2 ⇄ Windows boundary, so when the
      // project lives under /mnt/c the watcher never fires and HMR silently
      // serves stale modules. Polling costs a little CPU but is the only thing
      // that works there; harmless on native filesystems.
      usePolling: true,
      interval: 300,
    },
  },
});
