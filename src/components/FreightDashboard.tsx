import { FormEvent, useEffect, useMemo, useState } from "react";
import "./FreightDashboard.css";

export type FreightStatus = "draft" | "submitted" | "approved" | "posted" | "assigned" | "in_transit" | "delivered" | "cancelled";
type FreightNote = { id: string; author: string; body: string; createdAt: string };
type FreightApproval = { id: string; approvedBy: string; note: string; createdAt: string };
export type FreightLoad = {
  id: string; reference: string; origin: string; destination: string; commodity: string;
  equipmentType: string; pickupDate: string; offeredRate: string; status: FreightStatus;
  createdAt: string; notes: FreightNote[]; approvals: FreightApproval[];
};
type DraftLoad = Pick<FreightLoad, "reference" | "origin" | "destination" | "commodity" | "equipmentType" | "pickupDate" | "offeredRate">;

const STORAGE_KEY = "cladex.freight-loads.v1";
const STATUS_ORDER: FreightStatus[] = ["draft", "submitted", "approved", "posted", "assigned", "in_transit", "delivered", "cancelled"];
const STATUS_LABELS: Record<FreightStatus, string> = { draft: "Draft", submitted: "Submitted", approved: "Approved", posted: "Posted", assigned: "Assigned", in_transit: "In transit", delivered: "Delivered", cancelled: "Cancelled" };
const NEXT_STATUS: Partial<Record<FreightStatus, FreightStatus>> = { draft: "submitted", approved: "posted", posted: "assigned", assigned: "in_transit", in_transit: "delivered" };
const EMPTY_DRAFT: DraftLoad = { reference: "", origin: "", destination: "", commodity: "", equipmentType: "", pickupDate: "", offeredRate: "" };
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const stamp = () => new Date().toISOString();

