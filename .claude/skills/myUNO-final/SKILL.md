```markdown
# myUNO-final Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill documents the key development patterns and workflows for the `myUNO-final` TypeScript codebase. It covers file and code conventions, documentation workflows, and testing practices to help contributors maintain consistency and quality.

## Coding Conventions

### File Naming
- Use **snake_case** for all file names.
  - Example: `user_profile.ts`, `game_logic.test.ts`

### Imports
- Use **relative imports** for referencing modules.
  - Example:
    ```typescript
    import { calculate_score } from './score_utils';
    ```

### Exports
- Use **named exports** rather than default exports.
  - Example:
    ```typescript
    // In score_utils.ts
    export function calculate_score() { /* ... */ }

    // Usage
    import { calculate_score } from './score_utils';
    ```

### Commit Messages
- Freeform style, often descriptive.
- No enforced prefix, but documentation commits often start with `docs NN: <topic>`.

## Workflows

### Add New Architecture or Domain Documentation
**Trigger:** When you need to document a new architecture decision, domain model, or major system area.  
**Command:** `/new-doc-topic`

1. Create a new markdown file in the `docs/` directory.
   - Name it with a sequential number and descriptive name, e.g., `docs/01_architecture_decisions.md`.
2. Write detailed documentation for the chosen topic.
3. Commit the new file with a message starting with `docs NN: <topic>`.
   - Example commit message:  
     ```
     docs 03: user authentication domain model
     ```

### Update Existing Documentation and Register Open Questions
**Trigger:** When refining an existing documentation topic and/or tracking unresolved questions.  
**Command:** `/update-doc-and-questions`

1. Edit the relevant `docs/NN_<topic>.md` file to update or expand the documentation.
2. Edit `docs/open_questions.md` to add or update open questions related to the topic.
3. Commit both files together with a message referencing the topic and open questions.
   - Example commit message:  
     ```
     docs 02: update API design, add open question about pagination
     ```

## Testing Patterns

- **Test files** use the pattern `*.test.*` (e.g., `user_profile.test.ts`).
- The testing framework is **unknown** (not detected), but tests are colocated with source or in dedicated test files.
- Example test file:
  ```typescript
  // user_profile.test.ts
  import { get_user_profile } from './user_profile';

  describe('get_user_profile', () => {
    it('returns correct profile data', () => {
      // test implementation
    });
  });
  ```

## Commands

| Command                | Purpose                                                         |
|------------------------|-----------------------------------------------------------------|
| /new-doc-topic         | Start a new architecture/domain documentation file              |
| /update-doc-and-questions | Update existing documentation and register open questions     |
```
