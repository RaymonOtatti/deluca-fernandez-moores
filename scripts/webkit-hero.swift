// 8.6c: the hero's light in WebKit, Safari's engine, which the Chrome tests can't speak for (Safari loads a clip only
// from a server that answers byte ranges, and only from the page). Loads a URL in an off-screen WKWebView and prints
// one JSON line: whether the motion's layers appeared, faded fully in, drew the clip's frames and left.
//   swift scripts/webkit-hero.swift http://127.0.0.1:4323/
import Cocoa
import WebKit

final class Probe: NSObject, WKNavigationDelegate {
    let web: WKWebView
    override init() {
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []  // as Safari: muted media plays without a gesture
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1440, height: 900), configuration: config)
        super.init()
        web.navigationDelegate = self
        // an off-screen window counts as hidden, which pauses animation frames and video frame callbacks
        let occlusion = Selector(("_setWindowOcclusionDetectionEnabled:"))
        if web.responds(to: occlusion) { web.perform(occlusion, with: false) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let js = """
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const out = { seen: false, on: false, drawn: false, removed: false };
        let first = null;
        for (let t = 0; t < 12000; t += 200) {
          const m = document.querySelector('.hero__motion');
          const c = m?.querySelector('canvas.hero__light');
          if (m) { out.seen = true; if (getComputedStyle(m).opacity === '1') out.on = true; }
          if (c) {
            const px = c.getContext('2d').getImageData(Math.round(c.width * 0.85), Math.round(c.height * 0.2), 1, 1).data.join();
            if (first === null) first = px; else if (px !== first) out.drawn = true;
          }
          if (out.seen && !m) { out.removed = true; break; }
          await wait(200);
        }
        return JSON.stringify(out);
        """
        webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { result in
            if case .success(let v) = result { print(v) } else { print("{\"error\": true}") }
            exit(0)
        }
    }
}

let app = NSApplication.shared
let probe = Probe()
let window = NSWindow(contentRect: NSRect(x: -3000, y: 0, width: 1440, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
window.contentView = probe.web
window.orderFront(nil)
probe.web.load(URLRequest(url: URL(string: CommandLine.arguments[1])!))
DispatchQueue.main.asyncAfter(deadline: .now() + 40) { print("{\"timeout\": true}"); exit(1) }
app.run()
