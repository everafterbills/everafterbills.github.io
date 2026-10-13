import { useEffect, useState } from "react";
import { Share, SquarePlus, MoreHorizontal, EllipsisVertical, Download } from "lucide-react";
import { isIOS } from "../lib/platform.js";

export default function InstallGate() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  const ios = isIOS();

  return (
    <main className="gate">
      <img src="/icons/mark.svg" alt="" className="mark" />
      <h1 className="wordmark">Ever After</h1>
      <h2>Add Ever After to your Home Screen</h2>
      <p className="lead">To keep your bills private, Ever After only opens from its Home Screen icon. This takes a few seconds.</p>

      {ios ? (
        <ol className="steps glass">
          <li><span className="n">1</span><span>Tap <span className="glyph"><Share size={16} /></span> Share in Safari. On newer iPhones, tap <span className="glyph"><MoreHorizontal size={16} /></span> first.</span></li>
          <li><span className="n">2</span><span>Scroll down and tap <span className="glyph"><SquarePlus size={16} /></span> Add to Home Screen.</span></li>
          <li><span className="n">3</span><span>Leave "Open as Web App" on, then tap Add.</span></li>
          <li><span className="n">4</span><span>Open Ever After from your Home Screen.</span></li>
        </ol>
      ) : prompt ? (
        <button className="btn btn-primary" style={{ marginTop: 28 }} onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>
          <Download size={18} /> Install Ever After
        </button>
      ) : (
        <ol className="steps glass">
          <li><span className="n">1</span><span>Tap <span className="glyph"><EllipsisVertical size={16} /></span> in your browser.</span></li>
          <li><span className="n">2</span><span>Tap Install app or Add to Home screen.</span></li>
          <li><span className="n">3</span><span>Open Ever After from your Home Screen.</span></li>
        </ol>
      )}
      <p className="hint">On a computer, you can use Ever After right in the browser.</p>
    </main>
  );
}
