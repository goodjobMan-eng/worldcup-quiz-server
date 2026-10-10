import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import '../월드컵-본선-진출국-탐구-퀴즈/public/config.js';
import {apply,makeWorld} from '../월드컵-본선-진출국-탐구-퀴즈/src/sandbox/engine';
import {MathPanel} from '../월드컵-본선-진출국-탐구-퀴즈/src/sandbox/Panels';
const panelRequire=createRequire(new URL('../월드컵-본선-진출국-탐구-퀴즈/src/sandbox/Panels.tsx',import.meta.url));
const {createElement}=panelRequire('react');
const {renderToStaticMarkup}=panelRequire('react-dom/server');
(globalThis as any).React=panelRequire('react');

test('mission panel labels every ground-floor cell and names the trade source',()=>{
 let w=makeWorld('1234','teacher','학교','6-1','seoul','seoul','중부');
 w=apply(w,'child',{type:'join',nickname:'별이'});
 w=apply(w,'teacher',{type:'assign',player:'child',nation:'hualian'});
 w.stage=2;
 const html=renderToStaticMarkup(createElement(MathPanel,{w,p:w.players.child,busy:false,send:()=>{},onCamera:()=>{}}));
 assert.equal((html.match(/role="gridcell"/g)||[]).length,25);
 assert.match(html,/1층/);
 assert.match(html,/2층/);
 assert.match(html,/히노미에서 교역/);
 assert.match(html,/점토/);
});
