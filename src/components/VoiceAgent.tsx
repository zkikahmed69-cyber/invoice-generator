import { useState, useRef, useCallback, useEffect } from "react"
import { Mic, MicOff, X, Bot, Loader2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { processVoiceCommand, applyPatch, type ChatMessage, type InvoicePatch } from "@/lib/gemini"
import type { InvoiceData } from "@/types/invoice"

// Typage du Web Speech API (non inclus dans lib.dom.d.ts par défaut)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

type Message = {
  id: string
  role: "user" | "agent"
  text: string
}

interface VoiceAgentProps {
  invoice: InvoiceData
  onUpdate: (updated: InvoiceData) => void
}

const API_KEY_STORAGE = "gemini_api_key"

export function VoiceAgent({ invoice, onUpdate }: VoiceAgentProps) {
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? "")
  const [keyInput, setKeyInput] = useState("")
  const [showKeyInput, setShowKeyInput] = useState(false)

  const historyRef = useRef<ChatMessage[]>([])
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isSpeechSupported =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition)

  const effectiveKey = apiKey

  useEffect(() => {
    if (open && !apiKey) setShowKeyInput(true)
  }, [open, apiKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, transcript])

  const addMessage = useCallback((role: Message["role"], text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, text }])
  }, [])

  const processCommand = useCallback(
    async (text: string) => {
      if (!text.trim() || !effectiveKey) return

      addMessage("user", text)
      setLoading(true)
      setTranscript("")

      try {
        const patch: InvoicePatch = await processVoiceCommand(
          text,
          invoice,
          historyRef.current,
          effectiveKey
        )

        // Met à jour l'historique multi-tour
        historyRef.current = [
          ...historyRef.current,
          { role: "user", parts: [{ text }] },
          { role: "model", parts: [{ text: JSON.stringify(patch) }] },
        ]

        const updated = applyPatch(invoice, patch)
        onUpdate(updated)
        addMessage("agent", patch.message)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue"
        addMessage("agent", `Erreur : ${msg}`)
      } finally {
        setLoading(false)
      }
    },
    [invoice, effectiveKey, addMessage, onUpdate]
  )

  const startRecording = useCallback(() => {
    if (!isSpeechSupported) return

    const Rec = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Rec) return

    const recognition = new Rec()
    recognition.lang = "fr-FR"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const interim = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("")
      setTranscript(interim)

      if (e.results[e.results.length - 1].isFinal) {
        recognition.stop()
        processCommand(interim)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "no-speech") {
        addMessage("agent", `Microphone : ${e.error}`)
      }
      setRecording(false)
      setTranscript("")
    }

    recognition.onend = () => setRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }, [isSpeechSupported, processCommand, addMessage])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  const saveKey = () => {
    if (!keyInput.trim()) return
    localStorage.setItem(API_KEY_STORAGE, keyInput.trim())
    setApiKey(keyInput.trim())
    setKeyInput("")
    setShowKeyInput(false)
  }

  const clearKey = () => {
    localStorage.removeItem(API_KEY_STORAGE)
    setApiKey("")
    setShowKeyInput(true)
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
          "flex items-center justify-center transition-all duration-200",
          "bg-primary text-primary-foreground hover:scale-105 active:scale-95",
          open && "rotate-12"
        )}
        aria-label="Ouvrir l'assistant vocal"
      >
        <Bot size={24} />
      </button>

      {/* Panneau */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl shadow-2xl border bg-background flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot size={16} />
              <span className="font-semibold text-sm">Assistant vocal</span>
              {!effectiveKey && (
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">Clé requise</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowKeyInput((v) => !v)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Configurer la clé API"
              >
                <KeyRound size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Saisie clé API */}
          {showKeyInput && (
            <div className="px-4 py-3 border-b bg-muted/40 space-y-2">
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Colle ta clé Gemini API..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveKey()}
                  className="flex-1 text-xs px-2 py-1.5 rounded border bg-background outline-none focus:ring-1 ring-primary"
                  autoFocus
                />
                <Button size="sm" className="text-xs h-7 px-2" onClick={saveKey}>
                  OK
                </Button>
              </div>
              {effectiveKey && (
                <button
                  onClick={clearKey}
                  className="text-xs text-destructive hover:underline w-full text-left"
                >
                  Supprimer la clé enregistrée
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px] max-h-[280px]">
            {messages.length === 0 && !transcript && (
              <p className="text-xs text-muted-foreground text-center pt-4">
                {effectiveKey
                  ? "Clique sur le micro et dicte les infos de ta facture"
                  : "Configure ta clé API Gemini pour commencer"}
              </p>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "text-xs px-3 py-2 rounded-xl max-w-[90%]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                {m.text}
              </div>
            ))}

            {/* Transcript en cours */}
            {transcript && (
              <div className="text-xs px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 italic ml-auto max-w-[90%]">
                {transcript}
                <span className="animate-pulse">…</span>
              </div>
            )}

            {/* Chargement Gemini */}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-xl w-fit">
                <Loader2 size={12} className="animate-spin" />
                Analyse en cours…
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bouton micro */}
          <div className="border-t px-4 py-3 flex items-center justify-center gap-3">
            {!isSpeechSupported ? (
              <p className="text-xs text-muted-foreground text-center">
                Micro non supporté sur ce navigateur (utilise Chrome)
              </p>
            ) : (
              <>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={loading || !effectiveKey}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    recording
                      ? "bg-red-500 text-white scale-110 animate-pulse shadow-lg shadow-red-200"
                      : "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
                  )}
                  aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
                >
                  {recording ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <span className="text-xs text-muted-foreground">
                  {recording ? "En écoute… parle maintenant" : "Appuie pour dicter"}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
