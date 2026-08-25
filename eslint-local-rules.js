/**
 * Local rule registry for eslint-plugin-local-rules.
 *
 * Rule implementations live in .eslintrc-rules/ (doc 05 §1 enforcement).
 * This file just re-exports them in the flat {ruleName: ruleDef} shape
 * eslint-plugin-local-rules expects, so .eslintrc.json can reference them
 * as "local-rules/<rule-name>".
 */
'use strict';

module.exports = {
  'no-literal-ui-text': require('./.eslintrc-rules/no-literal-ui-text.js'),
};
