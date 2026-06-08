import { RecalculationEngine } from './src/utils/dependency/RecalculationEngine';
import { parseFormula, evaluateFormula } from './src/utils/formula';
import type { Cell } from './shared/types';

console.log('=== Spreadsheet Engine Test Suite ===\n');

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    console.log(`${result ? '✓' : '✗'} ${name}`);
    return result;
  } catch (e) {
    console.log(`✗ ${name} - Error: ${e}`);
    return false;
  }
}

function assertEqual(actual: unknown, expected: unknown, msg: string = ''): boolean {
  if (actual === expected) return true;
  console.log(`  Expected: ${expected}, Got: ${actual} ${msg}`);
  return false;
}

let allPassed = true;

allPassed = test('Formula Parser: Basic arithmetic', () => {
  const result = parseFormula('=1+2*3');
  return assertEqual(result.dependencies.length, 0);
}) && allPassed;

allPassed = test('Formula Parser: Cell reference', () => {
  const result = parseFormula('=A1+B1');
  return assertEqual(result.dependencies.length, 2) && 
         result.dependencies.includes('A1') && 
         result.dependencies.includes('B1');
}) && allPassed;

allPassed = test('Formula Parser: Range reference', () => {
  const result = parseFormula('=SUM(A1:A3)');
  return assertEqual(result.dependencies.length, 3) &&
         result.dependencies.includes('A1') &&
         result.dependencies.includes('A2') &&
         result.dependencies.includes('A3');
}) && allPassed;

allPassed = test('Formula Evaluator: Basic arithmetic', () => {
  const result = evaluateFormula('=1+2*3', {});
  return assertEqual(result, 7);
}) && allPassed;

allPassed = test('Formula Evaluator: Parentheses', () => {
  const result = evaluateFormula('=(1+2)*3', {});
  return assertEqual(result, 9);
}) && allPassed;

console.log('\n--- Recalculation Engine Tests ---');

allPassed = test('Recalc Engine: Basic formula update', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('A1', '1');
  engine.updateCell('A2', '2');
  const result = engine.updateCell('A3', '=SUM(A1:A2)');
  
  const a3 = result.updatedCells['A3'];
  return assertEqual(a3?.value, 3);
}) && allPassed;

allPassed = test('Recalc Engine: Dependency propagation', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('A1', '1');
  engine.updateCell('A2', '2');
  engine.updateCell('A3', '=SUM(A1:A2)');
  
  const result = engine.updateCell('A1', '10');
  const a3 = result.updatedCells['A3'];
  return assertEqual(a3?.value, 12);
}) && allPassed;

allPassed = test('Recalc Engine: IF function', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('A1', '10');
  
  let result = engine.updateCell('B1', '=IF(A1>5, "big", "small")');
  let b1 = result.updatedCells['B1'];
  if (!assertEqual(b1?.value, 'big', 'IF true branch')) return false;
  
  result = engine.updateCell('A1', '3');
  b1 = result.updatedCells['B1'];
  return assertEqual(b1?.value, 'small', 'IF false branch');
}) && allPassed;

allPassed = test('Recalc Engine: VLOOKUP exact match', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('D1', 'apple');
  engine.updateCell('E1', '100');
  engine.updateCell('D2', 'banana');
  engine.updateCell('E2', '200');
  
  const result = engine.updateCell('A1', '=VLOOKUP("apple", D1:E2, 2, FALSE)');
  const a1 = result.updatedCells['A1'];
  return assertEqual(a1?.value, 100);
}) && allPassed;

allPassed = test('Recalc Engine: VLOOKUP approximate match', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('D1', '10');
  engine.updateCell('E1', 'A');
  engine.updateCell('D2', '20');
  engine.updateCell('E2', 'B');
  engine.updateCell('D3', '30');
  engine.updateCell('E3', 'C');
  
  const result = engine.updateCell('A1', '=VLOOKUP(25, D1:E3, 2, TRUE)');
  const a1 = result.updatedCells['A1'];
  return assertEqual(a1?.value, 'B');
}) && allPassed;

