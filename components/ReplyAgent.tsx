"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { generateReply } from "../lib/model";

type Tone = "friendly" | "formal" | "concise" | "empathetic" | "sales";

const defaultContext = `You: Hey! Are we still on for tomorrow?\nThem: Yes, 3 PM works great.\nYou: Perfect. Also, quick question about the venue?do they have parking?`;
const defaultIncoming = `Hi! Can we move to 4 PM instead?`;

export default function ReplyAgent() {
  const [context, setContext] = useState<string>(defaultContext);
  const [incoming, setIncoming] = useState<string>(defaultIncoming);
  const [tone, setTone] = useState<Tone>("friendly");
  const [length, setLength] = useState<"short" | "medium" | "long">("short");
  const [language, setLanguage] = useState<string>("auto");
  const [loading, setLoading] = useState<boolean>(false);
  const [modelStatus, setModelStatus] = useState<string>("Model not loaded yet");
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Attempt a soft warm-up shortly after mount
  useEffect(() => {
    let cancelled = false;
    const warmup = async () => {
      setModelStatus("Loading model (downloads ~few hundred MB on first run)...");
      try {
        // Lazy import model by calling a tiny generation which will preload weights
        const prompt = buildPrompt("Ok", "friendly", "short", "auto");
        await generateReply(prompt.slice(0, 60), { maxNewTokens: 1, temperature: 0.7, topP: 0.9 });
        if (!cancelled) setModelStatus("Model ready");
      } catch (e: any) {
        if (!cancelled) setModelStatus("Model fallback will be used if loading fails");
      }
    };
    // Delay to avoid blocking first paint
    const t = setTimeout(warmup, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const lengthToTokens = useMemo(() => ({ short: 64, medium: 128, long: 196 }), []);

  const onGenerate = async () => {
    setError("");
    setOutput("");
    setLoading(true);
    try {
      const prompt = buildPrompt(incoming, tone, length, language, context);
      const text = await generateReply(prompt, {
        maxNewTokens: lengthToTokens[length],
        temperature: 0.7,
        topP: 0.95,
      });
      const cleaned = sanitizeToWhatsApp(text);
      setOutput(cleaned || fallbackGenerate(incoming, tone, length, language));
    } catch (e: any) {
      setError("Model generation failed. Using offline fallback.");
      setOutput(fallbackGenerate(incoming, tone, length, language));
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  };

  const waLink = useMemo(() => {
    if (!output) return null;
    const encoded = encodeURIComponent(output);
    return `https://wa.me/?text=${encoded}`;
  }, [output]);

  return (
    <div className="grid">
      <section className="card">
        <h3>Conversation context</h3>
        <label className="label">Paste earlier messages (optional)</label>
        <textarea
          className="textarea"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={"You: ...\nThem: ...\nYou: ..."}
        />

        <div className="hr" />

        <label className="label">Last incoming message</label>
        <textarea
          className="textarea"
          value={incoming}
          onChange={(e) => setIncoming(e.target.value)}
          placeholder="Paste the latest message you want to reply to"
        />

        <div style={{ height: 8 }} />

        <div className="row">
          <div className="row" style={{ gap: 6 }}>
            <span className="label" style={{ margin: 0 }}>Tone</span>
            <select className="select" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="concise">Concise</option>
              <option value="empathetic">Empathetic</option>
              <option value="sales">Salesy</option>
            </select>
          </div>

          <div className="row" style={{ gap: 6 }}>
            <span className="label" style={{ margin: 0 }}>Length</span>
            <select className="select" value={length} onChange={(e) => setLength(e.target.value as any)}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>

          <div className="row" style={{ gap: 6 }}>
            <span className="label" style={{ margin: 0 }}>Language</span>
            <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="pt">Portuguese</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="hi">Hindi</option>
              <option value="ar">Arabic</option>
            </select>
          </div>

          <button className="button" onClick={onGenerate} disabled={loading || !incoming.trim()}>
            {loading ? "Generating?" : "Generate reply"}
          </button>
        </div>

        <div style={{ height: 8 }} />
        <span className="badge">{modelStatus}</span>
      </section>

      <section className="card">
        <h3>Suggested reply</h3>
        <div className="output">{output || <span className="small">Your AI-crafted reply will appear here.</span>}</div>
        <div style={{ height: 10 }} />
        <div className="row">
          <button className="button secondary" onClick={onCopy} disabled={!output}>Copy</button>
          <a className="button ghost" href={waLink ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!waLink} style={{ pointerEvents: waLink ? "auto" : "none" }}>Open in WhatsApp</a>
          {error && <span className="small" style={{ color: "#b91c1c" }}>{error}</span>}
        </div>
      </section>
    </div>
  );
}

function buildPrompt(
  incoming: string,
  tone: Tone,
  length: "short" | "medium" | "long",
  language: string,
  context?: string,
) {
  const toneDesc: Record<Tone, string> = {
    friendly: "friendly, warm, natural",
    formal: "professional and polite",
    concise: "succinct, to-the-point",
    empathetic: "empathetic and reassuring",
    sales: "persuasive but not pushy, value-focused",
  };
  const lengthDesc: Record<string, string> = {
    short: "1-2 sentences",
    medium: "2-4 sentences",
    long: "a short paragraph",
  };
  const langDesc = language === "auto" ? "Match the user's language" : `Write in ${language}`;

  const sys = `System: You are a WhatsApp reply assistant. Draft a reply considering tone, brevity, and clarity. ${langDesc}. Avoid emojis unless present in the context. No preambles.`;
  const ctx = context?.trim() ? `\n\nConversation so far:\n${context.trim()}` : "";
  const instr = `\n\nGuidelines: Tone: ${toneDesc[tone]}. Length: ${lengthDesc[length]}. Add a helpful follow-up question only if appropriate.`;

  const user = `\n\nUser message: ${incoming.trim()}`;
  const prompt = `${sys}${ctx}${instr}${user}\n\nAssistant:`;
  return prompt;
}

function sanitizeToWhatsApp(text: string) {
  // Remove markdown artifacts or extra role text
  const cleaned = text
    .replace(/^Assistant:\s*/i, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
  // Keep it under ~500 chars for mobile friendliness
  return cleaned.length > 500 ? cleaned.slice(0, 500).trimEnd() + "?" : cleaned;
}

function fallbackGenerate(
  incoming: string,
  tone: Tone,
  length: "short" | "medium" | "long",
  language: string
) {
  const politeOpen = {
    friendly: "Hey!",
    formal: "Hello,",
    concise: "",
    empathetic: "I understand?",
    sales: "Great question?",
  }[tone];

  const core = simpleParaphrase(incoming);
  const follow = maybeFollowUp(incoming, tone);
  let reply = [politeOpen, core, follow].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  if (length === "short") {
    reply = reply.split(/([.!?])/).slice(0, 2).join("").trim();
  }

  return reply;
}

function simpleParaphrase(msg: string) {
  const m = msg.trim();
  if (/\?$/.test(m)) return m.replace(/\?+$/, "?") + " I can do that.";
  if (/sorry|issue|problem|delay/i.test(m)) return "Thanks for flagging?I'll sort this out and keep you posted.";
  if (/thanks|thank you/i.test(m)) return "You're welcome!";
  if (/time|reschedule|move|tomorrow|today|tonight|am|pm/i.test(m)) return "That works for me?happy to adjust the time.";
  return "Got it!";
}

function maybeFollowUp(msg: string, tone: Tone) {
  if (/time|reschedule|move|when|what time|slot/i.test(msg)) return "Does that timing suit you?";
  if (/where|venue|location|address|park|parking/i.test(msg)) return "Would you like the address or parking details?";
  if (tone === "sales") return "Would you like a quick overview of the benefits?";
  return "";
}
