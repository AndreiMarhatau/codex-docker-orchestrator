module.exports = {
  meta: {
    type: 'suggestion',
    schema: [{ type: 'integer' }],
    messages: {
      tooMany: 'Class has too many lines ({{count}}). Maximum allowed is {{max}}.'
    }
  },
  create(context) {
    const max = Number(context.options[0]) || 200;
    const checkNode = (node) => {
      if (!node.loc) return;
      const count = node.loc.end.line - node.loc.start.line + 1;
      if (count > max) {
        context.report({
          node,
          messageId: 'tooMany',
          data: { count, max }
        });
      }
    };
    return {
      ClassDeclaration: checkNode,
      ClassExpression: checkNode
    };
  }
};
