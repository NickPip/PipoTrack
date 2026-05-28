// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) with
// vitest's expect. Safe to load for node-env tests too — it only extends expect.
import "@testing-library/jest-dom/vitest";
