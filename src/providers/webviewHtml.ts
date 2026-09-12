import * as vscode from 'vscode';
import { randomBytes } from 'crypto';

/** Builds the HTML shell for a webview backed by an esbuild bundle at dist/webview/<name>.js (+ .css). */
export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, bundleName: string, title: string): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', `${bundleName}.js`));
  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', `${bundleName}.css`));
  const nonce = randomBytes(16).toString('base64');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>${title}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
