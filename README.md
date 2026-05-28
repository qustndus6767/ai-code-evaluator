# ⚡ AI Code Pattern Evaluator

A raw, opinionated TypeScript/Next.js playground built to evaluate, stress-test, and benchmark LLM-generated code. 

Most AI tools spit out textbook, generic code filled with redundant boilerplate and unnecessary comments. This tool forces LLMs to generate high-efficiency, production-grade snippets wrapped in creative edge-case optimization, using a strict, customized **Eval-First** loop.

## 🎯 Why This Exists
When using Claude or Cursor aggressively in real-world production, blind copy-pasting breaks architecture. This playground acts as a quality gate to score generated code against strict pragmatism rules before it hits production.

## ✨ Core Features
* **Zero Textbook Code Allowed**: Evaluates logic on a pragmatism scale (real-world optimization vs. academic theory).
* **Comment-Free Auditing**: Enforces clean, expressive code structures with absolute zero fluff/comments.
* **Strict Prompt Constraints**: Tests LLM resilience under highly restrictive persona injection.
* **Score & Refactor Pipeline**: Returns exact logical fault metrics and an instant, battle-tested refactored code block.

## 🛠️ Tech Stack
* **Framework**: Next.js (App Router)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **Engine**: Anthropic Claude / OpenAI API Wrapper

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone [https://github.com/qustndus6767/ai-code-evaluator.git](https://github.com/qustndus6767/ai-code-evaluator.git)
cd ai-code-evaluator
npm install
