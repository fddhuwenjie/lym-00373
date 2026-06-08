import { Lexer } from './lexer';
import { Parser } from './parser';
import { Evaluator } from './evaluator';
import type { ASTNode, CellReferenceNode, CellRangeNode } from './ast';
import type { Cell } from '../../../shared/types';

export interface ParseResult {
  ast: ASTNode;
  dependencies: string[];
}

export function parseFormula(formula: string): ParseResult {
  const lexer = new Lexer(formula);
  const tokens = lexer.tokenize();
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const dependencies = extractDependencies(ast);
  
  return { ast, dependencies };
}

export function evaluateFormula(
  formula: string,
  cells: Record<string, Cell>
): number | string | boolean | null | Cell[] {
  try {
    const { ast } = parseFormula(formula);
    const evaluator = new Evaluator(cells);
    return evaluator.evaluate(ast);
  } catch (error) {
    return '#ERROR!';
  }
}

function extractDependencies(ast: ASTNode): string[] {
  const dependencies = new Set<string>();
  
  function traverse(node: ASTNode): void {
    switch (node.type) {
      case 'CellReference':
        dependencies.add(cellRefToString(node));
        break;
      
      case 'CellRange':
        for (const cellId of expandRange(node)) {
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

function cellRefToString(ref: CellReferenceNode): string {
  return `${ref.column}${ref.row}`;
}

function expandRange(range: CellRangeNode): string[] {
  const cells: string[] = [];
  
  const startCol = range.start.column.charCodeAt(0) - 65;
  const endCol = range.end.column.charCodeAt(0) - 65;
  const startRow = range.start.row;
  const endRow = range.end.row;
  
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  
  for (let col = minCol; col <= maxCol; col++) {
    const colLetter = String.fromCharCode(65 + col);
    for (let row = minRow; row <= maxRow; row++) {
      cells.push(`${colLetter}${row}`);
    }
  }
  
  return cells;
}

export * from './ast';
export { Lexer } from './lexer';
export { Parser } from './parser';
export { Evaluator } from './evaluator';
export { builtinFunctions } from './functions';
