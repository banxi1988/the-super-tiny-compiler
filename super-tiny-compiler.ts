"use strict";

/**
 * We're gonna start off with our first phase of parsing, lexical analysis,
 * with the tokenizer.
 *
 * We're just going to take our string of code and break it down into an array
 * of tokens.
 *
 */

export enum TokenType {
  paren,
  number,
  string,
  name
}

export class Token {
  constructor(readonly type: TokenType, readonly value: string) {}
}

/*
 * 
 * We start by accepting an input string of code,
 * and we're gonna set up two things. 
 *  
 * @param input source code 
 */
export function tokenizer(input: string): Array<Token> {
  // A `current` variable for tacking our position in the code like a cursor.
  let current = 0;
  const tokens = new Array<Token>();
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

  // But this time we're going to use recursion instead of a `while` loop.
  // So we define a `walk` function.
  function walk(): ASTNode {
    // Inside the walk function we start by grabbing the `current` token.
    let token = tokens[current];

    // We're going to split each type of token off into a different code path,
    // starting off with `number` tokens.
    //
    // We test to see if we  have a `number` token.
    if (token.type === TokenType.number) {
      // If we have one, we'll increment `current`
      current++;
      // And we'll return a new AST node called `NumberLiteral` and setting its
      // value to the value of our token
      return new NumberLiteral(token.value);
    }

    // If we have a string we will do the same as number and create a `StringLiteral` node.
    if (token.type === TokenType.string) {
      current++;
      return new StringLiteral(token.value);
    }

    // Next we're going to look for CallExpressions. We start this off when we
    // encounter an open parenthesis.
    if (token.type === TokenType.paren && token.value === "(") {
      // We'll increment `current` to skip the parenthesis since we don't care
      // about it in our AST.
      token = tokens[++current];

      // We create a base node with the type `CallExpression`, and we're going
      // to set the name as current token's value since the next token after
      // the open parenthesis is the name of the function.
      const node = new CallExpression(token.value, []);

      // We increment `current` *again* to skip the name token
      token = tokens[++current];

      // And now we want to loop through each token that will the `param` of
      // our `CallExpression` until we encounter a closing parenthesis.
      //
      // Now this is where recursion comes in. Instread of trying to parse a
      // potentially infinitely nested set of nodes we're going to rely on
      // recursion to resolve things.
      //
      // To explain this, let's take our Lisp code. You can see that the
      // parameters of the `add` are a number and a nested `CallExpression` that
      // includes  its own numbers.
      //
      //     (add 2 (subtract 4 2 ))
      //
      // We're going to rely on the nested `walk` function to increment our
      // `current` variable past any nested `CallExpression`.

      // So we create a `while` loop that will continue until it encounters a
      // token with a `type` of `'paren'` and a `value` of a closing parenthesis.

      while (
        token.type !== TokenType.paren ||
        (token.type === TokenType.paren && token.value !== ")")
      ) {
        // we'll call the `walk` function which will return a `node`
        // and we'll push it into our `node.params`.
        node.params.push(walk());
        token = tokens[current];
      }

      // Finally we will increment `current` one last time to skip the
      // closing parenthesis.
      current++;

      // And return the node.
      return node;
    }

    // Again, if we haven't recognized the token type by now we're going to
    // throw an error.
    throw new TypeError(token.type.toString());
  }

  // Now, we're going to create our AST which will have a root which is a
  // `Program` node.

  let ast = new ProgramNode([]);

  // And we're going to kickstart our `walk` function, pushing nodes to our
  // `ast.body` array.
  //
  // The reason we are doing this inside a loop is because our program can have
  // `CallExpression` after one another instead of being nested.
  //
  // (add 2 2)
  // (subtract 4 2)
  while (current < tokens.length) {
    ast.body.push(walk());
  }

  // At the end of our parser we'll return the AST.
  return ast;
}

/**
 * ============================================================================
 *                                 ⌒(❀>◞౪◟<❀)⌒
 *                               THE TRAVERSER!!!
 * ============================================================================
 */

/**
 * So now we have our AST, and we want to be able to visit different nodes with
 * a visitor. We need to be able to call the methods on the visitor whenever we
 * encounter a node with a matching type.
 *
 *
 * traverse(ast, {
 *     Program: {
 *         enter(node, parent) {
 *             // ...
 *         },
 *         exit(node, parent) {
 *             // ...
 *         },
 *     },
 *     CallExpression: {
 *         enter(node, parent) {
 *             // ...
 *         },
 *         exit(node, parent) {
 *             // ...
 *         },
 *     }
 *     NumberLiteral: {
 *         enter(node, parent) {
 *             // ...
 *         },
 *         exit(node, parent) {
 *             // ...
 *         },
 *     }
 * })
 */

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...

