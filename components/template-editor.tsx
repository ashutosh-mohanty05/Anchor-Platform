"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Copy, Share2, Pencil, Trash2, RotateCcw, Check, Plus, Instagram,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fillTemplate, waLink } from "@/lib/utils";
import { TEMPLATE_CATEGORIES } from "@/lib/constants";
import type { IMessageTemplate } from "@/models/MessageTemplate";

type TemplateLite = IMessageTemplate & { _id: string };

const SAMPLE_VALUES = {
  client_name: "Rohan Mehta",
  event_name: "Sangeet Ceremony",
  event_date: "28 Sep 2024",
  event_time: "7:00 PM",
  venue: "The Westin, Pune",
  fee: "₹25,000",
  advance_amount: "₹10,000",
  vaishnavi_name: "Vaishnavi",
  event_type: "Corporate Event",
};

export default function TemplateEditor() {
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TemplateLite | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/templates").then((r) => r.json());
    setTemplates(res.templates ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const categories = ["All", ...TEMPLATE_CATEGORIES];
  const filtered = activeCategory === "All" ? templates : templates.filter((t) => t.category === activeCategory);

  async function copy(t: TemplateLite) {
    const text = fillTemplate(t.body, SAMPLE_VALUES);
    await navigator.clipboard.writeText(text);
    setCopiedId(t._id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function shareWhatsApp(t: TemplateLite) {
    const text = fillTemplate(t.body, SAMPLE_VALUES);
    window.open(waLink("", text), "_blank");
  }

  async function shareToInstagramOrOthers(t: TemplateLite) {
    const text = fillTemplate(t.body, SAMPLE_VALUES);
    if (navigator.share) {
      try {
        await navigator.share({ title: t.title, text });
        return;
      } catch {
        // user cancelled the native share sheet -- fall through to copy
      }
    }
    // No native share sheet available (most desktop browsers): copy the
    // text and open Instagram so it can be pasted into a DM/Story caption.
    await navigator.clipboard.writeText(text);
    window.open("https://instagram.com", "_blank");
  }

  async function shareToInstagramOrOther(t: TemplateLite) {
    const text = fillTemplate(t.body, SAMPLE_VALUES);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t.title, text });
        return;
      } catch {
        // user cancelled the native share sheet -- fall through to copy
      }
    }
    await navigator.clipboard.writeText(text);
    setCopiedId(t._id);
    setTimeout(() => setCopiedId(null), 1500);
    alert("Message copied! Open Instagram and paste it into a DM, Story, or caption.");
  }

  async function duplicate(t: TemplateLite) {
    await fetch(`/api/templates/${t._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate" }),
    });
    load();
  }

  async function resetDefault(t: TemplateLite) {
    await fetch(`/api/templates/${t._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    load();
  }

  async function remove(t: TemplateLite) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await fetch(`/api/templates/${t._id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Message Templates</h1>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto stage-scrollbar pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeCategory === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <Card className="text-center text-sm text-muted-foreground">No templates in this category yet.</Card>
      )}

      <div className="space-y-3">
        {filtered.map((t) => (
          <Card key={t._id}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold">{t.title}</h3>
                <Badge variant="outline" className="mt-1">{t.category}</Badge>
              </div>
            </div>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{fillTemplate(t.body, SAMPLE_VALUES)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => copy(t)}>
                {copiedId === t._id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedId === t._id ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => shareWhatsApp(t)}>
                <Share2 className="h-3.5 w-3.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="secondary" onClick={() => shareToInstagramOrOthers(t)}>
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </Button>
              <Button size="sm" variant="secondary" onClick={() => shareToInstagramOrOther(t)}>
                <Instagram className="h-3.5 w-3.5" /> Instagram / Share
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => duplicate(t)}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              {t.isDefault ? (
                <Button size="sm" variant="ghost" onClick={() => resetDefault(t)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <TemplateFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        template={editing}
        onSaved={load}
      />
      <TemplateFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={load}
      />
    </div>
  );
}

function TemplateFormDialog({
  open, onOpenChange, template, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template?: TemplateLite | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [category, setCategory] = useState(template?.category ?? "Custom");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(template?.title ?? "");
    setCategory(template?.category ?? "Custom");
    setBody(template?.body ?? "");
  }, [template, open]);

  async function save() {
    setSaving(true);
    const url = template ? `/api/templates/${template._id}` : "/api/templates";
    const method = template ? "PATCH" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, body }),
    });
    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1.5" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Use placeholders like {"{{client_name}}"}, {"{{event_date}}"}, {"{{venue}}"}, {"{{fee}}"}
            </p>
          </div>
          <Button className="w-full" onClick={save} disabled={saving || !title || !body}>
            Save Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
