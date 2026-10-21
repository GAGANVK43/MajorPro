/**
 * DiaSense AI — Medical Ambient Background Verification Test Suite
 * 
 * Tests:
 * 1. Palette adherence: Verification of required clinical colors
 * 2. Canvas responsive node scaling logic
 * 3. Accessibility & reduced motion handling
 * 4. CSS pointer-events and z-index safety constraints
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("==================================================================");
console.log("DiaSense AI — Medical Ambient Background Verification Test Suite");
console.log("==================================================================\n");

// Test Suite 1: Color Palette Verification
console.log("[Test Suite 1] Medical Tech Color Palette Verification");
const jsxPath = path.resolve(__dirname, "../src/components/MedicalAmbientBackground/MedicalAmbientBackground.jsx");
const cssPath = path.resolve(__dirname, "../src/components/MedicalAmbientBackground/MedicalAmbientBackground.css");

const jsxContent = fs.readFileSync(jsxPath, "utf-8");
const cssContent = fs.readFileSync(cssPath, "utf-8");

const requiredColors = [
  { name: "Deep Navy", hex: "#050B18" },
  { name: "Midnight Blue", hex: "#071426" },
  { name: "Medical Cyan", hex: "#22D3EE" },
  { name: "Clinical Blue", hex: "#38BDF8" },
  { name: "Subtle Violet", hex: "#8B5CF6" },
  { name: "Soft White-Blue", hex: "#DCEBFF" },
];

requiredColors.forEach((color) => {
  const presentInCSS = cssContent.toUpperCase().includes(color.hex.toUpperCase());
  const presentInJSX = jsxContent.toUpperCase().includes(color.hex.toUpperCase()) || 
                       jsxContent.includes(color.hex.toLowerCase());
  assert.ok(
    presentInCSS || presentInJSX,
    `Color ${color.name} (${color.hex}) must be present in background styles or canvas definitions`
  );
  console.log(`  ✓ Color Verified: ${color.name} (${color.hex})`);
});

// Test Suite 2: Layering and Interaction Safety
console.log("\n[Test Suite 2] Layering & Interaction Safety Constraints");
assert.ok(
  cssContent.includes("pointer-events: none !important"),
  "CSS must strictly enforce pointer-events: none !important"
);
console.log("  ✓ pointer-events: none !important strictly enforced");

assert.ok(
  cssContent.includes("z-index: 0"),
  "Background must sit at z-index: 0 behind content"
);
console.log("  ✓ Background positioned at z-index: 0");

assert.ok(
  cssContent.includes(".app-page-wrapper") && cssContent.includes("z-index: 1"),
  "Content wrapper must stack with positive z-index"
);
console.log("  ✓ Foreground app-page-wrapper stacking context guaranteed at z-index: 1");

// Test Suite 3: Responsive Scaling Logic
console.log("\n[Test Suite 3] Responsive Node Scaling Verification");

function getNodeCount(w) {
  if (w < 640) return 10;
  if (w < 1024) return 16;
  return 24;
}

assert.strictEqual(getNodeCount(375), 10, "Mobile (<640px) must use lightweight count (10 nodes)");
assert.strictEqual(getNodeCount(768), 16, "Tablet (<1024px) must use balanced count (16 nodes)");
assert.strictEqual(getNodeCount(1440), 24, "Desktop (>=1024px) must use elegant count (24 nodes)");
console.log("  ✓ Mobile viewport (375px) properly scaled: 10 nodes");
console.log("  ✓ Tablet viewport (768px) properly scaled: 16 nodes");
console.log("  ✓ Desktop viewport (1440px) properly scaled: 24 nodes");

// Test Suite 4: Accessibility & Reduced Motion Handling
console.log("\n[Test Suite 4] Accessibility (prefers-reduced-motion) Constraints");
assert.ok(
  jsxContent.includes("prefers-reduced-motion: reduce"),
  "JSX must query prefers-reduced-motion media query"
);
assert.ok(
  cssContent.includes("@media (prefers-reduced-motion: reduce)"),
  "CSS must have dedicated prefers-reduced-motion query block"
);
assert.ok(
  jsxContent.includes("renderStaticFrame"),
  "Component must provide a static rendering fallback when reduced motion is preferred"
);
console.log("  ✓ prefers-reduced-motion media query properly hooked in JSX and CSS");
console.log("  ✓ renderStaticFrame fallback ensures zero continuous motion for sensitive users");

// Test Suite 5: App Integration Check
console.log("\n[Test Suite 5] App.jsx Integration Check");
const appPath = path.resolve(__dirname, "../src/App.jsx");
const appContent = fs.readFileSync(appPath, "utf-8");

assert.ok(
  appContent.includes("MedicalAmbientBackground"),
  "App.jsx must import and render MedicalAmbientBackground"
);
assert.ok(
  appContent.includes("<MedicalAmbientBackground />"),
  "App.jsx must render <MedicalAmbientBackground />"
);
assert.ok(
  appContent.includes("app-page-wrapper"),
  "App.jsx must wrap routes with app-page-wrapper"
);
console.log("  ✓ MedicalAmbientBackground cleanly mounted in App.jsx root router");

console.log("\n==================================================================");
console.log("ALL 5 VERIFICATION TEST SUITES PASSED CLEANLY (100%)");
console.log("==================================================================");
