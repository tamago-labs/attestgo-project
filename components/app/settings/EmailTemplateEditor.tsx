"use client";

import { useEffect, useState } from "react";
import { CAUSES, DEFAULT_TEMPLATES, type CauseId } from "@/lib/send/emailTemplates";
import { Loader2, Sparkles, RotateCcw, Save } from "lucide-react";

const PLACEHOLDERS = ["{{senderName}}", "{{senderAddress}}", "{{recipientName}}", "{{recipientAddress}}", "{{amount}}", "{{asset}}", "{{cause}}"];

export default function EmailTemplateEditor({ userProfileId }: { userProfileId: string | null }) {
  const [cause, setCause] = useState<CauseId>("payment");
  const [template, setTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  useEffect(() => {
    if (!userProfileId) return;
    (async () => {
      try {
        const res = await fetch(`/api/templates?userProfileId=${userProfileId}`);
        if (res.ok) {
          const data = await res.json();
          const found = (data.templates || []).find((t: { cause: string }) => t.cause === cause);
          setTemplate(found ? found.template : DEFAULT_TEMPLATES[cause]);
        } else {
          setTemplate(DEFAULT_TEMPLATES[cause]);
        }
      } catch {
        setTemplate(DEFAULT_TEMPLATES[cause]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cause, userProfileId]);

  const save = async () => {
    if (!userProfileId) return;
    setSaving(true);
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userProfileId, cause, template }),
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setTemplate(DEFAULT_TEMPLATES[cause]);
  };

  const generate = async () => {
    if (!aiPrompt) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, cause }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.template) {
          setTemplate(data.template);
          setAiModalOpen(false);
          setAiPrompt("");
        }
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Transfer Purpose</h4>
        <button
          onClick={() => setAiModalOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white"
          style={{ background: "linear-gradient(135deg, rgba(253,183,80,0.4), rgba(139,124,240,0.4))" }}
        >
          <Sparkles size={12} /> AI compose
        </button>
      </div>

      <select value={cause} onChange={(e) => setCause(e.target.value as CauseId)} className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-panel outline-none text-white">
        {CAUSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      <div>
        <label className="text-muted text-xs mb-1.5 block">Email template</label>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={10}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-panel outline-none text-white resize-none font-mono leading-relaxed"
        />
      </div>

      <div>
        <p className="text-xs text-white mb-1.5">Placeholders</p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {PLACEHOLDERS.map((p) => (
            <span key={p} className="text-[10px] font-mono text-muted bg-white/[0.04] px-1.5 py-0.5 rounded cursor-pointer hover:text-white" onClick={() => {
              const textarea = document.querySelector("textarea");
              if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                setTemplate((prev) => prev.substring(0, start) + p + prev.substring(end));
              }
            }}>{p}</span>
          ))}
        </div>
        <p className="text-white/30 text-[11px]">Click to insert, or highlight text to replace</p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
          <button onClick={reset} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white">
          <RotateCcw size={12} /> Reset to default
        </button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-amber text-canvas text-xs font-medium hover:bg-amber/90 disabled:opacity-40">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </div>

      {aiModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAiModalOpen(false)} />
          <div className="relative w-full max-w-md bg-canvas border border-border rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-medium text-white flex items-center gap-2"><Sparkles size={14} className="text-amber" /> AI Email Composer</h4>
            <p className="text-xs text-muted">Describe the tone or purpose. The AI will draft a template with placeholders.</p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Friendly birthday gift message"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-panel outline-none text-white resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAiModalOpen(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white">Cancel</button>
              <button onClick={generate} disabled={aiLoading || !aiPrompt} className="px-3 py-1.5 rounded-lg bg-amber text-canvas text-xs font-medium hover:bg-amber/90 disabled:opacity-40">
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
