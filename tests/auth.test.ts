import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({cookies:vi.fn(),get:vi.fn(),set:vi.fn()}));
vi.mock('next/headers',()=>({cookies:mocks.cookies}));
import {authenticated,requireUser,createSession,loginRequired} from '../src/lib/auth';

beforeEach(()=>{
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('SARABUN_REQUIRE_LOGIN','');vi.stubEnv('LOCAL_DEMO','false');
 vi.stubEnv('SESSION_SECRET','');vi.stubEnv('APP_PASSWORD','');
 mocks.cookies.mockReset().mockResolvedValue({get:mocks.get,set:mocks.set});mocks.get.mockReset();mocks.set.mockReset();
});
afterEach(()=>vi.unstubAllEnvs());
it('opens the single-user workspace without a password, session, or secret by default',async()=>{
 expect(loginRequired()).toBe(false);expect(await authenticated()).toBe(true);
 await expect(requireUser()).resolves.toBeUndefined();await createSession();
 expect(mocks.cookies).not.toHaveBeenCalled();expect(mocks.set).not.toHaveBeenCalled();
});
it('ignores an expired cookie while login is disabled',async()=>{
 vi.stubEnv('SARABUN_REQUIRE_LOGIN','false');mocks.get.mockReturnValue({value:'expired-session'});
 expect(await authenticated()).toBe(true);await expect(requireUser()).resolves.toBeUndefined();
});
it('still enforces sessions when login is explicitly enabled in production',async()=>{
 vi.stubEnv('SARABUN_REQUIRE_LOGIN','true');vi.stubEnv('LOCAL_DEMO','true');
 expect(await authenticated()).toBe(false);await expect(requireUser()).rejects.toThrow('กรุณาเข้าสู่ระบบใหม่');
 mocks.get.mockReturnValue({value:'invalid-session'});expect(await authenticated()).toBe(false);
});
it('can create and validate a session when login is enabled again',async()=>{
 vi.stubEnv('SARABUN_REQUIRE_LOGIN','true');vi.stubEnv('SESSION_SECRET','test-existing-secret-'.repeat(3));
 await createSession();expect(mocks.set).toHaveBeenCalledOnce();
 mocks.get.mockReturnValue({value:mocks.set.mock.calls[0][1]});expect(await authenticated()).toBe(true);
});
