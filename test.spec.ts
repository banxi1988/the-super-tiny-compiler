import { assert } from "chai";
import {
  TokenType,
  Token,
  tokenizer,
  parser,
  ProgramNode,
  ASTNodeType,
  CallExpression,
  NumberLiteral,
  JsExpressionStatement,
  Identifier,
  JsCallExpression,
  transformer,
  codeGenerator,
  compiler
} from "./super-tiny-compiler";

describe("测试 lisp 表达 式转 js 表达 式", () => {
  it("测试1", () => {
    const input = "(add 2 (subtract 4 2))";
    const expectedOutput = "add(2, subtract(4, 2));";
    const expectedTokens = [
      { type: TokenType.paren, value: "(" },
      { type: TokenType.name, value: "add" },
      { type: TokenType.number, value: "2" },
      { type: TokenType.paren, value: "(" },
      { type: TokenType.name, value: "subtract" },
      { type: TokenType.number, value: "4" },
      { type: TokenType.number, value: "2" },
      { type: TokenType.paren, value: ")" },
      { type: TokenType.paren, value: ")" }
    ];

    const actualTokens = tokenizer(input);

    assert.deepEqual(actualTokens, expectedTokens);

    const expectedAst: ProgramNode = new ProgramNode([
      new CallExpression("add", [
        new NumberLiteral("2"),
        new CallExpression("subtract", [
          new NumberLiteral("4"),
          new NumberLiteral("2")
        ])
      ])
    ]);
    const actualAst = parser(actualTokens);

    assert.deepEqual(
      actualAst,
      expectedAst,
      " Parser should turn `tokens` into `ast`"
    );

    const expectedNewAst = new ProgramNode([
      new JsExpressionStatement(
        new JsCallExpression(new Identifier("add"), [
          new NumberLiteral("2"),
          new JsCallExpression(new Identifier("subtract"), [
            new NumberLiteral("4"),
            new NumberLiteral("2")
          ])
        ])
      )
    ]);

    const actualNewAst = transformer(actualAst);
    assert.deepEqual(
      actualNewAst,
      expectedNewAst,
      "Transformer should turn `ast` into a `newAst` "
    );

    const actualOutput1 = codeGenerator(actualNewAst);
    assert.equal(
      actualOutput1,
      expectedOutput,
      "Code Generator should turn `newAst` into `output` string"
    );

    const actualOutput2 = compiler(input);
    assert.equal(
      actualOutput2,
      expectedOutput,
      "Compiler should turn `input` into `output`"
    );
  }).timeout(2000);
});
