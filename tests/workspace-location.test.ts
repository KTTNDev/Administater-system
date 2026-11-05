import {expect,it} from 'vitest';
import {previousWorkspaceView,visitWorkspaceView,type WorkspaceLocation} from '../src/lib/workspace-location';
it('records menu navigation and pops without adding a return loop',()=>{
 let state:WorkspaceLocation={current:'home',past:[]};state=visitWorkspaceView(state,'tasks');state=visitWorkspaceView(state,'projects');state=visitWorkspaceView(state,'settings');expect(state.past).toEqual(['home','tasks','projects']);state=previousWorkspaceView(state);expect(state).toEqual({current:'projects',past:['home','tasks']});state=previousWorkspaceView(state);expect(state.current).toBe('tasks');state=previousWorkspaceView(state);expect(state).toEqual({current:'home',past:[]});
});
it('ignores duplicate visits and falls back to Home when opened directly',()=>{
 const state:WorkspaceLocation={current:'settings',past:[]};expect(visitWorkspaceView(state,'settings')).toBe(state);expect(previousWorkspaceView(state)).toEqual({current:'home',past:[]});
});
it('does not reopen an older draft editor entry after another draft is opened',()=>{
 const state=visitWorkspaceView({current:'dashboard',past:['home','templates','editor']},'editor');expect(state.past).toEqual(['home','templates','dashboard']);expect(previousWorkspaceView(state).current).toBe('dashboard');
 const repeated=visitWorkspaceView({current:'dashboard',past:['home','dashboard','editor']},'editor');expect(repeated.past).toEqual(['home','dashboard']);expect(previousWorkspaceView(previousWorkspaceView(repeated))).toEqual({current:'home',past:[]});
});
it('bounds session history while keeping the most recent pages',()=>{
 let state:WorkspaceLocation={current:'home',past:[]};for(let n=0;n<100;n++)state=visitWorkspaceView(state,n%2?'tasks':'settings');expect(state.past).toHaveLength(40);expect(state.current).toBe('tasks');expect(previousWorkspaceView(state).current).toBe('settings');
});
