import type { ASTNode, CellReferenceNode, CellRangeNode } from './ast';
import type { Cell } from '../../../shared/types';
import { builtinFunctions } from './functions';

export class Evaluator {
  private cells: Record<string, Cell>;

  constructor(cells: Record<string, Cell>) {
    this.cells = cells;
  }

  evaluate(ast: ASTNode): number | string | boolean | null | Cell[] {
    return this.evaluateNode(ast);
  }

  private evaluateNode(node: ASTNode): number | string | boolean | null | Cell[] {
    switch (node.type) {
      case 'Number':
        return node.value;
      
      case 'String':
        return node.value;
      
      case 'Boolean':
        return node.value;
      
      case 'CellReference':
        return this.evaluateCellReference(node);
      
      case 'CellRange':
        return this.evaluateCellRange(node);
      
      case 'BinaryOperation':
        return this.evaluateBinaryOperation(node);
      
      case 'UnaryOperation':
        return this.evaluateUnaryOperation(node);
      
      case 'FunctionCall':
        return this.evaluateFunctionCall(node);
      
      case 'ParenthesizedExpression':
        return this.evaluateNode(node.expression);
      
      default:
        throw new Error(`Unknown AST node type: ${(node as ASTNode).type}`);
    }
  }

  private evaluateCellReference(node: CellReferenceNode): number | string | boolean | null | Cell[] {
    const cellId = `${node.column}${node.row}`;
    const cell = this.cells[cellId];
    
    if (!cell) {
      return null;
    }
    
    if (cell.isCircular) {
      return '#REF!';
    }
    
    if (cell.isError) {
      return cell.errorMessage || '#ERROR!';
    }
    
    if (cell.value instanceof Date) {
      return cell.value.toISOString().split('T')[0];
    }
    
    return cell.value;
  }

  private evaluateCellRange(node: CellRangeNode): Cell[] {
    const cells: Cell[] = [];
    
    const startCol = node.start.column;
    const startRow = node.start.row;
    const endCol = node.end.column;
    const endRow = node.end.row;
    
    const startColIndex = startCol.charCodeAt(0) - 65;
    const endColIndex = endCol.charCodeAt(0) - 65;
    
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    
    for (let col = minCol; col <= maxCol; col++) {
      const colLetter = String.fromCharCode(65 + col);
      for (let row = minRow; row <= maxRow; row++) {
        const cellId = `${colLetter}${row}`;
        const cell = this.cells[cellId];
        if (cell) {
          cells.push(cell);
        }
      }
    }
    
    return cells;
  }

  private evaluateBinaryOperation(node: { operator: string; left: ASTNode; right: ASTNode }): number | string | boolean | null | Cell[] {
    const left = this.evaluateNode(node.left);
    const right = this.evaluateNode(node.right);
    
    if (typeof left === 'string' && left.startsWith('#') && left.endsWith('!')) {
      return left;
    }
    if (typeof right === 'string' && right.startsWith('#') && right.endsWith('!')) {
      return right;
    }
    
    switch (node.operator) {
      case '+':
        return this.toNumber(left) + this.toNumber(right);
      
      case '-':
        return this.toNumber(left) - this.toNumber(right);
      
      case '*':
        return this.toNumber(left) * this.toNumber(right);
      
      case '/':
        const divisor = this.toNumber(right);
        if (divisor === 0) return '#DIV/0!';
        return this.toNumber(left) / divisor;
      
      case '^':
        return Math.pow(this.toNumber(left), this.toNumber(right));
      
      case '&':
        return String(left ?? '') + String(right ?? '');
      
      case '=':
        return this.compareValues(left, right) === 0;
      
      case '<>':
        return this.compareValues(left, right) !== 0;
      
      case '<':
        return this.compareValues(left, right) < 0;
      
      case '<=':
        return this.compareValues(left, right) <= 0;
      
      case '>':
        return this.compareValues(left, right) > 0;
      
      case '>=':
        return this.compareValues(left, right) >= 0;
      
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  private evaluateUnaryOperation(node: { operator: string; operand: ASTNode }): number | string | boolean | null | Cell[] {
    const operand = this.evaluateNode(node.operand);
    
    if (typeof operand === 'string' && operand.startsWith('#') && operand.endsWith('!')) {
      return operand;
    }
    
    switch (node.operator) {
      case '+':
        return +this.toNumber(operand);
      
      case '-':
        return -this.toNumber(operand);
      
      default:
        throw new Error(`Unknown unary operator: ${node.operator}`);
    }
  }

  private evaluateFunctionCall(node: { name: string; arguments: ASTNode[] }): number | string | boolean | null | Cell[] {
    const func = builtinFunctions[node.name.toUpperCase()];
    
    if (!func) {
      return `#NAME?`;
    }
    
    if (node.arguments.length < func.minArgs || node.arguments.length > func.maxArgs) {
      return `#N/A`;
    }
    
    const evaluatedArgs = node.arguments.map(arg => this.evaluateNode(arg));
    
    try {
      return func.execute(evaluatedArgs, this.cells);
    } catch (error) {
      return `#ERROR!`;
    }
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }

  private compareValues(a: unknown, b: unknown): number {
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
    if (b === null || b === undefined) return 1;
    
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    
    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return a === b ? 0 : (a ? 1 : -1);
    }
    
    const strA = String(a).toLowerCase();
    const strB = String(b).toLowerCase();
    
    if (strA < strB) return -1;
    if (strA > strB) return 1;
    return 0;
  }
}
