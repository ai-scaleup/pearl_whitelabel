// ./src/components/dashboard/outbound/calls-page.tsx
"use client"

import { useUser } from "@clerk/nextjs"
import React, { useEffect, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Edit, RefreshCw, Phone, X, ArrowRight, ChevronDown, AlertCircle } from "lucide-react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

import {
  apiGetUser,
  apiGetCampaignsByEmail,
  apiListCalls,
  apiGetCallDetails,
  apiValidateCredentials,
} from "@/app/features/pearl/apis"
import type {
  UserData,
  CallDetails,
  CampaignData,
  CallsFilters,
  CallsResponse,
  CallData,
} from "@/app/features/pearl/types"

/* ------------------------------ Toast ------------------------------ */

const ToastProvider = ToastPrimitives.Provider
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 2000
type ToasterToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}
let count = 0
const genId = () => `${(count = (count + 1) % Number.MAX_SAFE_INTEGER)}`

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string }
interface State { toasts: ToasterToast[] }

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const listeners: Array<(s: State) => void> = []
let memoryState: State = { toasts: [] }

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return
  const t = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, t)
}
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST": return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case "UPDATE_TOAST": return { ...state, toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)) }
    case "DISMISS_TOAST": {
      const { toastId } = action
      if (toastId) addToRemoveQueue(toastId)
      else state.toasts.forEach((t) => addToRemoveQueue(t.id))
      return { ...state, toasts: state.toasts.map((t) => (t.id === toastId || toastId === undefined ? { ...t, open: false } : t)) }
    }
    case "REMOVE_TOAST": return action.toastId === undefined ? { ...state, toasts: [] } : { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) }
  }
}
function dispatch(action: Action) { memoryState = reducer(memoryState, action); listeners.forEach((l) => l(memoryState)) }
function toast({ ...props }: Omit<ToasterToast, "id">) {
  const id = genId()
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })
  dispatch({ type: "ADD_TOAST", toast: { ...props, id, open: true, onOpenChange: (open) => !open && dismiss() } })
  return { id, dismiss }
}
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1) }
  }, [])
  return { ...state, toast }
}
const Toaster = React.memo(() => {
  const { toasts } = useToast()
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">{title && <ToastTitle>{title}</ToastTitle>}{description && <ToastDescription>{description}</ToastDescription>}</div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
})
Toaster.displayName = "Toaster"

/* ----------------------- Local helpers & constants ----------------------- */

const STORAGE_KEYS = {
  BEARER_TOKEN: "analytics_bearer_token",
  OUTBOUND_ID: "analytics_outbound_id",
  CAMPAIGN_ID: "analytics_campaign_id",
}
const saveToLocalStorage = (k: string, v: string) => { try { if (typeof window !== "undefined") localStorage.setItem(k, v) } catch { } }
const getFromLocalStorage = (k: string) => { try { if (typeof window !== "undefined") return localStorage.getItem(k) } catch { } return null }

const getDefaultDateRange = () => {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  // NLPearl v2 expects simple date format: YYYY-MM-DD
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  return { from: fmt(from), to: fmt(to) }
}

/** Typed status maps (avoid `any`) */
const STATUS_TEXT: Record<number, string> = {
  1: "Nuovo",
  3: "In corso",
  4: "Completata",
  5: "Occupato",
  6: "Fallita",
  7: "Nessuna risposta",
  8: "Annullata",
  10: "Da riprovare",
  20: "In coda chiamate",
  30: "Prefisso errato",
  40: "In chiamata",
  70: "Segreteria",
  100: "Riuscita",
  110: "Non riuscita",
  130: "Completata",
  150: "Irreperibile",
  220: "Blacklist",
  300: "Abbandono coda",
}
const getStatusText = (s: number) => STATUS_TEXT[s] ?? "Sconosciuto"

const CONV_STATUS_TEXT: Record<number, string> = {
  1: "Nuovo",
  10: "Da riprovare",
  20: "In coda",
  30: "Prefisso errato",
  40: "In chiamata",
  70: "Segreteria",
  100: "Riuscita",
  110: "Non riuscita",
  130: "Completata",
  150: "Irreperibile",
  220: "Blacklist",
  300: "Abbandono coda",
  500: "Errore",
}
const getConversationStatusText = (s: number) => CONV_STATUS_TEXT[s] ?? "Sconosciuto"

