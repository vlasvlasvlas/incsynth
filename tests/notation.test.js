import test from 'node:test';
import assert from 'node:assert/strict';
import {staffY,notationLayout} from '../src/ui/notation.js';
import {compilePattern} from '../src/audio/score.js';
test('treble staff places pitches diatonically, retaining octave and accidental position',()=>{
 assert.equal(staffY('E4'),92);
 assert.equal(staffY('F5'),52);
 assert.equal(staffY('C4'),102);
 assert.equal(staffY('A3'),112);
 assert.equal(staffY('B5'),37);
 assert.equal(staffY('F#4'),staffY('F4'));
 assert.equal(staffY('Bb4'),staffY('B4'));
});
test('notation retains written values when grace steals time and ties extend sounding duration',()=>{
 const pattern=[{nota:'E4',duracion:'4n',grace:[{nota:'C4'}]},{nota:'F4',duracion:'8n',tieToNext:true},{nota:'F4',duracion:'2n.'},{nota:null,duracion:'16n'}];
 const layout=notationLayout(pattern,compilePattern(pattern));
 assert.deepEqual(layout.map(e=>e.denominator),[8,4,8,2,16]);
 assert.equal(layout[0].grace,true);
 assert.equal(layout[3].kind,'tie');
 assert.equal(layout[3].dotted,true);
 assert.ok(layout.every((e,i)=>i===0||e.x>layout[i-1].x));
});
test('natural signs cancel prior alterations visibly, including the high B in figure 35',()=>{
 const p=['Bb4','G5','B5','F#5','F5'].map(nota=>({nota,duracion:'4n'}));
 assert.deepEqual(notationLayout(p,compilePattern(p)).map(e=>e.accidental),['♭','','♮','♯','♮']);
});