allPassed = test('Recalc Engine: Circular reference detection', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('A1', '=B1');
  engine.updateCell('B1', '=C1');
  const result = engine.updateCell('C1', '=A1');
  
  const a1 = result.updatedCells['A1'];
  const b1 = result.updatedCells['B1'];
  const c1 = result.updatedCells['C1'];
  
  return assertEqual(a1?.value, '#REF!') &&
         assertEqual(b1?.value, '#REF!') &&
         assertEqual(c1?.value, '#REF!') &&
         assertEqual(a1?.isCircular, true) &&
         result.circularCells.length === 3;
}) && allPassed;

allPassed = test('Recalc Engine: Built-in functions', () => {
  const cells: Record<string, Cell> = {
    A1: { id: 'A1', type: 'number', rawValue: '1', value: 1 },
    A2: { id: 'A2', type: 'number', rawValue: '2', value: 2 },
    A3: { id: 'A3', type: 'number', rawValue: '3', value: 3 },
    A4: { id: 'A4', type: 'number', rawValue: '4', value: 4 },
    A5: { id: 'A5', type: 'number', rawValue: '5', value: 5 },
  };
  
  let passed = true;
  passed = assertEqual(evaluateFormula('=AVERAGE(A1:A5)', cells), 3) && passed;
  passed = assertEqual(evaluateFormula('=MIN(A1:A5)', cells), 1) && passed;
  passed = assertEqual(evaluateFormula('=MAX(A1:A5)', cells), 5) && passed;
  passed = assertEqual(evaluateFormula('=COUNT(A1:A5)', cells), 5) && passed;
  passed = assertEqual(evaluateFormula('=LEN("hello")', cells), 5) && passed;
  passed = assertEqual(evaluateFormula('=ROUND(3.14159, 2)', cells), 3.14) && passed;
  passed = assertEqual(evaluateFormula('=CONCAT("hello", " ", "world")', cells), 'hello world') && passed;
  
  return passed;
}) && allPassed;

allPassed = test('Recalc Engine: Performance - 10000 formulas', () => {
  const engine = new RecalculationEngine();
  
  for (let col = 0; col < 10; col++) {
    for (let row = 1; row <= 1000; row++) {
      const colLetter = String.fromCharCode(65 + col);
      const cellId = `${colLetter}${row}`;
      if (row === 1) {
        engine.updateCell(cellId, String(col + 1));
      } else {
        const prevCell = `${colLetter}${row - 1}`;
        engine.updateCell(cellId, `=${prevCell}+1`);
      }
    }
  }
  
  const startTime = performance.now();
  const result = engine.updateCell('A1', '100');
  const endTime = performance.now();
  
  const duration = endTime - startTime;
  console.log(`  Recalculation took ${duration.toFixed(2)}ms for ${Object.keys(result.updatedCells).length} cells`);
  
  const allCells = engine.getCells();
  const lastCell = allCells['A1000'];
  return assertEqual(lastCell?.value, 1099) && duration < 100;
}) && allPassed;

allPassed = test('Recalc Engine: Number formatting', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('A1', '1234.5678');
  
  const cell = engine.getCells()['A1'];
  return assertEqual(cell?.value, 1234.5678) && assertEqual(cell?.type, 'number');
}) && allPassed;

allPassed = test('Recalc Engine: Date parsing', () => {
  const engine = new RecalculationEngine();
  engine.updateCell('A1', '2024-01-15');
  
  const cell = engine.getCells()['A1'];
  return assertEqual(cell?.type, 'date') && cell?.value instanceof Date;
}) && allPassed;

allPassed = test('Recalc Engine: Comparison operators', () => {
  const cells: Record<string, Cell> = {
    A1: { id: 'A1', type: 'number', rawValue: '10', value: 10 },
    A2: { id: 'A2', type: 'number', rawValue: '20', value: 20 },
  };
  
  let passed = true;
  passed = assertEqual(evaluateFormula('=A1<A2', cells), true) && passed;
  passed = assertEqual(evaluateFormula('=A1>A2', cells), false) && passed;
  passed = assertEqual(evaluateFormula('=A1=10', cells), true) && passed;
  passed = assertEqual(evaluateFormula('=A1<>10', cells), false) && passed;
  passed = assertEqual(evaluateFormula('=A1<=10', cells), true) && passed;
  passed = assertEqual(evaluateFormula('=A2>=20', cells), true) && passed;
  
  return passed;
}) && allPassed;

console.log('\n' + (allPassed ? '=== All tests passed! ===' : '=== Some tests failed ==='));
process.exit(allPassed ? 0 : 1);