const SENTIMENT_TEXT: Record<number, string> = {
  1: "Negativo",
  2: "Leggermente negativo",
  3: "Neutro",
  4: "Leggermente positivo",
  5: "Positivo",
}
const getSentimentText = (s: number) => SENTIMENT_TEXT[s] ?? "Sconosciuto"

const SENTIMENT_COLOR: Record<number, string> = {
  1: "text-red-600",
  2: "text-orange-600",
  3: "text-gray-600",
  4: "text-blue-600",
  5: "text-green-600",
}
const getSentimentColor = (s: number) => SENTIMENT_COLOR[s] ?? "text-gray-600"



const formatDuration = (s: number) => {
  const m = Math.ceil(s / 60)
  return `${m} minute${m !== 1 ? "s" : ""}`
}
const formatDate = (iso: string) => new Date(iso).toLocaleString()



/* ----------------------------- UI components ---------------------------- */











const LimitSelector: React.FC<{ limit: number; onLimitChange: (limit: number) => void }> = ({ limit, onLimitChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [customLimit, setCustomLimit] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const predefined = [25, 50, 100]
  const pick = (n: number) => { onLimitChange(n); setIsOpen(false); setShowCustomInput(false) }
  const submit = () => {
    const v = Number.parseInt(customLimit)
    if (v > 0 && v <= 5000) { onLimitChange(v); setShowCustomInput(false); setIsOpen(false); setCustomLimit("") }
  }
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <span className="text-sm font-medium">Elementi per pagina</span><span className="text-sm text-slate-600">{limit}</span><ChevronDown className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {predefined.map((n) => (
              <div key={n} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer" onClick={() => pick(n)}>
                <input type="radio" checked={limit === n} onChange={() => { }} className="w-4 h-4" /><span className="text-sm">{n}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 mt-2 pt-2">
              {!showCustomInput ? (
                <div className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-blue-600" onClick={() => setShowCustomInput(true)}>
                  <span className="text-sm">Personalizzato...</span>
                </div>
              ) : (
                <div className="p-2">
                  <div className="flex items-center gap-2">
                    <input type="number" value={customLimit} onChange={(e) => setCustomLimit(e.target.value)} placeholder="1-5000" min="1" max="5000" className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={submit} disabled={!customLimit || Number.parseInt(customLimit) <= 0 || Number.parseInt(customLimit) > 5000} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300">OK</button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Max: 5000</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Main Page ------------------------------ */

export default function CallsPage() {
  const { user, isLoaded } = useUser()
  const { toast } = useToast()

  const [userData, setUserData] = useState<UserData | null>(null)
  const [calls, setCalls] = useState<CallData[]>([])
  const [totalCalls, setTotalCalls] = useState(0)
  const [loading, setLoading] = useState(false)
  const [callsLoading, setCallsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [authId, setAuthId] = useState("")
  const [token, setToken] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCall, setSelectedCall] = useState<CallData | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [callDetails, setCallDetails] = useState<CallDetails | null>(null)
  const [callDetailsLoading, setCallDetailsLoading] = useState(false)
  const [activeRightTab, setActiveRightTab] = useState<"transcript" | "events">("transcript")

  const [campaigns, setCampaigns] = useState<CampaignData[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignData | null>(null)
  const [campaignsLoading, setCampaignsLoading] = useState(false)

  const [filters, setFilters] = useState<CallsFilters>({
    skip: 0,
    limit: 100,
    sortProp: "startTime",
    isAscending: false,
    fromDate: getDefaultDateRange().from,
    toDate: getDefaultDateRange().to,
    statuses: [],
    conversationStatuses: [],
  })

  const [isConfigured, setIsConfigured] = useState<boolean>(() => {
    const bt = getFromLocalStorage(STORAGE_KEYS.BEARER_TOKEN)
    const oid = getFromLocalStorage(STORAGE_KEYS.OUTBOUND_ID)
    return !!(bt && oid)
  })

  const canSubmit = useMemo(() => authId.trim().length > 0 && token.trim().length > 0 && !submitting, [authId, token, submitting])


  /** Client-side filtering removed - we now filter on server via 'statuses' */
  const filteredCalls = calls

  /* ------------------------------- Fetchers ------------------------------- */

  const fetchUserData = useCallback(async (userId: string, showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const data = await apiGetUser(userId)
      setUserData(data)
      return data
    } catch (e: unknown) {
      console.error(e)
      toast({ title: "Errore", description: "Impossibile recuperare i dati utente. Riprova.", variant: "destructive" })
      return null
    } finally { if (showLoader) setLoading(false) }
  }, [toast])

  const fetchCalls = useCallback(async (custom?: Partial<CallsFilters>, showSuccessToast = false) => {
    const bearer = getFromLocalStorage(STORAGE_KEYS.BEARER_TOKEN)
    const outbound = getFromLocalStorage(STORAGE_KEYS.OUTBOUND_ID)
    if (!bearer || !outbound) {
      // No credentials - user needs to select a campaign in Panoramica
      setIsConfigured(false)
      return
    }

    setCallsLoading(true)
    try {
      const f = { ...filters, ...custom }
      const data: CallsResponse = await apiListCalls({
        outboundId: outbound,
        bearerToken: bearer,
        filters: {
          skip: f.skip,
          limit: f.limit,
          fromDate: f.fromDate,
          toDate: f.toDate,
          statuses: f.statuses,
        },
      })

      console.log("[fetchCalls] response data:", JSON.stringify({ count: data.count, resultsLength: data.results?.length, resultsIsArray: Array.isArray(data.results), keys: Object.keys(data) }))

      if (!Array.isArray(data.results)) {
        toast({ title: "Errore", description: "Formato di risposta API non valido.", variant: "destructive" })
        setCalls([]); setTotalCalls(0); return
      }

      setCalls(data.results)

      // ✅ Force `number` using nullish coalescing + annotation
      const total: number = (data.count ?? data.totalCount ?? data.results.length)
      setTotalCalls(total)



      if (showSuccessToast) toast({ title: "Operazione riuscita", description: `Caricate ${data.results.length} chiamate con successo!` })
    } catch (e: unknown) {
      console.error(e)
      const message = e instanceof Error ? e.message : "Impossibile connettersi al server."
      toast({ title: "Errore", description: message, variant: "destructive" })
      setCalls([]); setTotalCalls(0)
    } finally { setCallsLoading(false) }
  }, [filters, toast])

  // Ref to always hold the latest fetchCalls to avoid stale closures in effects
  const fetchCallsRef = React.useRef(fetchCalls)
  useEffect(() => { fetchCallsRef.current = fetchCalls }, [fetchCalls])

  const fetchCallDetails = useCallback(async (callId: string) => {
    const bearer = getFromLocalStorage(STORAGE_KEYS.BEARER_TOKEN)
    if (!callId || !bearer) return
    setCallDetailsLoading(true)
    try {
      const data = await apiGetCallDetails(callId, bearer)
      setCallDetails(data)
    } catch (e: unknown) {
      console.error(e)
      toast({ title: "Errore", description: "Impossibile recuperare i dettagli della chiamata.", variant: "destructive" })
    } finally { setCallDetailsLoading(false) }
  }, [toast])

  const fetchCampaigns = useCallback(async (email: string, showToast = false) => {
    if (!email) return []
    setCampaignsLoading(true)
    try {
      const list = await apiGetCampaignsByEmail(email)
      setCampaigns(list)

      // Read credentials from localStorage (set by Overview page) instead of overwriting
      const savedId = getFromLocalStorage(STORAGE_KEYS.CAMPAIGN_ID)
      const savedBearer = getFromLocalStorage(STORAGE_KEYS.BEARER_TOKEN)
      const savedOutbound = getFromLocalStorage(STORAGE_KEYS.OUTBOUND_ID)

      if (savedId && savedBearer && savedOutbound) {
        // Use the campaign set by Overview page
        const campaign = list.find((c) => c.id === savedId)
        if (campaign) {
          setSelectedCampaign(campaign)
        }
        setIsConfigured(true)
        await fetchCallsRef.current()
      } else if (list.length === 0 && showToast) {
        toast({ title: "Nessuna campagna", description: "Nessuna campagna trovata per questa email.", variant: "destructive" })
      }
      // If no credentials in localStorage, don't auto-select - let user go to Panoramica

      return list
    } catch (e: unknown) {
      console.error(e)
      toast({ title: "Errore", description: "Impossibile recuperare le campagne.", variant: "destructive" })
      setCampaigns([]); return []
    } finally { setCampaignsLoading(false) }
  }, [toast])

  const handleSubmitCredentials = useCallback(async () => {
    if (!canSubmit) {
      toast({ title: "Errore", description: "Compila sia Bearer Token che Outbound ID.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      await apiValidateCredentials(authId.trim(), token.trim())
      saveToLocalStorage(STORAGE_KEYS.BEARER_TOKEN, authId.trim())
      saveToLocalStorage(STORAGE_KEYS.OUTBOUND_ID, token.trim())
      setShowModal(false); setAuthId(""); setToken(""); setIsConfigured(true)
      toast({ title: "Operazione riuscita", description: "Credenziali salvate correttamente!" })
      fetchCalls()
    } catch (e: unknown) {
      console.error(e)
      const message = e instanceof Error ? e.message : "Errore imprevisto."
      toast({ title: "Errore", description: message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }, [canSubmit, authId, token, toast, fetchCalls])

  /* ------------------------------- Filters UI ------------------------------ */







  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    if (user?.id) await fetchUserData(user.id, false)
    const email = userData?.email || user?.emailAddresses?.[0]?.emailAddress || ""
    if (email) await fetchCampaigns(email)
    await fetchCalls(undefined, true)
    setRefreshing(false)
  }, [refreshing, user?.id, userData?.email, user?.emailAddresses, fetchUserData, fetchCampaigns, fetchCalls])

  const handleEditCredentials = useCallback(() => {
    setAuthId(getFromLocalStorage(STORAGE_KEYS.BEARER_TOKEN) || "")
    setToken(getFromLocalStorage(STORAGE_KEYS.OUTBOUND_ID) || "")
    setShowModal(true)
  }, [])

  const closeSidebar = useCallback(() => { setSidebarOpen(false); setSelectedCall(null); setCallDetails(null) }, [])
  const handleCallClick = useCallback((call: CallData) => { setSelectedCall(call); setSidebarOpen(true); fetchCallDetails(call.id) }, [fetchCallDetails])
  const handleCloseModal = useCallback(() => { setShowModal(false); setAuthId(""); setToken("") }, [])

  /* -------------------------------- Effects -------------------------------- */

  useEffect(() => { if (isLoaded && user?.id) fetchUserData(user.id) }, [isLoaded, user?.id, fetchUserData])

  useEffect(() => {
    if (!isLoaded) return
    const email = userData?.email || user?.emailAddresses?.[0]?.emailAddress || ""
    if (email) fetchCampaigns(email)
  }, [isLoaded, userData?.email, user?.emailAddresses, fetchCampaigns])

  useEffect(() => {
    if (!isLoaded) return
    if (isConfigured) fetchCallsRef.current()
    else if (!campaignsLoading && campaigns.length === 0) setShowModal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isConfigured, campaignsLoading, campaigns.length])

  useEffect(() => {
    const handleCampaignChange = () => {
      // Re-read credentials from localStorage
      const bt = getFromLocalStorage(STORAGE_KEYS.BEARER_TOKEN)
      const oid = getFromLocalStorage(STORAGE_KEYS.OUTBOUND_ID)
      const cid = getFromLocalStorage(STORAGE_KEYS.CAMPAIGN_ID)

      if (bt && oid) {
        setIsConfigured(true)
        if (cid && campaigns.length > 0) {
          const found = campaigns.find(c => c.id === cid)
          if (found) setSelectedCampaign(found)
        }
        fetchCallsRef.current()
      } else {
        setIsConfigured(false)
        setSelectedCampaign(null)
      }
    }

    window.addEventListener('campaignChanged', handleCampaignChange)

    return () => {
      window.removeEventListener('campaignChanged', handleCampaignChange)
    }
  }, [campaigns])

  /* ------------------------------ Loading gates ----------------------------- */

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <div className="relative"><div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
          <div className="space-y-2"><h3 className="text-lg font-semibold text-slate-700">Caricamento dashboard chiamate</h3><p className="text-sm text-slate-500">Attendi mentre prepariamo le tue chiamate...</p></div>
        </div>
      </div>
    )
  }
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center space-y-4 max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-red-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-800">Autenticazione richiesta</h2>
            <p className="text-slate-600">Accedi per visualizzare la dashboard delle chiamate.</p>
          </div>
        </div>
      </div>
    )
  }

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <>
      <div className={`flex h-full bg-gray-50 ${sidebarOpen ? "overflow-hidden" : ""}`}>
        <div className={`flex-1 flex flex-col ${sidebarOpen ? "lg:mr-[840px]" : ""} transition-all duration-300`}>
          <div className="bg-white border-b border-gray-200 p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                  <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                    Dashboard Chiamate
                    {selectedCampaign && <span className="ml-2 font-medium text-slate-500">- {selectedCampaign.campaignName}</span>}
                  </h1>
                  <Badge variant="secondary" className="text-xs sm:text-sm bg-blue-100 text-blue-800">{totalCalls.toLocaleString()} totali</Badge>
                </div>
                <div className="flex w-full justify-center sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading} className="text-xs sm:text-sm bg-transparent transition-all duration-200 hover:shadow-md self-start sm:self-auto">
                    <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">Aggiorna</span><span className="sm:hidden">Ricarica</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Warning when no campaign selected */}
          {!isConfigured && (
            <div className="bg-amber-50 border-b border-amber-200 p-3 sm:p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-amber-600 mr-2" />
                <p className="text-amber-800 font-medium">Nessuna campagna selezionata</p>
              </div>
              <p className="text-amber-700 text-sm mt-1">
                Vai alla scheda Panoramica e seleziona una campagna per visualizzare le chiamate.
              </p>
            </div>
          )}

          {/* Filters */}
          {/* Filters */}
          {isConfigured && (
            <div className="bg-white border-b border-gray-200 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex space-x-2 sm:space-x-4">

                  <LimitSelector limit={filters.limit} onLimitChange={(n) => { const nf = { ...filters, limit: n, skip: 0 }; setFilters(nf); fetchCalls(nf) }} />
                </div>
              </div>
            </div>
          )}

          {/* Table / List */}
          <div className="flex-1 overflow-hidden">
            {isConfigured ? (
              callsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div className="relative"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                    <div className="space-y-2"><h3 className="text-lg font-semibold text-slate-700">Caricamento chiamate</h3><p className="text-sm text-slate-500">Recupero dei dati delle chiamate...</p></div>
                  </div>
                </div>
              ) : filteredCalls.length > 0 ? (
                <>
                  <div className="hidden lg:block h-full overflow-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Da</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 hidden 2xl:table-cell">Nome Da</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 hidden 2xl:table-cell">Email Da</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">A</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 hidden 2xl:table-cell">Nome A</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 hidden 2xl:table-cell">Email A</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Ora di inizio</th>

                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Stato</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Conversazione</th>

                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {filteredCalls.map((call) => (
                          <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => handleCallClick(call)}>
                            <td className="py-3 px-4 text-sm">{call.from || "N/D"}</td>
                            <td className="py-3 px-4 text-sm hidden 2xl:table-cell">{call.fromName || "N/D"}</td>
                            <td className="py-3 px-4 text-sm hidden 2xl:table-cell max-w-[150px] truncate" title={call.fromEmail || ""}>{call.fromEmail || "N/D"}</td>
                            <td className="py-3 px-4 text-sm">{call.to || "N/D"}</td>
                            <td className="py-3 px-4 text-sm hidden 2xl:table-cell">{call.toName || "N/D"}</td>
                            <td className="py-3 px-4 text-sm hidden 2xl:table-cell max-w-[150px] truncate" title={call.toEmail || ""}>{call.toEmail || "N/D"}</td>
                            <td className="py-3 px-4 text-sm">{formatDate(call.startTime)}</td>

                            <td className="py-3 px-4"><Badge className={getStatusBadgeColor(call.status)}>{getStatusText(call.status)}</Badge></td>
                            <td className="py-3 px-4"><Badge variant="outline">{getConversationStatusText(call.conversationStatus)}</Badge></td>

                            <td className="py-3 px-4">
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCallClick(call) }} className="transition-all duration-200 hover:shadow-md">
                                <Phone className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="lg:hidden h-full overflow-auto p-3 sm:p-4 space-y-3">
                    {filteredCalls.map((call) => (
                      <div key={call.id} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all durataion-200" onClick={() => handleCallClick(call)}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">{call.from?.slice(-2) || "??"}</div>
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium">{call.to?.slice(-2) || "??"}</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCallClick(call) }} className="h-8 w-8 p-0 transition-all duration-200 hover:shadow-md">
                            <Phone className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Da → A</span><span className="text-sm font-medium">{call.from || "N/D"} → {call.to || "N/D"}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Durata</span><span className="text-sm">{formatDuration(call.duration)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Ora di inizio</span><span className="text-xs">{formatDate(call.startTime)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Stato</span><Badge className={`${getStatusBadgeColor(call.status)} text-xs`}>{getStatusText(call.status)}</Badge></div>
                          <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Conversazione</span><Badge variant="outline" className="text-xs">{getConversationStatusText(call.conversationStatus)}</Badge></div>

                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-12 px-4">
                  <div className="text-center">
                    <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna chiamata trovata</h3>
                    <p className="text-gray-500 mb-4 text-sm sm:text-base">{filters.statuses.length > 0 ? "Prova a modificare i filtri" : "Non ci sono chiamate che corrispondono ai criteri attuali."}</p>
                    <Button onClick={() => fetchCalls(undefined, true)} size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <RefreshCw className="h-4 w-4 mr-2" /> Aggiorna
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center py-12 px-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4"><Edit className="w-8 h-8 text-slate-400" /></div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Configurazione richiesta</h3>
                  <p className="text-gray-500 mb-4 text-sm sm:text-base">Configura le credenziali API per visualizzare le chiamate</p>
                  <Button onClick={handleEditCredentials} size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"><Edit className="h-4 w-4 mr-2" /> Aggiungi credenziali</Button>
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {isConfigured && filteredCalls.length > 0 && (
            <div className="bg-white border-t border-gray-200 px-4 py-3 sm:px-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-700">
                  Showing {Math.min(filters.skip + 1, Math.max(totalCalls, 0))} to{" "}
                  {Math.min(filters.skip + filteredCalls.length, totalCalls)} of {totalCalls.toLocaleString()} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => { const newSkip = Math.max(0, filters.skip - filters.limit); const nf = { ...filters, skip: newSkip }; setFilters(nf); fetchCalls(nf) }}
                    disabled={filters.skip === 0 || callsLoading}
                    variant="outline" size="sm" className="flex items-center gap-1"
                  >
                    ← Previous
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    Page {Math.floor(filters.skip / filters.limit) + 1} of {Math.max(1, Math.ceil(totalCalls / filters.limit))}
                  </span>
                  <Button
                    onClick={() => { const newSkip = filters.skip + filters.limit; const nf = { ...filters, skip: newSkip }; setFilters(nf); fetchCalls(nf) }}
                    disabled={(filters.skip + filters.limit) >= totalCalls || callsLoading}
                    variant="outline" size="sm" className="flex items-center gap-1"
                  >
                    Next →
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && selectedCall && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={closeSidebar} />
            <div className="fixed right-0 top-0 h-full w-full lg:w-[840px] bg-white border-l border-gray-200 shadow-xl overflow-y-auto z-50">
              <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden">
                  <div className="flex items-center flex-shrink-0">
                    <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">{selectedCall.from?.slice(-2) || "??"}</div>
                    <ArrowRight className="h-4 w-4 mx-2 text-gray-400" />
                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">{selectedCall.to?.slice(-2) || "??"}</div>
                  </div>
                  <div className="truncate text-sm font-medium">{selectedCall.from} → {selectedCall.to}</div>
                  <Badge className={cn(getStatusBadgeColor(selectedCall.status), "truncate max-w-[160px]")}>{getStatusText(selectedCall.status)}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSidebarOpen(false) }} className="ml-2 flex-shrink-0"><X className="h-4 w-4" /></Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-3 sm:p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-slate-800">Tag</h3>
                    <div className="flex flex-wrap gap-2">
                      {(callDetails?.tags ?? selectedCall?.tags ?? []).map((tag, i) => (
                        <Badge key={`${tag}-${i}`} variant="secondary" className="px-2 py-1 text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>

                  {callDetails?.summary && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-slate-800">Riepilogo</h3>
                      <p className="text-sm text-gray-700 bg-gradient-to-r from-slate-50 to-slate-100 p-3 rounded-lg leading-relaxed border border-slate-200">{callDetails.summary}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-slate-800">Dettagli chiamata</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border-b sm:border-b-0 sm:border-r">Nome lead</div>
                      <div className="px-3 py-2 text-xs sm:text-sm sm:col-span-2 border-b">{callDetails?.name || "—"}</div>
                      <div className="px-3 py-2 text-xs sm:text-sm bg-gray-50 sm:border-r">Durata</div>
                      <div className="px-3 py-2 text-xs sm:text-sm sm:col-span-2 border-t sm:border-t-0">{callDetails ? formatDuration(callDetails.duration) : formatDuration(selectedCall.duration)}</div>
                      <div className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border-t sm:border-r">Stato</div>
                      <div className="px-3 py-2 text-xs sm:text-sm sm:col-span-2 border-t"><Badge className={getStatusBadgeColor(callDetails?.status ?? selectedCall.status)}>{getStatusText(callDetails?.status ?? selectedCall.status)}</Badge></div>
                      <div className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border-t sm:border-r">Sentiment</div>
                      <div className="px-3 py-2 text-xs sm:text-sm sm:col-span-2 border-t"><span className={cn("font-medium", getSentimentColor(callDetails?.overallSentiment ?? 3))}>{getSentimentText(callDetails?.overallSentiment ?? 3)}</span></div>
                      <div className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border-t sm:border-r">Ora di inizio</div>
                      <div className="px-3 py-2 text-xs sm:text-sm sm:col-span-2 border-t">{formatDate(callDetails?.startTime ?? selectedCall.startTime)}</div>
                      <div className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border-t sm:border-r">Conversazione</div>
                      <div className="px-3 py-2 text-xs sm:text-sm sm:col-span-2 border-t"><Badge variant="outline">{getConversationStatusText(callDetails?.conversationStatus ?? selectedCall.conversationStatus)}</Badge></div>
                    </div>
                  </div>

                  {callDetails?.collectedInfo && callDetails.collectedInfo.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-slate-800">Variabili</h3>
                      <div className="divide-y border rounded-lg">
                        {callDetails.collectedInfo.map((info) => (
                          <div key={info.id} className="grid grid-cols-1 sm:grid-cols-3">
                            <div className="px-3 py-2 text-xs sm:text-sm bg-gray-50">{info.name}</div>
                            <div className="px-3 py-2 text-xs sm:text-sm sm:col-span-2 break-words">{String(info.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="">
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setActiveRightTab("transcript")} className={cn("text-xs sm:text-sm px-3 py-1.5 rounded-md border", activeRightTab === "transcript" ? "bg-white shadow-sm" : "bg-white/60")}>Trascrizione</button>
                    <button onClick={() => setActiveRightTab("events")} className={cn("text-xs sm:text-sm px-3 py-1.5 rounded-md border", activeRightTab === "events" ? "bg-white shadow-sm" : "bg-white/60")}>Registro eventi</button>
                  </div>

                  <div className="space-y-4">
                    {activeRightTab === "transcript" && (
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 sm:p-4 max-h-[520px] overflow-y-auto border border-slate-200">
                        {callDetailsLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>}
                        {!callDetailsLoading && callDetails?.transcript && callDetails.transcript.length > 0 ? (
                          callDetails.transcript.map((m, i) => {
                            const isPearl = m.role === 2
                            const isClient = m.role === 3
                            const label = isPearl ? "Agente" : isClient ? "Cliente" : "Sconosciuto"
                            const cls = isPearl
                              ? "px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-sm border border-slate-200 bg-slate-50 text-slate-800"
                              : isClient
                                ? "px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-sm border border-blue-200 bg-blue-50 text-slate-800"
                                : "px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-sm border text-slate-800 bg-white"
                            return (
                              <div key={i} className="mb-3 sm:mb-4">
                                <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-slate-600">{label}</span></div>
                                <div className={cls}><p className="text-sm leading-relaxed break-words">{m.content}</p></div>
                              </div>
                            )
                          })
                        ) : !callDetailsLoading && <div className="text-sm text-gray-500">Nessuna trascrizione disponibile.</div>}
                      </div>
                    )}

                    {activeRightTab === "events" && (
                      <div className="bg-white border rounded-lg p-4 text-sm text-gray-500">
                        I dati del registro eventi non sono disponibili per questa chiamata.
                      </div>
                    )}

                    {callDetails?.recording && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2 text-slate-800">Registrazione</h3>
                        <div className="space-y-2">
                          <audio controls className="w-full"><source src={callDetails.recording} type="audio/mpeg" />Il tuo browser non supporta l&lsquo;elemento audio.</audio>
                          <Button variant="outline" size="sm" className="w-full bg-transparent text-sm transition-all durataion-200 hover:shadow-md" onClick={() => window.open(callDetails.recording!, "_blank")}>Scarica registrazione</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!callDetails && callDetailsLoading && (
                <div className="p-6">
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-4">
                      <div className="relative"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                      <div className="space-y-2"><h3 className="text-sm font-semibold text-slate-700">Caricamento dettagli chiamata</h3><p className="text-xs text-slate-500">Recupero delle informazioni dettagliate...</p></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Credentials Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="sm:max-w-[500px] mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <DialogHeader className="space-y-4 pb-6 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center"><Phone className="w-6 h-6 text-white" /></div>
                <div>
                  <DialogTitle className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                    {isConfigured ? "Aggiorna credenziali API" : "Configura credenziali API"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-600 mt-1">
                    {isConfigured ? "Aggiorna il tuo Bearer Token e l'Outbound ID qui sotto per continuare ad accedere alle chiamate." : "Fornisci il tuo Bearer Token e l'Outbound ID per accedere ai dati delle chiamate."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="py-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="authId" className="text-sm font-semibold text-slate-700 flex items-center"><Phone className="w-4 h-4 mr-2 text-slate-500" />Bearer Token</Label>
                  <Input id="authId" value={authId} onChange={(e) => setAuthId(e.target.value)} placeholder="Inserisci il tuo Bearer Token" disabled={submitting} className="h-12 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200" />
                  <p className="text-xs text-slate-500">Questo è il tuo Bearer Token per l&apos;autenticazione API</p>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="token" className="text-sm font-semibold text-slate-700 flex items-center"><Edit className="w-4 h-4 mr-2 text-slate-500" />Outbound ID</Label>
                  <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Inserisci il tuo Outbound ID" disabled={submitting} className="h-12 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-all durataion-200" />
                  <p className="text-xs text-slate-500">Questo è il tuo Outbound ID per accedere ai dati delle chiamate</p>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-6 border-t border-slate-100 gap-3">
              <Button variant="outline" onClick={handleCloseModal} disabled={submitting} className="w-full sm:w-auto text-sm bg-transparent hover:bg-slate-50 transition-all durataion-200 hover:shadow-md px-6">
                <X className="w-4 h-4 mr-2" /> Annulla
              </Button>
              <Button onClick={handleSubmitCredentials} disabled={!canSubmit} className="w-full sm:w-auto text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all durataion-200 hover:shadow-lg px-6">
                {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isConfigured ? "Aggiornamento..." : "Salvataggio..."}</>) : (isConfigured ? "Aggiorna credenziali" : "Salva credenziali")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster />
    </>
  )
}

/* ------------------------------ Helpers ------------------------------ */

function getStatusBadgeColor(s: number) {
  switch (s) {
    case 100:
    case 130:
    case 4: return "bg-green-100 text-green-800"
    case 6:
    case 110:
    case 500: return "bg-red-100 text-red-800"
    case 3:
    case 40: return "bg-blue-100 text-blue-800"
    case 5:
    case 7:
    case 8:
    case 70: return "bg-purple-100 text-purple-800"
    case 1:
    case 10:
    case 20: return "bg-yellow-100 text-yellow-800"
    default: return "bg-gray-100 text-gray-800"
  }
}
