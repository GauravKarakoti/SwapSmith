# Deployment Troubleshooting Guide

## Common Deployment Issues and Solutions

### 1. GitHub Server Error (HTTP 500)

**Error Message:**
```
remote: Internal Server Error
fatal: unable to access 'https://github.com/[username]/[repo]/': The requested URL returned error: 500
```

**Cause:** Temporary GitHub infrastructure issues or server overload.

**Solutions:**
1. **Wait and Retry:** GitHub server errors are usually temporary (5-30 minutes)
2. **Check GitHub Status:** Visit https://www.githubstatus.com/ for ongoing incidents
3. **Force New Deployment:**
   ```bash
   # Create a trigger commit
   echo "Deployment trigger - $(date)" > .deployment-trigger
   git add .deployment-trigger
   git commit -m "trigger: Force new deployment after server error"
   git push origin [branch-name]
   ```
4. **Manual Netlify Deployment:**
   ```bash
   # If you have Netlify CLI installed
   netlify deploy --prod --dir=frontend/out
   ```

### 2. Netlify Build Failures

**Common Issues:**
- Node.js version mismatch
- Missing environment variables
- Build script errors
- Dependency conflicts

**Solutions:**
1. **Check Build Settings in Netlify:**
   - Build command: `npm run build`
   - Publish directory: `frontend/out` or `frontend/.next`
   - Node.js version: 18.x or 20.x

2. **Environment Variables:**
   - Ensure all required env vars are set in Netlify dashboard
   - Check `.env.example` for required variables

3. **Local Build Test:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

### 3. Branch-Specific Deployment Issues

**For input-validation branch:**
- Ensure all input validation changes are properly tested
- Check that API routes have proper error handling
- Verify TypeScript compilation passes

**For security branches (csrf-protection, secret-exposure):**
- Ensure security middleware is properly configured
- Check that CSRF tokens are correctly implemented
- Verify Docker secrets are properly set up

### 4. Emergency Deployment Options

**Option 1: Direct Branch Deployment**
```bash
# Switch to main branch and merge
git checkout main
git merge input-validation
git push origin main
```

**Option 2: Manual Netlify Deploy**
```bash
# Build locally and deploy
npm run build
netlify deploy --prod --dir=frontend/out
```

**Option 3: Alternative Git Remote**
```bash
# Add backup remote if needed
git remote add backup https://github.com/[backup-repo].git
git push backup input-validation
```

### 5. Monitoring and Prevention

**Pre-deployment Checklist:**
- [ ] Local build passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] TypeScript compilation: `npm run type-check`
- [ ] Environment variables configured
- [ ] GitHub status is operational

**Monitoring Tools:**
- GitHub Status: https://www.githubstatus.com/
- Netlify Status: https://www.netlifystatus.com/
- Build logs in Netlify dashboard

### 6. Contact and Escalation

**If issues persist:**
1. Check GitHub Community discussions
2. Contact Netlify support if build-specific
3. Review recent commits for breaking changes
4. Consider rollback to last working deployment

**Useful Commands:**
```bash
# Check recent commits
git log --oneline -10

# Check branch status
git status
git branch -a

# Force refresh deployment
git commit --allow-empty -m "Empty commit to trigger deployment"
git push origin [branch-name]
```

## Branch-Specific Notes

### input-validation Branch
- Contains input validation improvements for API routes
- Should deploy successfully after GitHub server issues are resolved
- Key files: API routes with enhanced validation

### Security Branches
- csrf-protection: CSRF token implementation
- secret-exposure: Docker secrets management
- lazy-loading: Bundle optimization with dynamic imports

Last Updated: March 5, 2026