export function traverser(ast: ProgramNode, visitor: any) {
  // A `traverseArray` function that will allow us to iterate over an array and
  // call the next function that we will define: `traverseNode`.
  function traverseArray(nodes: Array<ASTNode>, parent: ASTNode) {
    for (const node of nodes) {
      traverseNode(node, parent);
    }
  }

  // `traverseNode` will accept a `node` and its `parent` node. So that it
  // can pass both to our visitor methods.
  function traverseNode(node: ASTNode, parent: ASTNode | null) {
    // We start by testing for the existence of a method on the visitor with a
    // matching `type`.
    let methods = visitor[node.type];

    // If there is an `enter` method for this node type we'll call it with the
    // `node` and its `parent`
    if (methods && methods.enter) {
      methods.enter(node, parent);
    }

    // Next we are going to split things up by the current node type.
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

    // If there is an `exit` method for this node type we'll call it with the
    // `node` and its `parent`.
    if (methods && methods.exit) {
      methods.exit(node, parent);
    }
  }

  // Finally we kickstart the traverser by calling` traverseNode` with our ast
  // with no `parent` because the top level of the AST doesn't have a parent.
  traverseNode(ast, null);
}

/**
 * ============================================================================
 *                                   ⁽(◍˃̵͈̑ᴗ˂̵͈̑)⁽
 *                              THE TRANSFORMER!!!
 * ============================================================================
 */

/**
 * Next up, the transformer. Our transformer is going to take the AST that we
 * have built and pass it to our traverser function with a visitor and will
 * create a new ast.
 *
 * ----------------------------------------------------------------------------
 *   Original AST                     |   Transformed AST
 * ----------------------------------------------------------------------------
 *   {                                |   {
 *     type: 'Program',               |     type: 'Program',
 *     body: [{                       |     body: [{
 *       type: 'CallExpression',      |       type: 'ExpressionStatement',
 *       name: 'add',                 |       expression: {
 *       params: [{                   |         type: 'CallExpression',
 *         type: 'NumberLiteral',     |         callee: {
 *         value: '2'                 |           type: 'Identifier',
 *       }, {                         |           name: 'add'
 *         type: 'CallExpression',    |         },
 *         name: 'subtract',          |         arguments: [{
 *         params: [{                 |           type: 'NumberLiteral',
 *           type: 'NumberLiteral',   |           value: '2'
 *           value: '4'               |         }, {
 *         }, {                       |           type: 'CallExpression',
 *           type: 'NumberLiteral',   |           callee: {
 *           value: '2'               |             type: 'Identifier',
 *         }]                         |             name: 'subtract'
 *       }]                           |           },
 *     }]                             |           arguments: [{
 *   }                                |             type: 'NumberLiteral',
 *                                    |             value: '4'
 * ---------------------------------- |           }, {
 *                                    |             type: 'NumberLiteral',
 *                                    |             value: '2'
 *                                    |           }]
 *  (sorry the other one is longer.)  |         }
 *                                    |       }
 *                                    |     }]
 *                                    |   }
 * ----------------------------------------------------------------------------
 */

// So we have our transformer function which will accept the lisp ast.
export function transformer(ast: ProgramNode) {
  // We'll create a `newAst` which  like our previous AST will have a Program
  // node.
  const newAst = new ProgramNode([]);

  // Next I'm going to sheat a little and create a bit of a hack. We're going to
  // use a property named `context` on our parent nodes that we're going to push
  // nodes to their parent's `context`. Normally you would have a better
  // abstraction than this, but for our purposes this keeps things simple.
  //
  // Just take note that the context is a reference *from* the old ast *to*
  // the new ast.
  ast._context = newAst.body;

  // We'll start by calling the traverser function with our ast and a visitor.
  traverser(ast, {
    // The first visitor methods accepts any `NumberLiteral`
    [ASTNodeType.NumberLiteral]: {
      enter(node: NumberLiteral, parent: ASTNode) {
        // We'll create a new node also named `NumberLiteral` that we
        // will push to the parent context
        parent._context.push(new NumberLiteral(node.value));
      }
    },

    // Next we have `StringLiteral`
    [ASTNodeType.StringLiteral]: {
      enter(node: StringLiteral, parent: ASTNode) {
        parent._context.push(new StringLiteral(node.value));
      }
    },
    // Next up ,`CallExpression`.
    [ASTNodeType.CallExpression]: {
      enter(node: CallExpression, parent: ASTNode) {
        // We start creating a new node `CallExpression` with a nested
        // `Identifier`
        const expression = new JsCallExpression(new Identifier(node.name), []);

        // Next we're going to define a new context on the original
        // `CallExpression` node that will reference the `expression`'s
        // arguments so that we can push arguments
        node._context = expression.args;

        // Then we're going to check if the parent node is a `CallExpression`.
        // If it is not...
        if (parent.type !== ASTNodeType.CallExpression) {
          // We're going to wrap our `CallExpression` node with an
          // `ExpressionStatement`. We do this because the top level
          // `CallExpression` in JavaScript are actually statements.
          const es = new JsExpressionStatement(expression);
          parent._context.push(es);
        } else {
          // Last, we push our (possibly wrapped) `CallExpression` to the `parent`'s
          // `context`.
          parent._context.push(expression);
        }
      }
    }
  });

  // At the end of our transformer function we'll return the new ast that we just created.
  return newAst;
}

/**
 * ============================================================================
 *                               ヾ（〃＾∇＾）ﾉ♪
 *                            THE CODE GENERATOR!!!!
 * ============================================================================
 */

/**
 * Now let's move onto our last phase: The Code Generator.
 *
 * Our code generator is going to recursively call itself to print each node in
 * the tree into one giant string.
 */

export function codeGenerator(node: ASTNode) {
  // We'll break things down by the `type` of the `node`.
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
