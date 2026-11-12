const test = require('node:test');
const assert = require('node:assert/strict');
const {parseDecimalInput} = require('../ui/decimal');

test('comma/dot prices, cents and pasted euro amounts are parsed consistently', () => {
    for (const [input, expected] of [['1,25',1.25],['1.25',1.25],['0,05',0.05],['0.05',0.05],['1,',1],['1.',1],[',25',0.25],['.25',0.25],['0',0],['1.234,56',1234.56],['1,234.56',1234.56],[' 1,25 € ',1.25],['1234.56',1234.56],['1.250',1.25],['-1,25',-1.25]]) assert.equal(parseDecimalInput(input),expected,input);
});
test('invalid text is never truncated to a valid monetary value', () => {
    for (const input of [undefined,'',' ','abc','1,2,3','1.2.3','1,25xyz','1e3','Infinity','1.23,45','1 25','1/2',',','.']) assert.ok(Number.isNaN(parseDecimalInput(input)),String(input));
});
