// Client onboarding templates: presets that pre-configure a new client's
// channels and report setup in one click.

import db from "./db";

export interface OnboardingTemplate {
  id: string;
  name: string;
  blurb: string;
  channels: string[];
}

export const TEMPLATES: OnboardingTemplate[] = [
  {
    id: "ppc",
    name: "PPC only",
    blurb: "Paid search + paid social. For clients running Google and Meta ads.",
    channels: ["Google Ads", "Meta Ads"],
  },
  {
    id: "seo_ppc",
    name: "SEO + PPC",
    blurb: "Search ads plus organic. For clients investing in both channels.",
    channels: ["Google Ads", "Meta Ads", "Organic"],
  },
  {
    id: "full",
    name: "Full service",
    blurb: "Every major channel. For retainer clients with multi-channel spend.",
    channels: ["Google Ads", "Meta Ads", "TikTok Ads", "Email", "Display"],
  },
];

export function getTemplate(id: string): OnboardingTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Apply a template to a client: records the template and pre-configures an
 * active monthly report schedule (recipients to be filled in later).
 */
export function applyTemplate(clientId: number, templateId: string): OnboardingTemplate {
  const t = getTemplate(templateId);
  if (!t) throw new Error("Unknown onboarding template.");
  const tx = db.transaction(() => {
    db.prepare("UPDATE clients SET template = ? WHERE id = ?").run(templateId, clientId);
    db.prepare(
      `INSERT INTO report_schedules (client_id, frequency, recipients, active)
       VALUES (?, 'monthly', '', 1)`
    ).run(clientId);
  });
  tx();
  return t;
}
