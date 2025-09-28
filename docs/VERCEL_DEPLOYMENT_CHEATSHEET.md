# Vercel Deployment Cheat Sheet

Quick reference for deploying web applications to Vercel.

## 1. Essential Commands

### Installation & Login
```bash
# Install Vercel CLI
npm i -g vercel

# Login to your account
vercel login

# Logout
vercel logout
```

### Local Development
```bash
# Start local development server
vercel dev

# Build for production
npm run build
# or
vercel build

# Preview production build locally
npm run preview
# or
vercel build && vercel dev --prod
```

### Deployment
```bash
# Deploy current directory
vercel

# Deploy to production
vercel --prod

# Deploy with custom name
vercel --name my-project

# Deploy to specific scope
vercel --scope my-team
```

## 2. Configuration Files

### vercel.json for Vite Projects with Path Aliases

When deploying Vite projects that use path aliases (like `@/`, `@components/`, `@utils/`), you need specific configuration to ensure proper build process:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev -- --port $PORT",
  "framework": {
    "name": "vite"
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Why This Configuration Matters for Path Aliases

**Problem**: Without proper Vercel configuration, builds fail with "Could not load" errors for modules using path aliases.

**Solution**: The key configurations that fix path alias issues:

1. **Framework Declaration**:
   ```json
   "framework": { "name": "vite" }
   ```
   - Tells Vercel to use Vite-specific build optimizations
   - Ensures path aliases from `vite.config.js` are respected

2. **Static Build Builder**:
   ```json
   "builds": [{
     "src": "package.json",
     "use": "@vercel/static-build"
   }]
   ```
   - Uses Vercel's static build builder that properly handles Vite projects
   - Ensures all Vite configurations are applied during build

3. **Explicit Build Settings**:
   ```json
   "buildCommand": "npm run build",
   "outputDirectory": "dist"
   ```
   - Explicitly defines build command and output directory
   - Prevents Vercel from guessing build settings

### vercel.json (Minimal Template - for simple projects)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "cleanUrls": true
}
```

### vite.config.js for Vercel
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // or './' for subdirectory
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash', 'axios']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
```