function loadStoredLoads(): FreightLoad[] {
  if (typeof window === "undefined") return [];
  try { const saved = window.localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) as FreightLoad[] : []; } catch { return []; }
}
function formatStatus(status: FreightStatus) { return STATUS_LABELS[status]; }
function formatDate(value: string) { if (!value) return "Not scheduled"; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
function nextAction(status: FreightStatus) { if (status === "submitted") return "Approve"; if (status === "cancelled" || status === "delivered") return null; const next = NEXT_STATUS[status]; return next ? `Mark ${formatStatus(next)}` : null; }

export default function FreightDashboard() {
  const [loads, setLoads] = useState<FreightLoad[]>(loadStoredLoads);
  const [draft, setDraft] = useState<DraftLoad>(EMPTY_DRAFT);
  const [filter, setFilter] = useState<FreightStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loads)); } catch { setMessage("Changes are visible for this session, but could not be saved in this browser."); } }, [loads]);
  const visibleLoads = useMemo(() => loads.filter((load) => filter === "all" || load.status === filter), [filter, loads]);
  const selectedLoad = loads.find((load) => load.id === selectedId) ?? null;
  const counts = useMemo(() => STATUS_ORDER.reduce<Record<FreightStatus, number>>((total, status) => { total[status] = loads.filter((load) => load.status === status).length; return total; }, {} as Record<FreightStatus, number>), [loads]);

  function createLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = Object.entries(draft).filter(([, value]) => !value.trim()).map(([key]) => key);
    if (missing.length) { setMessage("Please complete every load field before saving."); return; }
    const created: FreightLoad = { id: makeId(), ...draft, status: "draft", createdAt: stamp(), notes: [{ id: makeId(), author: "Dispatcher", body: "Load created manually.", createdAt: stamp() }], approvals: [] };
    setLoads((current) => [created, ...current]); setDraft(EMPTY_DRAFT); setSelectedId(created.id); setMessage(`Load ${created.reference} was saved as a draft.`);
  }
  function addNote() {
    if (!selectedLoad || !note.trim()) return;
    const newNote: FreightNote = { id: makeId(), author: "Dispatcher", body: note.trim(), createdAt: stamp() };
    setLoads((current) => current.map((load) => load.id === selectedLoad.id ? { ...load, notes: [...load.notes, newNote] } : load)); setNote("");
  }
  function moveLoad(load: FreightLoad) {
    if (load.status === "submitted") {
      if (!approvalNote.trim()) { setMessage("Enter an approval note before approving this load."); return; }
      const approvedAt = stamp(); const approval: FreightApproval = { id: makeId(), approvedBy: "Dispatcher", note: approvalNote.trim(), createdAt: approvedAt };
      setLoads((current) => current.map((item) => item.id === load.id ? { ...item, status: "approved", approvals: [...item.approvals, approval], notes: [...item.notes, { id: makeId(), author: "Dispatcher", body: "Load approved manually.", createdAt: approvedAt }] } : item));
      setApprovalNote(""); setMessage(`Load ${load.reference} was approved.`); return;
    }
    const status = NEXT_STATUS[load.status]; if (!status) return;
    const changedAt = stamp(); setLoads((current) => current.map((item) => item.id === load.id ? { ...item, status, notes: [...item.notes, { id: makeId(), author: "Dispatcher", body: `Status changed to ${formatStatus(status)}.`, createdAt: changedAt }] } : item)); setMessage(`Load ${load.reference} is now ${formatStatus(status)}.`);
  }
  function cancelLoad(load: FreightLoad) {
    if (load.status === "cancelled" || load.status === "delivered") return;
    const cancelledAt = stamp(); setLoads((current) => current.map((item) => item.id === load.id ? { ...item, status: "cancelled", notes: [...item.notes, { id: makeId(), author: "Dispatcher", body: "Load cancelled manually.", createdAt: cancelledAt }] } : item)); setMessage(`Load ${load.reference} was cancelled.`);
  }

  return <section className="freight-dashboard" aria-label="Live Freight Loads">
    <header className="freight-dashboard__header"><div><p className="freight-dashboard__eyebrow">Operations workspace</p><h1>Live Freight Loads</h1><p className="freight-dashboard__subhead">Manual dispatch board. No booking, carrier contact, payment, or automatic status changes.</p></div><div className="freight-dashboard__total"><strong>{loads.length}</strong><span>loads tracked</span></div></header>
    {message && <div className="freight-dashboard__notice" role="status">{message}</div>}
    <div className="freight-dashboard__summary" aria-label="Load status summary">{STATUS_ORDER.map((status) => <button className={`freight-dashboard__count ${filter === status ? "is-active" : ""}`} key={status} onClick={() => setFilter(filter === status ? "all" : status)} type="button"><span>{formatStatus(status)}</span><strong>{counts[status]}</strong></button>)}</div>
    <div className="freight-dashboard__grid"><form className="freight-dashboard__form" onSubmit={createLoad}><div className="freight-dashboard__section-title"><h2>Create load</h2><span>Manual entry only</span></div><label>Load reference<input value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder="LD-1001" /></label><label>Origin<input value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} placeholder="Austin, TX" /></label><label>Destination<input value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} placeholder="Dallas, TX" /></label><label>Commodity<input value={draft.commodity} onChange={(event) => setDraft({ ...draft, commodity: event.target.value })} placeholder="Palletized goods" /></label><label>Equipment<input value={draft.equipmentType} onChange={(event) => setDraft({ ...draft, equipmentType: event.target.value })} placeholder="Dry van" /></label><div className="freight-dashboard__form-row"><label>Pickup date<input type="date" value={draft.pickupDate} onChange={(event) => setDraft({ ...draft, pickupDate: event.target.value })} /></label><label>Offered rate<input value={draft.offeredRate} onChange={(event) => setDraft({ ...draft, offeredRate: event.target.value })} placeholder="$1,250" /></label></div><button className="freight-dashboard__primary" type="submit">Save draft load</button></form>
    <div className="freight-dashboard__board"><div className="freight-dashboard__board-head"><div><h2>Load board</h2><p>{filter === "all" ? "All active and historical loads" : `${formatStatus(filter)} loads`}</p></div><button className="freight-dashboard__filter" onClick={() => setFilter("all")} type="button">Show all</button></div>{visibleLoads.length === 0 ? <div className="freight-dashboard__empty"><strong>No loads here yet.</strong><span>Create a load to begin your manual workflow.</span></div> : <div className="freight-dashboard__load-list">{visibleLoads.map((load) => { const action = nextAction(load.status); return <article className="freight-dashboard__load" key={load.id}><button className="freight-dashboard__load-main" onClick={() => setSelectedId(load.id)} type="button"><span className="freight-dashboard__load-reference">{load.reference}</span><span className="freight-dashboard__route">{load.origin} <b>→</b> {load.destination}</span><span className="freight-dashboard__commodity">{load.commodity} · {load.equipmentType}</span></button><div className="freight-dashboard__load-meta"><span className={`freight-dashboard__badge status-${load.status}`}>{formatStatus(load.status)}</span><span>{formatDate(load.pickupDate)}</span><strong>{load.offeredRate}</strong></div><div className="freight-dashboard__actions">{action && <button className="freight-dashboard__action" onClick={() => moveLoad(load)} type="button">{action}</button>}{load.status !== "cancelled" && load.status !== "delivered" && <button className="freight-dashboard__danger" onClick={() => cancelLoad(load)} type="button">Cancel</button>}</div></article>; })}</div>}</div></div>
    {selectedLoad && <aside className="freight-dashboard__detail" aria-label={`Load details for ${selectedLoad.reference}`}><div className="freight-dashboard__detail-head"><div><p>Load details</p><h2>{selectedLoad.reference}</h2></div><button onClick={() => setSelectedId(null)} type="button" aria-label="Close load details">×</button></div><div className="freight-dashboard__detail-grid"><span>Route</span><strong>{selectedLoad.origin} → {selectedLoad.destination}</strong><span>Freight</span><strong>{selectedLoad.commodity} · {selectedLoad.equipmentType}</strong><span>Pickup</span><strong>{formatDate(selectedLoad.pickupDate)}</strong><span>Rate</span><strong>{selectedLoad.offeredRate}</strong></div>{selectedLoad.status === "submitted" && <label className="freight-dashboard__approval">Approval note<textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Documents and rate reviewed" /><button className="freight-dashboard__primary" onClick={() => moveLoad(selectedLoad)} type="button">Approve load</button></label>}<div className="freight-dashboard__history"><h3>Approval history</h3>{selectedLoad.approvals.length ? selectedLoad.approvals.map((approval) => <p key={approval.id}><strong>{approval.approvedBy}</strong> approved · {approval.note}</p>) : <p>No approval recorded.</p>}</div><div className="freight-dashboard__history"><h3>Activity notes</h3>{selectedLoad.notes.map((entry) => <p key={entry.id}><strong>{entry.author}</strong> · {entry.body}</p>)}</div><label className="freight-dashboard__add-note">Add internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Visible only in this browser for now" /><button className="freight-dashboard__action" onClick={addNote} type="button">Save note</button></label></aside>}
  </section>;
}
