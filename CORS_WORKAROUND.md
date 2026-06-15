# Workfront API Integration Using Adobe App Builder Runtime Actions

## Overview
This integration follows the Adobe-recommended architecture for App Builder integrations with Workfront. Instead of using a local proxy server or direct browser calls, we use Adobe App Builder Runtime Actions to handle Workfront API calls server-side, avoiding CORS issues entirely.

## Architecture (Adobe-Recommended Pattern)

Based on Adobe Workfront Support guidance, the supported pattern is:

1. **App Builder UI** collects user input and required context
2. **UI** calls an App Builder Runtime Action (not directly to Workfront)
3. **Runtime Action** performs the Workfront API call server-side
4. **Runtime Action** returns only the necessary JSON payload back to the UI

This approach:
- Fully avoids browser CORS constraints
- Ensures Workfront authentication and token handling remain server-side
- Is officially supported by Adobe
- Eliminates security risks of browser-based API calls

## Authentication Flow

The integration uses Workfront Fusion for authentication:

1. **SessionID Retrieval**: The Runtime Action calls a Workfront Fusion hook endpoint
2. **SessionID Caching**: The sessionID is cached in memory (1-hour expiry)
3. **API Calls**: All Workfront API calls use the sessionID in the header
4. **Automatic Refresh**: When the sessionID expires, a new one is automatically requested

## Components

### 1. Runtime Action (`actions/get-workfront-task/index.js`)
- Fetches sessionID from Workfront Fusion hook
- Caches sessionID for performance
- Makes Workfront API calls server-side
- Returns task data to the UI

### 2. UI Component (`src/workfront-ui-1/web-src/src/components/CustomwidgetMainMenuItem.js`)
- Collects user input and task ID
- Calls Runtime Action using `actionWebInvoke` utility
- Displays task data and form
- Handles user interactions

### 3. Utility Function (`src/workfront-ui-1/web-src/src/utils.js`)
- Provides `actionWebInvoke` for calling Runtime Actions
- Handles both local development and production environments
- Manages headers and response parsing

## Configuration

### Runtime Action Configuration
The action is configured in `app.config.yaml`:
```yaml
actions:
  get-workfront-task:
    function: actions/get-workfront-task/index.js
    web: 'enabled'
    runtime: nodejs:18
```

### Workfront Fusion Hook
The action calls: `https://hook.app.workfrontfusion.com/q3rzxctayhojj63oprhwd900ge1mfoeo`

The hook should return a JSON response with a sessionID field (supports `sessionID`, `sessionId`, or `session_id`).

## Development vs Production

### Development Environment
- Action URL: `http://localhost:9090/api/v1/web/workfront-custom-widget/default/get-workfront-task`
- Requires local Adobe I/O Runtime server running

### Production Environment
- Action URL: `https://adobeio.adobe.io/api/workfront-custom-widget/default/get-workfront-task`
- Requires proper deployment via Adobe I/O Console

## Running the Integration

### Local Development

1. **Start the App Builder development server**:
   ```bash
   npm run dev
   ```

2. **The UI will be available** at the local development URL provided by the App Builder CLI

3. **The Runtime Action will be automatically** deployed to the local development server

### Deployment

1. **Deploy to Adobe I/O Runtime**:
   ```bash
   aio app deploy
   ```

2. **Update the production action URL** in the UI component if necessary

## Benefits of This Architecture

- **CORS-Free**: No browser CORS issues
- **Security**: Authentication handled server-side
- **Adobe-Supported**: Follows official Adobe recommendations
- **Scalable**: Can handle multiple concurrent requests
- **Production-Ready**: Suitable for production deployments
- **Maintainable**: Clear separation of concerns

## Migration from Local Proxy

If you were previously using the local proxy server (`src/local-proxy/server.js`):

1. ✅ The local proxy is no longer needed
2. ✅ OAuth2 credentials in `.env` are no longer needed
3. ✅ The UI now calls Runtime Actions directly
4. ✅ Authentication is handled via Workfront Fusion hook

You can safely remove the local proxy server and related configuration.

## Troubleshooting

### "Failed to get sessionID" error
- Verify the Workfront Fusion hook URL is correct
- Check that the hook is returning a valid sessionID
- Review the Runtime Action logs for detailed error messages

### "Runtime Action failed" error
- Ensure the Runtime Action is deployed and running
- Check the action URL matches your environment (dev/prod)
- Verify the action has proper permissions

### "No task details returned" error
- Verify the Task ID is correct
- Check that the task exists in Workfront
- Ensure the sessionID is valid and has permissions

### Local development issues
- Ensure the Adobe I/O Runtime local server is running
- Check that the action URL matches the local server URL
- Verify the action is properly deployed locally

## Security Considerations

- SessionIDs are cached in memory only (not persisted)
- No credentials are exposed to the browser
- Authentication happens server-side
- SessionIDs automatically expire after 1 hour
- The architecture follows Adobe security best practices

## Support

For issues or questions:
- Review Adobe App Builder documentation
- Check Workfront API documentation
- Refer to Adobe Workfront Support for authentication issues
- Review Adobe I/O Runtime logs for debugging
