export type ASTNodeType = 
  | 'Number'
  | 'String'
  | 'Boolean'
  | 'CellReference'
  | 'CellRange'
  | 'BinaryOperation'
  | 'UnaryOperation'
  | 'FunctionCall'
  | 'ParenthesizedExpression';

export interface BaseASTNode {
  type: ASTNodeType;
}

export interface NumberNode extends BaseASTNode {
  type: 'Number';
  value: number;
}

export interface StringNode extends BaseASTNode {
  type: 'String';
  value: string;
}

export interface BooleanNode extends BaseASTNode {
  type: 'Boolean';
  value: boolean;
}

export interface CellReferenceNode extends BaseASTNode {
  type: 'CellReference';
  column: string;
  row: number;
  columnAbsolute: boolean;
  rowAbsolute: boolean;
  sheetId?: string;
}

export interface CellRangeNode extends BaseASTNode {
  type: 'CellRange';
  start: CellReferenceNode;
  end: CellReferenceNode;
}

export interface BinaryOperationNode extends BaseASTNode {
  type: 'BinaryOperation';
  operator: '+' | '-' | '*' | '/' | '^' | '=' | '<>' | '<' | '<=' | '>' | '>=' | '&';
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOperationNode extends BaseASTNode {
  type: 'UnaryOperation';
  operator: '-' | '+';
  operand: ASTNode;
}

export interface FunctionCallNode extends BaseASTNode {
  type: 'FunctionCall';
  name: string;
  arguments: ASTNode[];
}

export interface ParenthesizedExpressionNode extends BaseASTNode {
  type: 'ParenthesizedExpression';
  expression: ASTNode;
}

export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | CellReferenceNode
  | CellRangeNode
  | BinaryOperationNode
  | UnaryOperationNode
  | FunctionCallNode
  | ParenthesizedExpressionNode;
