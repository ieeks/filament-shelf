import test from 'node:test';
import assert from 'node:assert/strict';
import { labelVariants, printDocument } from '../js/labels.js';
const roll={material:'PLA Basic',colorName:'White',colorCode:'10100',colors:['#FFFFFF'],remainingWeight:1000};
test('labels deduplicate variants, omit empty/archive and distinguish materials/manufacturers',()=>{
 const rows=labelVariants([roll,{...roll,kind:'refill'}, {...roll,remainingWeight:0},{...roll,archived:true},{...roll,material:'PETG'},{...roll,manufacturer:'Other'}]);
 assert.equal(rows.length,3);
});
test('print content escapes user input and does not expose private fields',()=>{
 const html=printDocument([{...roll,colorName:'</span><script>alert("x")</script>',notes:'private note',purchasePrice:42}]);
 assert.ok(!html.includes('<script>alert'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('private note'));
});
test('A4 pagination and one label per page use fixed physical dimensions',()=>{
 const labels=Array(113).fill(roll);
 assert.equal((printDocument(labels).match(/class="sheet"/g)||[]).length,2);
 assert.equal((printDocument([roll,roll],'single').match(/class="sheet"/g)||[]).length,2);
 assert.match(printDocument([roll],'single'),/size:18mm 12mm;margin:0/);
 assert.throws(()=>printDocument([]));assert.throws(()=>printDocument(Array(1001).fill(roll)));
});
