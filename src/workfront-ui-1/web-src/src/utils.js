/* global fetch */

/**
 * Invoke an Adobe I/O Runtime web action.
 *
 * @param {string}  actionUrl  Full URL of the Runtime action.
 * @param {object}  headers    Extra headers to merge in.
 * @param {object}  params     Query params (GET) or body (POST).
 * @param {object}  options    { method: 'GET' | 'POST' }
 * @returns {Promise<object|string>} Parsed JSON or raw text.
 */
async function actionWebInvoke(actionUrl, headers = {}, params = {}, options = { method: 'POST' }) {
  const actionHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (window.location.hostname === 'localhost') {
    actionHeaders['x-ow-extra-logging'] = 'on';
  }

  const fetchConfig = {
    headers: actionHeaders,
    method: options.method.toUpperCase(),
  };

  if (fetchConfig.method === 'GET') {
    const url = new URL(actionUrl);
    Object.keys(params).forEach((key) => url.searchParams.append(key, params[key]));
    actionUrl = url;
  } else {
    fetchConfig.body = JSON.stringify(params);
  }

  const response = await fetch(actionUrl, fetchConfig);
  let content = await response.text();

  if (!response.ok) {
    return JSON.parse(content);
  }

  try {
    content = JSON.parse(content);
  } catch (_) {
    // response is not JSON — return as-is
  }
  return content;
}

export default actionWebInvoke;
