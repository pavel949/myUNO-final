/**
 * ESLint plugin wrapper for myUNO custom rules
 * Exposes custom rules defined in .eslintrc-rules/
 */
module.exports = {
  rules: {
    'no-literal-ui-text': require('./no-literal-ui-text.js'),
  },
};
