import type { Token } from './lexer';
import type { ASTNode, CellReferenceNode, CellRangeNode, BinaryOperationNode, FunctionCallNode } from './ast';

export class Parser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode {
    const result = this.parseExpression();
    this.expect('EOF');
    return result;
  }

  private current(): Token {
    return this.tokens[this.position];
  }

  private peek(offset: number = 0): Token {
    return this.tokens[this.position + offset] || this.tokens[this.tokens.length - 1];
  }

  private expect(type: string, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` "${value}"` : ''}, got ${token.type} "${token.value}" at position ${token.position}`);
    }
    this.position++;
    return token;
  }

  private parseExpression(): ASTNode {
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    let left = this.parseConcatenation();
    
    while (['=', '<>', '<', '<=', '>', '>='].includes(this.current().value)) {
      const operator = this.expect('Operator').value as BinaryOperationNode['operator'];
      const right = this.parseConcatenation();
      left = {
        type: 'BinaryOperation',
        operator,
        left,
        right
      };
    }
    
    return left;
  }

  private parseConcatenation(): ASTNode {
    let left = this.parseAdditive();
    
    while (this.current().value === '&') {
      const operator = this.expect('Operator').value as '&';
      const right = this.parseAdditive();
      left = {
        type: 'BinaryOperation',
        operator,
        left,
        right
      };
    }
    
    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    
    while (['+', '-'].includes(this.current().value)) {
      const operator = this.expect('Operator').value as '+' | '-';
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryOperation',
        operator,
        left,
        right
      };
    }
    
    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseExponentiation();
    
    while (['*', '/'].includes(this.current().value)) {
      const operator = this.expect('Operator').value as '*' | '/';
      const right = this.parseExponentiation();
      left = {
        type: 'BinaryOperation',
        operator,
        left,
        right
      };
    }
    
    return left;
  }

  private parseExponentiation(): ASTNode {
    let left = this.parseUnary();
    
    while (this.current().value === '^') {
      const operator = this.expect('Operator').value as '^';
      const right = this.parseUnary();
      left = {
        type: 'BinaryOperation',
        operator,
        left,
        right
      };
    }
    
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.current().value === '+' || this.current().value === '-') {
      const operator = this.expect('Operator').value as '+' | '-';
      const operand = this.parseUnary();
      return {
        type: 'UnaryOperation',
        operator,
        operand
      };
    }
    
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.current();
    
    if (token.type === 'Number') {
      this.position++;
      return {
        type: 'Number',
        value: parseFloat(token.value)
      };
    }
    
    if (token.type === 'String') {
      this.position++;
      return {
        type: 'String',
        value: token.value
      };
    }
    
    if (token.type === 'Identifier') {
      if (this.peek(1).type === 'LeftParen') {
        return this.parseFunctionCall();
      }
      
      if (token.value === 'TRUE') {
        this.position++;
        return { type: 'Boolean', value: true };
      }
      if (token.value === 'FALSE') {
        this.position++;
        return { type: 'Boolean', value: false };
      }
      
      throw new Error(`Unknown identifier: ${token.value}`);
    }
    
    if (token.type === 'CellReference') {
      return this.parseCellReferenceOrRange();
    }
    
    if (token.type === 'LeftParen') {
      this.expect('LeftParen');
      const expression = this.parseExpression();
      this.expect('RightParen');
      return {
        type: 'ParenthesizedExpression',
        expression
      };
    }
    
    throw new Error(`Unexpected token: ${token.type} "${token.value}" at position ${token.position}`);
  }

  private parseCellReferenceOrRange(): ASTNode {
    const startRef = this.parseCellReference();
    
    if (this.current().type === 'Colon') {
      this.expect('Colon');
      const endRef = this.parseCellReference();
      return {
        type: 'CellRange',
        start: startRef,
        end: endRef
      } as CellRangeNode;
    }
    
    return startRef;
  }

  private parseCellReference(): CellReferenceNode {
    const token = this.expect('CellReference');
    const value = token.value;
    
    let columnAbsolute = false;
    let rowAbsolute = false;
    let columnPart = '';
    let rowPart = '';
    let i = 0;
    
    if (value[i] === '$') {
      columnAbsolute = true;
      i++;
    }
    
    while (i < value.length && /[A-Z]/.test(value[i])) {
      columnPart += value[i];
      i++;
    }
    
    if (value[i] === '$') {
      rowAbsolute = true;
      i++;
    }
    
    while (i < value.length && /[0-9]/.test(value[i])) {
      rowPart += value[i];
      i++;
    }
    
    return {
      type: 'CellReference',
      column: columnPart,
      row: parseInt(rowPart, 10),
      columnAbsolute,
      rowAbsolute
    };
  }

  private parseFunctionCall(): FunctionCallNode {
    const name = this.expect('Identifier').value;
    this.expect('LeftParen');
    
    const args: ASTNode[] = [];
    
    if (this.current().type !== 'RightParen') {
      args.push(this.parseExpression());
      
      while (this.current().type === 'Comma') {
        this.expect('Comma');
        args.push(this.parseExpression());
      }
    }
    
    this.expect('RightParen');
    
    return {
      type: 'FunctionCall',
      name,
      arguments: args
    };
  }
}
