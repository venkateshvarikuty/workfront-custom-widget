# CORS Workaround for Workfront API Integration

## Problem
The Workfront API does not allow cross-origin requests from localhost by default, causing CORS errors when trying to fetch task data directly from the browser.

## Solutions

### Option 1: Use a CORS Browser Extension (Recommended for Development)
1. Install a CORS browser extension:
   - Chrome: "Allow CORS: Access-Control-Allow-Origin" or "CORS Unblock"
   - Firefox: "CORS Everywhere"
2. Enable the extension when testing locally
3. This will allow the browser to bypass CORS restrictions for development

### Option 2: Configure Workfront to Allow Your Origin
Contact your Workfront administrator to:
1. Add your development origin (e.g., `https://localhost:9080`) to the Workfront CORS allowlist
2. This is the production-ready solution but requires administrative access

### Option 3: Use a Proxy Server
Set up a local proxy server that:
1. Receives requests from your widget
2. Forwards them to Workfront API
3. Adds the necessary CORS headers to the response
4. Returns the response to your widget

### Option 4: Deploy to Production
Once the app is approved and deployed to production:
1. The production URL will be different (not localhost)
2. Workfront may have different CORS policies for production URLs
3. This is the long-term solution

## Current Status
The widget now uses direct Workfront API calls with enhanced error handling. If you see CORS errors, use Option 1 (browser extension) for immediate testing.

## Testing with CORS Extension
1. Install and enable a CORS browser extension
2. Run `aio app run` or `aio app dev`
3. Open the local URL in your browser
4. Test the widget with a valid task ID
5. The extension will allow the cross-origin request to succeed
