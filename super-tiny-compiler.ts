export enum TokenType {
  paren,
  number,
  string,
  name
}

export class Token {
  constructor(readonly type: TokenType, readonly value: string) {}
}

export function tokenizer(input: string): Token[] {
  // A `current` variable for tacking our position in the code like a cursor.
  let current = 0;
  const tokens: Token[] = [];
  const re = {
    WHITESPACE: /\s/,
    NUMBERS: /[0-9]/,
    LETTERS: /[a-z]/i
  };
  while (current < input.length) {
    let char = input[current];
    if (char === "(" || char === ")") {
      tokens.push({ type: TokenType.paren, value: char });
      current++;
      continue;
    }
    if (re.WHITESPACE.test(char)) {
      current++;
      continue;
    }

    if (re.NUMBERS.test(char)) {
      let value = "";
      while (re.NUMBERS.test(char)) {
        value += char;
        char = input[++current];
      }
      tokens.push({ type: TokenType.number, value });
      continue;
    }

    if (char === '"') {
      let value = "";
      // We'll skip the opening double quote in our token.
      char = input[++current];
      while (char !== '"') {
        value += char;
        char = input[++current];
      }
      // Skip the closing double quote.
      tokens.push({ type: TokenType.string, value });
      continue;
    }

    if (re.LETTERS.test(char)) {
      let value = "";
      while (re.LETTERS.test(char)) {
        value += char;
        char = input[++current];
      }
      tokens.push({ type: TokenType.name, value });
      continue;
    }

    throw new TypeError("I dont know what this char is: " + char);
  }

  return tokens;
}

export enum ASTNodeType {
  NumberLiteral,
  StringLiteral,
  CallExpression,
  Program,
  ExpressionStatement, // for js
  Identifier // for js
}

export abstract class ASTNode {
  // will be a reference *from* the old ast *to* the new ast.
  _context: any;
  constructor(readonly type: ASTNodeType) {}

  generateJsCode(): string {
    throw Error("NotImplemented");
  }

  visit(parent: ASTNode) {}
}

export class NumberLiteral extends ASTNode {
  constructor(readonly value: string) {
    super(ASTNodeType.NumberLiteral);
  }

  generateJsCode() {
    return this.value;
  }
}

export class StringLiteral extends ASTNode {
  constructor(readonly value: string) {
    super(ASTNodeType.StringLiteral);
  }
  generateJsCode() {
    return `"${this.value}"`;
  }
}

export class CallExpression extends ASTNode {
  constructor(readonly name: string, readonly params: Array<ASTNode>) {
    super(ASTNodeType.CallExpression);
  }
}

export class ProgramNode extends ASTNode {
  constructor(readonly body: Array<ASTNode>) {
    super(ASTNodeType.Program);
  }

  generateJsCode() {
    return this.body.map(it => it.generateJsCode()).join("\n");
  }
}

export class Identifier extends ASTNode {
  constructor(readonly name: string) {
    super(ASTNodeType.Identifier);
  }

  generateJsCode() {
    return this.name;
  }
}

export class JsExpressionStatement extends ASTNode {
  constructor(readonly expression: ASTNode) {
    super(ASTNodeType.ExpressionStatement);
  }

  generateJsCode() {
    return this.expression.generateJsCode() + ";";
  }
}

export class JsCallExpression extends ASTNode {
  constructor(readonly callee: Identifier, readonly args: ASTNode[]) {
    super(ASTNodeType.CallExpression);
  }

  generateJsCode() {
    return (
      this.callee.generateJsCode() +
      "(" +
      this.args.map(it => it.generateJsCode()).join(", ") +
      ")"
    );
  }
}

/**
 * For our parser we're going to take our array of tokens and turn it into an AST
 */
export function parser(tokens: Array<Token>): ProgramNode {
  let current = 0;

  function walk(): ASTNode {
    let token = tokens[current];
    if (token.type === TokenType.number) {
      current++;
      return new NumberLiteral(token.value);
    }

    if (token.type === TokenType.string) {
      current++;
      return new StringLiteral(token.value);
    }
    if (token.type === TokenType.paren && token.value === "(") {
      token = tokens[++current];
      const node = new CallExpression(token.value, []);
      token = tokens[++current];
      while (
        token.type !== TokenType.paren ||
        (token.type === TokenType.paren && token.value !== ")")
      ) {
        node.params.push(walk());
        token = tokens[current];
      }

      current++;
      return node;
    }
    throw new TypeError(token.type.toString());
  }

  let ast = new ProgramNode([]);

  while (current < tokens.length) {
    ast.body.push(walk());
  }
  return ast;
}

export function traverser(ast: ProgramNode, visitor: any) {
  function traverseArray(nodes: Array<ASTNode>, parent: ASTNode) {
    for (const node of nodes) {
      traverseNode(node, parent);
    }
  }
  function traverseNode(node: ASTNode, parent: ASTNode | null) {
    let methods = visitor[node.type];
    if (methods && methods.enter) {
      methods.enter(node, parent);
    }
    switch (node.type) {
      case ASTNodeType.Program:
        const programNode = node as ProgramNode;
        traverseArray(programNode.body, node);
        break;
      case ASTNodeType.CallExpression:
        const callNode = node as CallExpression;
        traverseArray(callNode.params, node);
        break;
      case ASTNodeType.NumberLiteral:
      case ASTNodeType.StringLiteral:
        break;
    }

    if (methods && methods.exit) {
      methods.exit(node, parent);
    }
  }

  traverseNode(ast, null);
}

export function transformer(ast: ProgramNode) {
  const newAst = new ProgramNode([]);
  ast._context = newAst.body;
  traverser(ast, {
    [ASTNodeType.NumberLiteral]: {
      enter(node: NumberLiteral, parent: ASTNode) {
        parent._context.push(new NumberLiteral(node.value));
      }
    },

    [ASTNodeType.StringLiteral]: {
      enter(node: StringLiteral, parent: ASTNode) {
        parent._context.push(new StringLiteral(node.value));
      }
    },
    [ASTNodeType.CallExpression]: {
      enter(node: CallExpression, parent: ASTNode) {
        const expression = new JsCallExpression(new Identifier(node.name), []);
        node._context = expression.args;
        if (parent.type !== ASTNodeType.CallExpression) {
          const es = new JsExpressionStatement(expression);
          parent._context.push(es);
        } else {
          parent._context.push(expression);
        }
      }
    }
  });

  return newAst;
}

export function codeGenerator(node: ASTNode) {
  return node.generateJsCode();
}

export function compiler(input: string) {
  const tokens = tokenizer(input);
  const ast = parser(tokens);
  const newAst = transformer(ast);
  const output = codeGenerator(newAst);

  // and simply return the output
  return output;
}

export default compiler;
