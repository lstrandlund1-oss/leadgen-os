// lib/deep/extractDeepWebsiteSignals.ts
//
// Deterministic deep website signal extraction.
// Inputs come from a full page fetch/parse (HTML, response headers, timing).
// All logic is rule-based — no ML, no external calls beyond the initial fetch.

import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";

export interface DeepWebsiteInput {
  hasH1: boolean;
  h1Count: number;
  hasMetaDescription: boolean;
  metaDescriptionLength: number | null;
  internalLinkCount: number;
  imageCount: number;
  imagesWithAlt: number;
  ctaButtonCount: number;
  primaryCtaText: string | null;
  hasPhoneNumber: boolean;
  hasContactForm: boolean;
  hasOnlineBooking: boolean;
  pageSizeKb: number | null;
  loadTimeMs: number | null;
  hasLazyLoading: boolean;
  hasCssMinified: boolean;
  hasJsMinified: boolean;
  hasSSL: boolean;
  hasCookieBanner: boolean;
  hasPrivacyPolicy: boolean;
  hasReviewWidget: boolean;
  hasSocialProof: boolean;
  hasViewportMeta: boolean;
}

export interface DeepWebsiteResult {
  signals: Signal[];
  scores: {
    seoStructure: number;
    ctaStrength: number;
    pageSpeed: number;
    trustLayer: number;
  };
  summary: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function extractDeepWebsiteSignals(input: DeepWebsiteInput): DeepWebsiteResult {
  // CTA strength
  let cta = 0;
  if (input.hasOnlineBooking) cta += 40;
  else if (input.hasContactForm) cta += 25;
  else if (input.hasPhoneNumber) cta += 15;
  if (input.ctaButtonCount >= 1) cta += 15;
  if (input.ctaButtonCount >= 3) cta += 10;
  const ctaLower = (input.primaryCtaText ?? "").toLowerCase();
  if (["book", "get a quote", "free", "start", "schedule", "call now"].some((p) => ctaLower.includes(p))) cta += 20;
  const ctaStrength = clamp(cta);

  // SEO structure
  let seo = 0;
  if (input.hasH1 && input.h1Count === 1) seo += 25;
  else if (input.hasH1) seo += 10;
  if (input.hasMetaDescription) {
    const len = input.metaDescriptionLength ?? 0;
    seo += (len >= 120 && len <= 160) ? 25 : 15;
  }
  const altRatio = input.imageCount > 0 ? input.imagesWithAlt / input.imageCount : 1;
  seo += Math.round(altRatio * 20);
  if (input.internalLinkCount >= 5) seo += 15;
  else if (input.internalLinkCount >= 2) seo += 8;
  if (input.hasSSL) seo += 15;
  const seoStructure = clamp(seo);

  // Page speed
  let spd = 80;
  if (input.pageSizeKb !== null) {
    if (input.pageSizeKb > 3000) spd -= 30;
    else if (input.pageSizeKb > 1500) spd -= 15;
    else if (input.pageSizeKb > 800) spd -= 5;
  }
  if (input.loadTimeMs !== null) {
    if (input.loadTimeMs > 5000) spd -= 35;
    else if (input.loadTimeMs > 3000) spd -= 20;
    else if (input.loadTimeMs > 1500) spd -= 10;
    else if (input.loadTimeMs < 800) spd += 10;
  }
  if (input.hasCssMinified) spd += 5;
  if (input.hasJsMinified) spd += 5;
  if (input.hasLazyLoading) spd += 5;
  const pageSpeed = input.pageSizeKb === null && input.loadTimeMs === null ? 50 : clamp(spd);

  // Trust layer
  let trust = 0;
  if (input.hasSSL) trust += 20;
  if (input.hasPrivacyPolicy) trust += 15;
  if (input.hasReviewWidget) trust += 25;
  if (input.hasSocialProof) trust += 20;
  if (input.hasCookieBanner) trust += 10;
  if (input.hasViewportMeta) trust += 10;
  const trustLayer = clamp(trust);

  const signals: Signal[] = [
    buildSignal({
      key: "website_seo_structure_score",
      value: seoStructure,
      confidence: 80,
      depth: "deep",
      present: seoStructure >= 60,
      description:
        seoStructure >= 70 ? "Strong SEO structure: clean H1, meta, alt text, SSL."
        : seoStructure >= 45 ? "Partial SEO structure — missing elements limit visibility."
        : "Weak SEO structure. No clear H1, missing meta, poor alt coverage.",
    }),
    buildSignal({
      key: "website_cta_strength",
      value: ctaStrength,
      confidence: 85,
      depth: "deep",
      present: ctaStrength >= 50,
      description:
        ctaStrength >= 70 ? "Strong conversion path: booking or form with compelling CTA."
        : ctaStrength >= 40 ? "Moderate CTA. Booking exists but intent signals are weak."
        : "Weak CTA. No booking system, minimal contact options.",
    }),
    buildSignal({
      key: "website_page_speed_score",
      value: pageSpeed,
      confidence: input.loadTimeMs !== null ? 85 : 55,
      depth: "deep",
      present: pageSpeed >= 60,
      description:
        pageSpeed >= 75 ? "Fast, optimised site. Good technical foundation."
        : pageSpeed >= 50 ? "Average speed. Optimisation opportunities exist."
        : "Slow or heavy site. Speed is a conversion and SEO liability.",
    }),
  ];

  const summary =
    ctaStrength < 40 ? "Primary gap: conversion infrastructure. No booking or strong CTA."
    : seoStructure < 45 ? "Primary gap: SEO structure. Poor technical foundation."
    : pageSpeed < 50 ? "Primary gap: page speed. Slow load times suppressing conversions."
    : trustLayer < 40 ? "Primary gap: trust signals. No reviews widget or social proof."
    : "Site has solid foundations. Optimisation-stage improvements available.";

  return { signals, scores: { seoStructure, ctaStrength, pageSpeed, trustLayer }, summary };
}