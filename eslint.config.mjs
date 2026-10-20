import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default ts.config(
 {ignores:['.next/**','node_modules/**','next-env.d.ts','deliverables/**']},
 js.configs.recommended,
 ...ts.configs.recommended,
 {languageOptions:{globals:{...globals.node,...globals.browser}},rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'no-unused-vars':'off','@typescript-eslint/no-require-imports':'off'}}
);
