import { Lexer } from './lexer';
import { Parser } from './parser';
import { Evaluator } from './evaluator';
import type { ASTNode, CellReferenceNode, CellRangeNode } from './ast';
import type { Cell } from '../../../shared/types';

export interface ParseResult {
  ast: ASTNode;
  dependencies: string[];
}

export function parseFormula(formula: string, defaultSheetId?: string): ParseResult {
  const lexer = new Lexer(formula);
  const tokens = lexer.tokenize();
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const dependencies = extractDependencies(ast, defaultSheetId);
  
  return { ast, dependencies };
}

export function evaluateFormula(
  formula: string,
  cells: Record<string, Record<string, Cell>>,
  defaultSheetId: string
): number | string | boolean | null | Cell[] | Date {
  try {
    const { ast } = parseFormula(formula, defaultSheetId);
    const evaluator = new Evaluator(cells, defaultSheetId);
    return evaluator.evaluate(ast);
  } catch (error) {
    return '#ERROR!';
  }
}

function extractDependencies(ast: ASTNode, defaultSheetId?: string): string[] {
  const dependencies = new Set<string>();
  
  function traverse(node: ASTNode): void {
    switch (node.type) {
      case 'CellReference':
        dependencies.add(cellRefToString(node, defaultSheetId));
        break;
      
      case 'CellRange':
        for (const cellId of expandRange(node, defaultSheetId)) {
          dependencies.add(cellId);
        }
        break;
      
      case 'BinaryOperation':
        traverse(node.left);
        traverse(node.right);
        break;
      
      case 'UnaryOperation':
        traverse(node.operand);
        break;
      
      case 'FunctionCall':
        for (const arg of node.arguments) {
          traverse(arg);
        }
        break;
      
      case 'ParenthesizedExpression':
        traverse(node.expression);
        break;
    }
  }
  
  traverse(ast);
  return Array.from(dependencies);
}

export function cellRefToString(ref: CellReferenceNode, defaultSheetId?: string): string {
  const sheetId = ref.sheetId || defaultSheetId;
  const cellId = `${ref.column}${ref.row}`;
  return sheetId ? `${sheetId}:${cellId}` : cellId;
}

export function expandRange(range: CellRangeNode, defaultSheetId?: string): string[] {
  const cells: string[] = [];
  
  const startCol = range.start.column.charCodeAt(0) - 65;
  const endCol = range.end.column.charCodeAt(0) - 65;
  const startRow = range.start.row;
  const endRow = range.end.row;
  
  const sheetId = range.start.sheetId || defaultSheetId;
  const sheetPrefix = sheetId ? `${sheetId}:` : '';
  
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  
  for (let col = minCol; col <= maxCol; col++) {
    const colLetter = String.fromCharCode(65 + col);
    for (let row = minRow; row <= maxRow; row++) {
      cells.push(`${sheetPrefix}${colLetter}${row}`);
    }
  }
  
  return cells;
}

export function parseCompoundKey(key: string): { sheetId: string; cellId: string } {
  const colonIndex = key.indexOf(':');
  if (colonIndex === -1) {
    return { sheetId: 'sheet1', cellId: key };
  }
  return {
    sheetId: key.substring(0, colonIndex),
    cellId: key.substring(colonIndex + 1)
  };
}

export function createCompoundKey(sheetId: string, cellId: string): string {
  return `${sheetId}:${cellId}`;
}

export * from './ast';
export { Lexer } from './lexer';
export { Parser } from './parser';
export { Evaluator } from './evaluator';
export { builtinFunctions } from './functions';
