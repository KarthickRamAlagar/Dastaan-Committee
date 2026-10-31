import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { createNextConfig } from '../../shared/web/next-config.mjs';

if (process.env.NODE_ENV !== 'production') initOpenNextCloudflareForDev();

export default createNextConfig();
