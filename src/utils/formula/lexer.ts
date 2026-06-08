export type TokenType =
  | 'Number'
  | 'String'
  | 'Identifier'
  | 'CellReference'
  | 'Operator'
  | 'LeftParen'
  | 'RightParen'
  | 'Comma'
  | 'Colon'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export class Lexer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input.startsWith('=') ? input.slice(1) : input;
  }

  tokenize(): Token[] {
    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];

      if (char === '"') {
        this.readString();
      } else if (this.isDigit(char)) {
        this.readNumber();
      } else if (this.isLetter(char) || char === '_') {
        this.readIdentifierOrCell();
      } else if (this.isOperator(char)) {
        this.readOperator();
      } else if (char === '(') {
        this.tokens.push({ type: 'LeftParen', value: '(', position: this.position });
        this.position++;
      } else if (char === ')') {
        this.tokens.push({ type: 'RightParen', value: ')', position: this.position });
        this.position++;
      } else if (char === ',') {
        this.tokens.push({ type: 'Comma', value: ',', position: this.position });
        this.position++;
      } else if (char === ':') {
        this.tokens.push({ type: 'Colon', value: ':', position: this.position });
        this.position++;
      } else {
        throw new Error(`Unexpected character: ${char} at position ${this.position}`);
      }
    }

    this.tokens.push({ type: 'EOF', value: '', position: this.position });
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isLetter(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isOperator(char: string): boolean {
    return ['+', '-', '*', '/', '^', '=', '<', '>', '&'].includes(char);
  }

  private readString(): void {
    const startPos = this.position;
    this.position++;
    let value = '';

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (char === '"') {
        if (this.position + 1 < this.input.length && this.input[this.position + 1] === '"') {
          value += '"';
          this.position += 2;
        } else {
          this.position++;
          break;
        }
      } else {
        value += char;
        this.position++;
      }
    }

    this.tokens.push({ type: 'String', value, position: startPos });
  }

  private readNumber(): void {
    const startPos = this.position;
    let value = '';
    let hasDecimal = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (this.isDigit(char)) {
        value += char;
        this.position++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        value += char;
        this.position++;
      } else {
        break;
      }
    }

    this.tokens.push({ type: 'Number', value, position: startPos });
  }

  private readIdentifierOrCell(): void {
    const startPos = this.position;
    let value = '';
    let columnPart = '';
    let rowPart = '';
    let columnAbsolute = false;
    let rowAbsolute = false;
    let parsingColumn = true;

    if (this.input[this.position] === '$') {
      columnAbsolute = true;
      this.position++;
    }

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      if (parsingColumn && this.isLetter(char)) {
        columnPart += char.toUpperCase();
        value += char;
        this.position++;
      } else if (parsingColumn && char === '$' && columnPart.length > 0) {
        rowAbsolute = true;
        value += char;
        this.position++;
        parsingColumn = false;
      } else if (parsingColumn && this.isDigit(char) && columnPart.length > 0) {
        rowPart += char;
        value += char;
        parsingColumn = false;
        this.position++;
      } else if (!parsingColumn && this.isDigit(char)) {
        rowPart += char;
        value += char;
        this.position++;
      } else if (this.isLetter(char) || this.isDigit(char) || char === '_') {
        value += char;
        this.position++;
        if (columnPart.length > 0 && rowPart.length === 0) {
          parsingColumn = false;
        }
      } else {
        break;
      }
    }

    const columnIndex = this.columnLetterToIndex(columnPart);
    const rowNum = parseInt(rowPart, 10);

    if (columnPart.length > 0 && 
        rowPart.length > 0 && 
        columnIndex >= 0 && columnIndex < 26 &&
        rowNum >= 1 && rowNum <= 10000 &&
        value.length === columnPart.length + rowPart.length + (columnAbsolute ? 1 : 0) + (rowAbsolute ? 1 : 0)) {
      const cellRef = (columnAbsolute ? '$' : '') + columnPart + (rowAbsolute ? '$' : '') + rowPart;
      this.tokens.push({ type: 'CellReference', value: cellRef, position: startPos });
    } else {
      this.tokens.push({ type: 'Identifier', value: value.toUpperCase(), position: startPos });
    }
  }

  private columnLetterToIndex(letters: string): number {
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return index - 1;
  }

  private readOperator(): void {
    const startPos = this.position;
    const char = this.input[this.position];
    const nextChar = this.input[this.position + 1];

    if ((char === '<' && nextChar === '>') || 
        (char === '<' && nextChar === '=') || 
        (char === '>' && nextChar === '=')) {
      this.tokens.push({ type: 'Operator', value: char + nextChar, position: startPos });
      this.position += 2;
    } else {
      this.tokens.push({ type: 'Operator', value: char, position: startPos });
      this.position++;
    }
  }
}
