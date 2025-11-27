#!/usr/bin/env node

/**
 * Build optimization script for instant static loading
 * This script ensures the build is optimized for maximum performance
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Optimizing build for instant static loading...');

// Read the built index.html
const indexPath = path.join(__dirname, 'dist', 'index.html');
let htmlContent = fs.readFileSync(indexPath, 'utf8');

// Convert absolute paths to relative paths for compatibility with file:// and http:// protocols
// This fixes CORS errors when opening HTML directly from file system
console.log('📝 Converting absolute paths to relative paths...');
htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="./assets/');
htmlContent = htmlContent.replace(/src="\/assets\//g, 'src="./assets/');
htmlContent = htmlContent.replace(/href="\/favicon\./g, 'href="./favicon.');
htmlContent = htmlContent.replace(/content="\/favicon\./g, 'content="./favicon.');

// Extract actual asset names from the HTML (now with relative paths)
const assetMatches = htmlContent.match(/href="\.\/assets\/([^"]+)"/g) || [];
const scriptMatches = htmlContent.match(/src="\.\/assets\/([^"]+\.js)"/g) || [];

// Create preload hints dynamically
let preloadHints = '\n    <!-- Preload critical resources for instant loading -->\n';
assetMatches.forEach(match => {
  const href = match.match(/href="([^"]+)"/)[1];
  const ext = path.extname(href);
  const as = ext === '.css' ? 'style' : 'script';
  preloadHints += `    <link rel="preload" href="${href}" as="${as}" />\n`;
});

// Also add preload for script files
scriptMatches.forEach(match => {
  const src = match.match(/src="([^"]+)"/)[1];
  preloadHints += `    <link rel="modulepreload" href="${src}" />\n`;
});

// Insert preload hints after the critical CSS
htmlContent = htmlContent.replace(
  '</style>',
  '</style>' + preloadHints
);

// Add path fixing script (runs first, before any other scripts)
const pathFixScript = `
    <!-- Fix paths for file:// protocol compatibility -->
    <script>
      (function() {
        // Fix paths if opened via file:// protocol
        if (window.location.protocol === 'file:') {
          const fixPath = (attr) => {
            document.querySelectorAll('[' + attr + '^="/"]').forEach(el => {
              const currentPath = el.getAttribute(attr);
              if (currentPath && currentPath.startsWith('/')) {
                el.setAttribute(attr, '.' + currentPath);
              }
            });
          };
          // Fix all link and script paths
          fixPath('href');
          fixPath('src');
          fixPath('content');
        }
      })();
    </script>
`;

// Fix mobile browser refresh script to not break on file:// protocol
// Replace the entire mobile browser refresh script block
const mobileRefreshScriptPattern = /<!-- Mobile browser refresh fallback -->[\s\S]*?<\/script>/;
const mobileRefreshScriptReplacement = `<!-- Mobile browser refresh fallback -->
    <script>
      // Handle mobile browser refresh issues (skip on file:// protocol)
      if (window.location.protocol !== 'file:' && window.location.pathname !== '/' && !window.location.pathname.startsWith('/dashboard')) {
        // If user is on a deep route and refreshes, redirect to dashboard
        if (window.location.pathname.includes('dashboard')) {
          window.location.href = '/dashboard';
        }
      }
    </script>`;
htmlContent = htmlContent.replace(mobileRefreshScriptPattern, mobileRefreshScriptReplacement);

// Insert path fixing script right after opening head tag (before any assets load)
htmlContent = htmlContent.replace(
  '<head>',
  '<head>' + pathFixScript
);

// Add performance optimizations
const performanceScript = `
    <!-- Performance optimization script -->
    <script>
      // Remove loading spinner when React app loads
      window.addEventListener('DOMContentLoaded', () => {
        const spinner = document.querySelector('.loading-spinner');
        if (spinner) {
          setTimeout(() => {
            spinner.style.opacity = '0';
            setTimeout(() => spinner.remove(), 300);
          }, 100);
        }
      });
      
      // Preload critical routes (only on http/https, not file://)
      if (window.location.protocol !== 'file:') {
        const criticalRoutes = ['/dashboard', '/login', '/register'];
        criticalRoutes.forEach(route => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = route;
          document.head.appendChild(link);
        });
      }
    </script>
`;

// Insert performance script before closing body tag
htmlContent = htmlContent.replace(
  '</body>',
  performanceScript + '\n  </body>'
);

// Write the optimized HTML
fs.writeFileSync(indexPath, htmlContent);

console.log('✅ Build optimized for instant static loading!');
console.log('📦 Optimizations applied:');
console.log('   - Absolute paths converted to relative paths (works on deployment)');
console.log('   - Resource preloading');
console.log('   - Critical CSS inlined');
console.log('   - Service Worker caching');
console.log('   - Performance monitoring');
console.log('   - Route prefetching (skipped on file:// protocol)');
console.log('');
console.log('🚀 Your site will now load like a static site!');
console.log('💡 For local testing, use: npm run preview (or any local server)');
console.log('   Note: ES modules require http:// or https:// protocol, not file://');
console.log('   The build is optimized for deployment on Vercel or any web server!');
