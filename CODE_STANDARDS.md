# Open-Audit Code Standards

This document defines the non-negotiable coding standards for the Open-Audit project. All contributors must follow these rules. PRs that violate these standards will not be merged.

---

## 1. Function Syntax: Standard Declarations Only

**This is the most important rule in this document.**

All TypeScript functions — whether React components, utility functions, or helper methods — MUST use **standard function declarations**. Arrow functions are **forbidden** for top-level function definitions.

### Why?

- Standard declarations are hoisted, making code order more flexible.
- They are easier to read in stack traces (named functions show up clearly).
- They signal intent: a `function` keyword means "this is a reusable, named unit of logic."
- Consistency across the codebase reduces cognitive load for contributors.

### Examples

```typescript
// ✅ CORRECT — Standard function declaration
function MyComponent(props: Props) {
  return <div>{props.children}</div>;
}

// ✅ CORRECT — Standard function declaration for utilities
function translateEvent(event: RawEvent): string {
  return event.data;
}

// ✅ CORRECT — Standard function declaration for async functions
async function fetchContractEvents(contractId: string): Promise<RawEvent[]> {
  const response = await fetch(`/api/events/${contractId}`);
  return response.json();
}

// ✅ CORRECT — Arrow functions are allowed INSIDE function bodies as callbacks
function processEvents(events: RawEvent[]): TranslatedEvent[] {
  return events.map((event) => translateEvent(event)); // ← OK as a callback
}

// ❌ INCORRECT — Arrow function as a component definition
const MyComponent = (props: Props) => {
  return <div>{props.children}</div>;
};

// ❌ INCORRECT — Arrow function as a utility definition
const translateEvent = (event: RawEvent): string => {
  return event.data;
};

// ❌ INCORRECT — Arrow function as an async utility
const fetchContractEvents = async (contractId: string): Promise<RawEvent[]> => {
  const response = await fetch(`/api/events/${contractId}`);
  return response.json();
};
```

### ESLint Enforcement

This rule is enforced by ESLint via `"func-style": ["error", "declaration"]` in `.eslintrc.json`. The linter will fail your build if you use arrow functions for top-level definitions.

---

## 2. TypeScript: No `any` Types

Using `any` defeats the purpose of TypeScript. It is **forbidden**.

```typescript
// ❌ INCORRECT
function processData(data: any): any {
  return data;
}

// ✅ CORRECT — Use proper interfaces
function processData(data: RawEvent): TranslatedEvent {
  return translateEvent(data);
}

// ✅ CORRECT — Use generics when the type is truly unknown
function parseResponse<T>(response: unknown): T {
  return response as T;
}
```

ESLint enforces this via `"@typescript-eslint/no-explicit-any": "error"`.

---

## 3. Interfaces Over Type Aliases for Object Shapes

Use `interface` for object shapes. Use `type` for unions, intersections, and primitives.

```typescript
// ✅ CORRECT — interface for object shapes
interface RawEvent {
  id: string;
  contractId: string;
  topics: string[];
  data: string;
  ledger: number;
  timestamp: number;
}

// ✅ CORRECT — type for unions
type TranslationStatus = "translated" | "cryptic" | "pending";

// ❌ INCORRECT — type alias for an object shape
type RawEvent = {
  id: string;
  contractId: string;
};
```

---

## 4. Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| React Components | PascalCase | `EventFeedTable` |
| Functions | camelCase | `translateEvent` |
| Interfaces | PascalCase | `RawEvent` |
| Type aliases | PascalCase | `TranslationStatus` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_EVENTS_PER_PAGE` |
| Files (components) | PascalCase | `EventFeedTable.tsx` |
| Files (utilities) | kebab-case | `registry.ts` |

---

## 5. File Organization

- One component per file.
- Co-locate tests with the code they test: `registry.ts` → `registry.test.ts`.
- Keep files under 300 lines. If a file grows beyond that, split it.

---

## 6. Imports

- Use absolute imports via the `@/` alias (configured in `tsconfig.json`).
- Group imports: external libraries first, then internal modules, then types.
- No default exports from utility files — use named exports.

```typescript
// ✅ CORRECT import order
import { useState } from "react";
import { Table } from "@/components/ui/table";
import { translateEvent } from "@/lib/translator/registry";
import type { RawEvent } from "@/lib/translator/types";
```

---

## 7. Formatting

Run Prettier before every commit:

```bash
npm run format
```

Key settings (from `.prettierrc`):
- 2-space indentation
- Double quotes
- Trailing commas (ES5)
- 100-character line width

---

## Enforcement Summary

| Rule | Tool | Severity |
|---|---|---|
| Standard function declarations | ESLint `func-style` | Error |
| No `any` types | ESLint `@typescript-eslint/no-explicit-any` | Error |
| Formatting | Prettier | CI check |
| Type safety | TypeScript strict mode | Build failure |
