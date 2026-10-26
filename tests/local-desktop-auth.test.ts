import {afterEach,expect,it,vi} from 'vitest';
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined})}));
import {authenticated} from '../src/lib/auth';
afterEach(()=>vi.unstubAllEnvs());
it('requires login in production unless the local desktop launcher explicitly opts in',async()=>{
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('LOCAL_DEMO','true');vi.stubEnv('SARABUN_LOCAL_DESKTOP','');
 expect(await authenticated()).toBe(false);
 vi.stubEnv('SARABUN_LOCAL_DESKTOP','false');expect(await authenticated()).toBe(false);
 vi.stubEnv('SARABUN_LOCAL_DESKTOP','true');expect(await authenticated()).toBe(true);
});
