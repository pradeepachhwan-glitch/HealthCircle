import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { mailtoUrl, whatsappUrl } from "@/lib/contact";

export type ContactChannel = "email" | "whatsapp";

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ContactChannel;
  /** Optional preset subject / topic — e.g. "Doctor Onboarding". */
  topic?: string;
}

export function ContactModal({ open, onOpenChange, channel, topic }: ContactModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const channelLabel = channel === "email" ? "Email" : "WhatsApp";
  const heading = topic ? `${topic} — ${channelLabel}` : `Contact us via ${channelLabel}`;

  function reset() {
    setName(""); setEmail(""); setContact(""); setQuery("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !query.trim()) return;
    setSubmitting(true);

    const subject = topic ? `${topic} – HealthCircle` : "HealthCircle Enquiry";
    const body = [
      "Hi HealthCircle Team,",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Contact: ${contact || "(not provided)"}`,
      `Topic: ${topic ?? "General"}`,
      "",
      "Query:",
      query,
      "",
      "Thank you",
    ].join("\n");

    if (channel === "email") {
      window.location.href = mailtoUrl(subject, body);
    } else {
      window.open(whatsappUrl(body), "_blank", "noopener,noreferrer");
    }

    setTimeout(() => {
      setSubmitting(false);
      reset();
      onOpenChange(false);
    }, 400);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            Share a few details and we'll get back within 24 hours.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cm-name">Name <span className="text-red-500">*</span></Label>
            <Input id="cm-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cm-email">Email <span className="text-red-500">*</span></Label>
            <Input id="cm-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cm-contact">Contact number</Label>
            <Input id="cm-contact" type="tel" value={contact} onChange={e => setContact(e.target.value)} placeholder="+91 9XXXX XXXXX (optional)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cm-query">Your query <span className="text-red-500">*</span></Label>
            <Textarea id="cm-query" required value={query} onChange={e => setQuery(e.target.value)} rows={4} placeholder="How can we help?" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Opening…" : channel === "email" ? "Send via Email" : "Send via WhatsApp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