### Required index.html Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My App</title>
    <meta name="description" content="App description">
    
    <!-- Preconnect for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    
    <!-- Critical CSS -->
    <style>
        body { margin: 0; font-family: system-ui, sans-serif; }
        .loading { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    </style>
</head>
<body>
    <div id="app">
        <!-- Loading state -->
        <div class="loading">Loading...</div>
    </div>
    
    <!-- Main app bundle -->
    <script type="module" src="/src/main.js"></script>
</body>
</html>
```

## 3. Environment Variables

### Common Vercel Environment Variables
```bash
# Build-time variables
NODE_ENV=production
VITE_API_URL=https://api.example.com

# Runtime variables (server-side only)
DATABASE_URL=postgres://...
API_SECRET_KEY=your-secret-key
```

### Setting Environment Variables

#### Via Dashboard
1. Go to Project → Settings → Environment Variables
2. Add variable name, value, and select environments
3. Click Add

#### Via CLI
```bash
# Add environment variable
vercel env add MY_VAR

# List all environment variables
vercel env ls

# Pull environment variables to .env
vercel env pull

# Remove environment variable
vercel env rm MY_VAR
```

#### Environment-specific Variables
```bash
# Production only
vercel env add API_KEY production

# Development, preview, and production
vercel env add DEBUG_MODE
# Then select: Development, Preview, Production
```

## 4. Deployment Checklist

### Pre-Deployment Checks
- [ ] ✅ All dependencies listed in `package.json`
- [ ] ✅ `index.html` exists in project root
- [ ] ✅ Build command works locally (`npm run build`)
- [ ] ✅ Static assets reference correct paths
- [ ] ✅ Environment variables configured in Vercel
- [ ] ✅ `.vercelignore` file exists (optional)
- [ ] ✅ No console errors in production build
- [ ] ✅ Responsive design tested

### Post-Deployment Verification
- [ ] ✅ Page loads without errors
- [ ] ✅ All routes work (SPA routing)
- [ ] ✅ Static assets loading correctly
- [ ] ✅ Forms and API calls working
- [ ] ✅ Mobile responsiveness verified
- [ ] ✅ Performance metrics acceptable
- [ ] ✅ No mixed content errors
- [ ] ✅ Custom domain working (if configured)

## 5. Common Issues & Fixes

### Path Alias Resolution Errors (Vite Projects)
**Issue**: Build fails with "Could not load @/component" or similar errors

**Symptoms**:
```
Could not load @core/pdfProcessor (imported by src/index.js)
Could not load @components/FileUpload (imported by src/index.js)
Module not found: Error: Can't resolve '@/utils'
```

**Fix**:
1. Add framework declaration to `vercel.json`:
   ```json
   "framework": {
     "name": "vite"
   }
   ```

2. Ensure proper build configuration:
   ```json
   "builds": [{
     "src": "package.json",
     "use": "@vercel/static-build"
   }]
   ```

3. Verify your vite.config.js has aliases:
   ```javascript
   resolve: {
     alias: {
       '@': path.resolve(__dirname, 'src'),
       '@components': path.resolve(__dirname, 'src/components'),
       '@core': path.resolve(__dirname, 'src/core'),
       '@utils': path.resolve(__dirname, 'src/utils')
     }
   }
   ```

4. Clear Vercel cache and redeploy:
   ```bash
   vercel rm --cache
   vercel --prod
   ```

### Build Fails
```bash
# Check build logs
vercel logs [deployment-url]

# Common fixes:
# 1. Update Node.js version in package.json
"engines": {
  "node": ">=18.0.0"
}

# 2. Clear Vercel cache
vercel rm --cache

# 3. Check for missing dependencies
npm install
```

### Blank Page After Deployment
- Check browser console for errors
- Verify all routes in `vercel.json`
- Check if `base` path in vite.config.js is correct
- Ensure no absolute paths in your code

### Routing Issues (SPA)
Add this to `vercel.json`:
```json
"rewrites": [
  {
    "source": "/(.*)",
    "destination": "/index.html"
  }
]
```

### Environment Variables Not Working
- Use `VITE_` prefix for client-side variables in Vite
- Access via `import.meta.env.VITE_VAR_NAME`
- For server-side: use `process.env.VAR_NAME`

### Large Bundle Size
```javascript
// Add to vite.config.js
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: [
        visualizer({
          filename: 'dist/stats.html'
        })
      ]
    }
  }
});
```

## 6. Performance Tips

### Bundle Analysis
```bash
# Install analyzer
npm install --save-dev rollup-plugin-visualizer

# Generate stats
npm run build
# Open dist/stats.html in browser
```

### Code Splitting
```javascript
// Dynamic imports
const heavyModule = import('./heavyModule');

// React.lazy (if using React)
const LazyComponent = React.lazy(() => import('./Component'));

// Route-based splitting
const router = createRouter([
  {
    path: '/dashboard',
    component: () => import('./Dashboard')
  }
]);
```

### Cache Headers
```json
// In vercel.json
"headers": [
  {
    "source": "/assets/(.*)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }
    ]
  },
  {
    "source": "/(.*\\.js)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }
    ]
  }
]
```

### Image Optimization
```javascript
// Use Vercel's Image Optimization (for Next.js)
import Image from 'next/image';

// For other frameworks:
// - Use responsive images
// - Compress images before build
// - Use modern formats (WebP/AVIF)
```

## Quick Commands Reference

```bash
# Project Management
vercel ls                    # List deployments
vercel rm [deployment-url]   # Remove deployment
vercel domains ls            # List domains
vercel secrets ls            # List secrets

# Logs & Debugging
vercel logs [deployment-url] # View logs
vercel inspect [url]         # Inspect deployment
vercel blame [file]          # Who deployed?

# Team & Scope
vercel teams ls              # List teams
vercel switch                # Switch scope
```

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Deployment Guide](https://vercel.com/docs/deployments)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)