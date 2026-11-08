import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
await build({ configFile:false,envFile:false,plugins:[react()],root:path.resolve('client'),resolve:{alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared'),'@assets':path.resolve('attached_assets')}},build:{outDir:path.resolve('output/service-view-statistics-build'),emptyOutDir:true} });
