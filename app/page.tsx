"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { MOBILE_NEBULA_ENABLED } from "@/lib/config/mobileVisuals";
import { runLandingAnimations } from "./landingAnimations";
import "./landingPage.css";

// ─────────────────────────────────────────────────────────────────────────
// This page's visual content (hero through the final CTA) is rendered from
// a single static HTML/CSS block below rather than as idiomatic JSX. That
// block was built and hand-tuned as a static demo (canvas-based nebula
// rendering, a scripted hero animation timeline, scroll-triggered card
// effects, etc.) and is intentionally kept close to that original markup —
// converting every inline style and animation timing to React state would
// be a much larger, riskier rewrite for no behavioural benefit. Anything
// that depends on real app state (the auth-aware header/footer links,
// waitlist count, mobile gating) is wired up as real React below and sits
// around this block. The animation logic itself lives in
// ./landingAnimations.js — see runLandingAnimations for why that's plain JS.
// ─────────────────────────────────────────────────────────────────────────

const SECTIONS_HTML = `<div class="hero">
  <div class="aurora-blob-a"></div>
  <div class="aurora-blob-b"></div>
  <div class="aurora-blob-c"></div>
  <div class="stars-small"></div>

  <div style="position:relative; z-index:2;">
    <p class="eyebrow">Know Who Deserves Your Next Hour</p>
    <h1 class="serif" style="font-size:clamp(38px,5vw,58px); font-weight:300; line-height:1.1;">Most of your list<br><span class="gold">was never going to buy.</span></h1>
    <p style="font-size:18px; color:#9c9689; max-width:600px; margin:22px auto 40px; font-weight:300;">Vantio finds the leads worth your time, explains why they're a good fit and gives you the tools to reach out.</p>
    <a href="/login" class="btn-outline" onclick="this.classList.add('pressed');">Join the beta →</a>
  </div>

  <div class="demo-wrap">
    <div class="demo-glow"></div>
    <div id="cursor-el">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 2l14 6-6 2-2 6z" fill="#f5f0e8" stroke="#080808" stroke-width="1"/></svg>
      <div class="click-ring" id="click-ring"></div>
    </div>
    <div class="chrome">
      <div class="chrome-topline"></div>
      <div class="chrome-bar">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        <div style="flex:1; text-align:center; font-size:9px; color:#8a8478;" class="mono" id="bar-label">vantioapp.com — Lead Tool</div>
      </div>

      <div class="stage">
        <div id="phase1">
          <div class="search-bar" id="search-bar">
            <span style="color:#fac93f; font-size:14px; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">⌕</span>
            <span style="font-size:14px; color:#e0d8c8;" id="typed-text"></span><span class="cursor" id="cursor"></span>
            <div class="search-submit" id="search-submit">SCAN</div>
          </div>

          <div id="loading-block">
            <svg class="loader-ring" viewBox="0 0 64 64">
              <circle class="loader-track" cx="32" cy="32" r="28"/>
              <circle class="loader-fill" cx="32" cy="32" r="28" stroke-dasharray="140 176"/>
            </svg>
            <p class="status-text mono" id="status-text">Scanning the market…</p>
          </div>

          <div id="unfold-outer">
            <div id="unfold-inner">
              <p style="font-size:11px; color:#666; margin-bottom:8px;">842 companies found</p>
              <div id="raw-list"></div>
            </div>
          </div>
        </div>

        <div class="track" id="track">
          <div class="track-panel" id="tp2">
            <p style="font-size:11px; color:#666; margin-bottom:2px;">From your search: web agencies · stockholm</p>
            <p style="font-size:13px; font-weight:600; margin-bottom:16px;">Here's how this market breaks down</p>
            <div style="display:flex; align-items:center; gap:28px; flex-wrap:wrap; justify-content:center;">
              <svg viewBox="0 0 100 100" width="120" height="120">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1a1a1a" stroke-width="13"/>
                <circle id="seg-high" cx="50" cy="50" r="38" fill="none" stroke="#e8b72d" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="-232.59" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.35s ease;"/>
                <circle id="seg-good" cx="50" cy="50" r="38" fill="none" stroke="#a8a488" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="-171.62" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.35s ease;"/>
                <circle id="seg-low" cx="50" cy="50" r="38" fill="none" stroke="#2a2a2a" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="-76.34" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.35s ease;"/>
                <circle id="seg-contacted" cx="50" cy="50" r="38" fill="none" stroke="#2a2a2a" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="-29.84" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.35s ease;"/>
                <text id="snapshot-count" x="50" y="47" text-anchor="middle" font-family="Cormorant Garamond" font-size="17" font-weight="600" fill="#f5f0e8">0</text>
                <text x="50" y="60" text-anchor="middle" font-size="6" fill="#666">companies</text>
              </svg>
              <div style="font-size:12px; text-align:left;">
                <div class="snap-legend-row" style="display:flex; align-items:center; gap:8px; margin-bottom:8px; opacity:0; transform:translateX(-8px); transition: opacity 0.4s ease, transform 0.4s ease;"><span style="width:7px;height:7px;border-radius:50%;background:#e8b72d;"></span><span style="color:#999;">High opportunity</span><span style="color:#f5f0e8; font-weight:600; margin-left:auto; padding-left:16px;">127</span></div>
                <div class="snap-legend-row" style="display:flex; align-items:center; gap:8px; margin-bottom:8px; opacity:0; transform:translateX(-8px); transition: opacity 0.4s ease, transform 0.4s ease;"><span style="width:7px;height:7px;border-radius:50%;background:#a8a488;"></span><span style="color:#999;">Good opportunity</span><span style="color:#f5f0e8; font-weight:600; margin-left:auto; padding-left:16px;">215</span></div>
                <div class="snap-legend-row" style="display:flex; align-items:center; gap:8px; margin-bottom:8px; opacity:0; transform:translateX(-8px); transition: opacity 0.4s ease, transform 0.4s ease;"><span style="width:7px;height:7px;border-radius:50%;background:#2a2a2a; border:1px solid #444;"></span><span style="color:#999;">Low opportunity</span><span style="color:#f5f0e8; font-weight:600; margin-left:auto; padding-left:16px;">288</span></div>
                <div class="snap-legend-row" style="display:flex; align-items:center; gap:8px; opacity:0; transform:translateX(-8px); transition: opacity 0.4s ease, transform 0.4s ease;"><span style="width:7px;height:7px;border-radius:50%;background:#2a2a2a; border:1px solid #444;"></span><span style="color:#999;">Contacted</span><span style="color:#f5f0e8; font-weight:600; margin-left:auto; padding-left:16px;">164</span></div>
              </div>
            </div>
            <p style="font-size:10.5px; color:#888; margin-top:18px; line-height:1.5;">Vantio scores every company so you're not guessing which 127 out of 842 are actually worth your time.</p>
            <div class="snap-stat-boxes" style="display:flex; gap:10px; margin-top:16px; opacity:0; transform:translateY(6px); transition: opacity 0.5s ease, transform 0.5s ease;">
              <div style="flex:1; border:1px solid rgba(201,168,76,0.1); border-radius:10px; padding:10px 12px;">
                <p style="font-size:9px; color:#666; text-transform:uppercase; letter-spacing:0.04em;">New this month</p>
                <p class="serif" style="font-size:18px; font-weight:600; margin-top:2px;">23 <span style="font-size:10px; color:#4ade80; font-family:'DM Sans',sans-serif; font-weight:600;">+18%</span></p>
              </div>
              <div style="flex:1; border:1px solid rgba(201,168,76,0.1); border-radius:10px; padding:10px 12px;">
                <p style="font-size:9px; color:#666; text-transform:uppercase; letter-spacing:0.04em;">Coverage</p>
                <p class="serif" style="font-size:18px; font-weight:600; margin-top:2px;">76%</p>
                <p style="font-size:8.5px; color:#666; margin-top:1px;">Est. market coverage</p>
              </div>
            </div>
          </div>

          <div class="track-panel" id="tp3" style="padding-bottom: 90px;">
            <p style="font-size:11px; color:#666; margin-bottom:12px;">Today's top opportunities</p>

            <div class="score-card" style="animation-delay:0.1s;">
              <div class="score-num-wrap">
                <p class="serif score-num" style="color:#ffd363; text-shadow:0 0 8px rgba(255,211,99,0.9), 0 0 18px rgba(255,211,99,0.5);">91</p>
                <div class="score-underline" style="background:#ffd363; box-shadow:0 0 6px rgba(232,201,122,0.7);"></div>
                <div class="subscore-2x2">
                  <div><p class="subscore-label">Fit</p><p class="subscore-val" style="color:#4ade80;">High</p></div>
                  <div><p class="subscore-label">Oppty</p><p class="subscore-val" style="color:#ffd363; text-shadow:0 0 8px rgba(255,211,99,0.9), 0 0 18px rgba(255,211,99,0.5);">91</p></div>
                  <div><p class="subscore-label">Risk</p><p class="subscore-val" style="color:#4ade80;">Low</p></div>
                  <div><p class="subscore-label">Ready</p><p class="subscore-val" style="color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">Med</p></div>
                </div>
              </div>
              <div style="flex:1; padding-top:2px;">
                <p style="font-size:13px; font-weight:600;">Nordic Scale AB</p>
                <p style="font-size:11px; color:#666; margin-top:4px; line-height:1.5;">Because: weak outbound acquisition, strong market demand</p>
                <div class="prep-btn">Prepare outreach</div>
              </div>
            </div>

            <div class="score-card" style="animation-delay:0.3s;">
              <div class="score-num-wrap">
                <p class="serif score-num" style="color:#a8a488;">87</p>
                <div class="score-underline" style="background:#a8a488; box-shadow:0 0 5px rgba(168,164,136,0.5);"></div>
                <div class="subscore-2x2">
                  <div><p class="subscore-label">Fit</p><p class="subscore-val" style="color:#4ade80;">High</p></div>
                  <div><p class="subscore-label">Oppty</p><p class="subscore-val" style="color:#a8a488;">87</p></div>
                  <div><p class="subscore-label">Risk</p><p class="subscore-val" style="color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">Med</p></div>
                  <div><p class="subscore-label">Ready</p><p class="subscore-val" style="color:#4ade80;">High</p></div>
                </div>
              </div>
              <div style="flex:1; padding-top:2px;">
                <p style="font-size:13px; font-weight:600;">Webstrap Agency</p>
                <p style="font-size:11px; color:#666; margin-top:4px; line-height:1.5;">Because: visibility gap, high traffic, low brand presence</p>
                <div class="prep-btn">Prepare outreach</div>
              </div>
            </div>

            <div class="score-card" id="card-3" style="animation-delay:0.5s;">
              <div class="score-num-wrap">
                <p class="serif score-num" style="color:#7a8a6e;">83</p>
                <div class="score-underline" style="background:#7a8a6e; box-shadow:0 0 5px rgba(122,138,110,0.4);"></div>
                <div class="subscore-2x2">
                  <div><p class="subscore-label">Fit</p><p class="subscore-val" style="color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">Med</p></div>
                  <div><p class="subscore-label">Oppty</p><p class="subscore-val" style="color:#7a8a6e;">83</p></div>
                  <div><p class="subscore-label">Risk</p><p class="subscore-val" style="color:#4ade80;">Low</p></div>
                  <div><p class="subscore-label">Ready</p><p class="subscore-val" style="color:#4ade80;">High</p></div>
                </div>
              </div>
              <div style="flex:1; padding-top:2px;">
                <p style="font-size:13px; font-weight:600;">Inkognito Studios</p>
                <p style="font-size:11px; color:#666; margin-top:4px; line-height:1.5;">Because: conversion gap, good traffic, weak conversions</p>
                <div class="prep-btn" id="prep-btn-3">Prepare outreach</div>
              </div>
            </div>

            <div class="score-card" style="animation-delay:0.7s;">
              <div class="score-num-wrap">
                <p class="serif score-num" style="color:#8a8a6e;">78</p>
                <div class="score-underline" style="background:#8a8a6e; box-shadow:0 0 5px rgba(138,138,110,0.4);"></div>
                <div class="subscore-2x2">
                  <div><p class="subscore-label">Fit</p><p class="subscore-val" style="color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">Med</p></div>
                  <div><p class="subscore-label">Oppty</p><p class="subscore-val" style="color:#8a8a6e;">78</p></div>
                  <div><p class="subscore-label">Risk</p><p class="subscore-val" style="color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">Med</p></div>
                  <div><p class="subscore-label">Ready</p><p class="subscore-val" style="color:#4ade80;">High</p></div>
                </div>
              </div>
              <div style="flex:1; padding-top:2px;">
                <p style="font-size:13px; font-weight:600;">BrightCom Solutions</p>
                <p style="font-size:11px; color:#666; margin-top:4px; line-height:1.5;">Because: positioning gap, expanding team, unclear positioning</p>
                <div class="prep-btn">Prepare outreach</div>
              </div>
            </div>

            <div class="score-card" style="animation-delay:0.9s;">
              <div class="score-num-wrap">
                <p class="serif score-num" style="color:#7a8a6e;">74</p>
                <div class="score-underline" style="background:#7a8a6e; box-shadow:0 0 5px rgba(122,138,110,0.35);"></div>
                <div class="subscore-2x2">
                  <div><p class="subscore-label">Fit</p><p class="subscore-val" style="color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">Med</p></div>
                  <div><p class="subscore-label">Oppty</p><p class="subscore-val" style="color:#7a8a6e;">74</p></div>
                  <div><p class="subscore-label">Risk</p><p class="subscore-val" style="color:#4ade80;">Low</p></div>
                  <div><p class="subscore-label">Ready</p><p class="subscore-val" style="color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">Med</p></div>
                </div>
              </div>
              <div style="flex:1; padding-top:2px;">
                <p style="font-size:13px; font-weight:600;">Avento Logistics AB</p>
                <p style="font-size:11px; color:#666; margin-top:4px; line-height:1.5;">Because: process gap, scaling operations, manual processes</p>
                <div class="prep-btn">Prepare outreach</div>
              </div>
            </div>
          </div>

          <div class="track-panel" id="tp4">
            <p style="font-size:11px; color:#666; margin-bottom:2px;">Preparing outreach for</p>
            <p id="outreach-company-name" style="font-size:14px; font-weight:600; margin-bottom:16px;">Inkognito Studios</p>

            <p style="font-size:9px; color:#666; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Channel</p>
            <div style="display:flex; gap:8px; margin-bottom:16px;">
              <div class="chip" id="chip-email">Email</div>
              <div class="chip">LinkedIn DM</div>
              <div class="chip">Cold call</div>
            </div>

            <p style="font-size:9px; color:#666; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Tone</p>
            <div style="display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap;">
              <div class="chip">Professional</div>
              <div class="chip" id="chip-consultative">Consultative</div>
              <div class="chip">Direct</div>
              <div class="chip">Bold</div>
            </div>

            <p id="msg-label" style="font-size:9px; color:#666; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; opacity:0; transition: opacity 0.4s ease;">Generated message</p>
            <div id="msg-box" style="background: rgba(255,255,255,0.015); border:1px solid rgba(201,168,76,0.1); border-radius:10px; padding:14px; font-size:11.5px; color:#bbb; line-height:1.6; opacity:0; transition: opacity 0.5s ease;">
              <p style="color:#888; font-size:10.5px; margin-bottom:8px;"><span style="color:#666;">Subject:</span> <span id="outreach-subject">Quick one on Inkognito's conversion funnel</span></p>
              <span id="outreach-body">Hi Maria — noticed Inkognito's traffic has grown well over the past few months, but the conversion side hasn't kept pace. Teams seeing that kind of gap usually have one or two friction points costing more than they realize. Worth 15 minutes this week to walk through what's likely going on?</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px; margin-top:14px;">
              <div id="send-btn" style="display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:9px; background:linear-gradient(135deg,#ffd363,#e8b72d); color:#080808; font-size:11px; font-weight:700; opacity:0; transition: opacity 0.4s ease, transform 0.15s;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#080808" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send
              </div>
              <div id="sent-toast" style="display:inline-flex; align-items:center; gap:5px; padding:3px 7px; border-radius:6px; background:radial-gradient(ellipse at center, rgba(74,222,128,0.4) 0%, rgba(74,222,128,0.15) 55%, transparent 85%); color:#4ade80; font-size:11px; font-weight:600; opacity:0; transform:translateX(-6px); transition: opacity 0.35s ease, transform 0.35s ease;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Sent
              </div>
            </div>
        </div>
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:center; gap:6px; margin-top:18px; position:relative; z-index:2;">
      <div class="phase-dot" style="width:5px; height:5px; border-radius:50%; background:#e8b72d;"></div>
      <div class="phase-dot" style="width:5px; height:5px; border-radius:50%; background:#333;"></div>
      <div class="phase-dot" style="width:5px; height:5px; border-radius:50%; background:#333;"></div>
      <div class="phase-dot" style="width:5px; height:5px; border-radius:50%; background:#333;"></div>
    </div>
  </div>
</div>

<div class="section">
  <div class="vignette"></div><div class="stars"></div>  <p class="eyebrow">The real cost</p>
  <h2 class="serif">Too many possibilities.<br>Too little context. <span class="gold">Wasted effort.</span></h2>
  <p class="lead" style="margin-top:20px;">You find a company. Spend 45 minutes digging through their site and socials. Guess at an angle that might land. Write the message. Send it. Nothing — not even a no, just silence. It was never a real match.</p>
  <p style="font-size:13px; color:#666; margin-top:14px;">Do that 10 times a week and it's 7.5 hours gone before a single reply comes in.</p>
  <div style="display:flex; gap:18px; margin-top:44px; flex-wrap:wrap;">
    <div class="panel panel-lit card-glow card-glow-red" style="flex:1; min-width:220px;">
      <p class="serif" style="font-size:30px; font-weight:600; color:#e88a8a;">45+ min</p>
      <p style="font-size:12px; color:#777; margin-top:8px; line-height:1.5;">Spent finding out a lead was never worth the effort at all</p>
    </div>
    <div class="panel panel-lit card-glow card-glow-red" style="flex:1; min-width:220px;">
      <p class="serif" style="font-size:30px; font-weight:600; color:#e88a8a;">Guesswork</p>
      <p style="font-size:12px; color:#777; margin-top:8px; line-height:1.5;">Every message is a shot in the dark — no data, just hope</p>
    </div>
  </div>
</div>

<!-- THE TRANSFORMATION -->
<div class="section" style="text-align:center;">
  <div class="vignette"></div><div class="stars"></div>  <p class="eyebrow">From noise to decision</p>
  <h2 class="serif" style="margin-bottom:48px;">Watch the noise <span class="gold">disappear.</span></h2>
  <div style="display:flex; align-items:stretch; justify-content:center; gap:10px; flex-wrap:wrap;">
    <div class="panel panel-lit card-glow card-glow-blue" style="flex:1 1 100px; min-width:0; max-width:160px; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box;"><p class="serif" style="font-size:28px;font-weight:600;">347</p><p style="font-size:11px;color:#777; margin-top:4px;">companies found</p></div>
    <span style="color:#3a3a2a; font-size:20px; display:flex; align-items:center; flex-shrink:0;" class="serif">→</span>
    <div class="panel panel-lit card-glow card-glow-amber" style="flex:1 1 100px; min-width:0; max-width:160px; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box;"><p class="serif" style="font-size:28px;font-weight:600; color:#9c9a7e;">82</p><p style="font-size:11px;color:#777; margin-top:4px;">relevant</p></div>
    <span style="color:#3a3a2a; font-size:20px; display:flex; align-items:center; flex-shrink:0;" class="serif">→</span>
    <div class="panel panel-lit card-glow card-glow-gold" style="flex:1 1 100px; min-width:0; max-width:160px; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box;"><p class="serif" style="font-size:28px;font-weight:600; color:#fac93f; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">21</p><p style="font-size:11px;color:#777; margin-top:4px;">high-opportunity</p></div>
    <span style="color:#3a3a2a; font-size:20px; display:flex; align-items:center; flex-shrink:0;" class="serif">→</span>
    <div class="panel panel-lit card-glow card-glow-green" style="flex:1 1 100px; min-width:0; max-width:160px; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box;"><p class="serif" style="font-size:28px;font-weight:600; color:#4ade80;">5</p><p style="font-size:11px;color:#4ade80; margin-top:4px;">worth today</p></div>
  </div>
</div>

<div class="divider divider-glow-down"></div>

<!-- WHY VANTIO IS DIFFERENT -->
<div class="section" style="text-align:center;">
  <div class="vignette"></div><div class="stars"></div>  <p class="eyebrow">The core difference</p>
  <h2 class="serif">Other tools give you names.<br><em class="gold" style="font-style:italic; font-weight:600;">We give you reasons.</em></h2>
  <p class="lead" style="margin: 20px auto 0;">A list of 500 companies still leaves you guessing which 10 are worth calling. Vantio scores every one, explains the reason, and hands you the opening line.</p>
</div>

<div class="divider divider-glow-up"></div>

<!-- HOW IT WORKS -->
<div class="section">  <div class="vignette"></div><div class="signal-grid"></div><div class="grid-glow"></div><div class="stars"></div>
  <p class="eyebrow" style="text-align:center;">Start to finish</p>
  <h2 class="serif" style="text-align:center; margin-bottom:56px;">Five steps. <span class="gold">No guesswork.</span></h2>
  <div style="display:flex; justify-content:space-between; gap:10px; position:relative;">
    <svg viewBox="0 0 1000 4" style="position:absolute; top:16px; left:0; width:100%; height:4px;" preserveAspectRatio="none">
      <defs><linearGradient id="hg" x1="0" x2="1"><stop offset="0%" stop-color="#2a2618"/><stop offset="50%" stop-color="#e8b72d"/><stop offset="100%" stop-color="#2a2618"/></linearGradient></defs>
      <line x1="50" y1="2" x2="950" y2="2" stroke="url(#hg)" stroke-width="1.2"/>
    </svg>
    <div style="text-align:center; width:110px; position:relative; z-index:1;">
      <div class="icon-badge" style="margin:0 auto 14px; background:#060608;"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg></div>
      <p style="font-size:11.5px; color:#8c8678; line-height:1.5;">Set your market, offer, and ideal customer</p>
    </div>
    <div style="text-align:center; width:110px; position:relative; z-index:1;">
      <div class="icon-badge" style="margin:0 auto 14px; background:#060608;"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div>
      <p style="font-size:11.5px; color:#8c8678; line-height:1.5;">Vantio scores each lead based on your profile and lead signals</p>
    </div>
    <div style="text-align:center; width:110px; position:relative; z-index:1;">
      <div class="icon-badge" style="margin:0 auto 14px; background:#060608; border-color:#ffd363; text-shadow:0 0 8px rgba(255,211,99,0.9), 0 0 18px rgba(255,211,99,0.5);"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 8v4l3 2"/></svg></div>
      <p style="font-size:11.5px; color:#fac93f; font-weight:600; line-height:1.5; text-shadow:0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5);">See the specific gap that makes each one worth contacting</p>
    </div>
    <div style="text-align:center; width:110px; position:relative; z-index:1;">
      <div class="icon-badge" style="margin:0 auto 14px; background:#060608;"><svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg></div>
      <p style="font-size:11.5px; color:#8c8678; line-height:1.5;">Choose from outreach templates and personalize them to your selected leads</p>
    </div>
    <div style="text-align:center; width:110px; position:relative; z-index:1;">
      <div class="icon-badge" style="margin:0 auto 14px; background:#060608;"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div>
      <p style="font-size:11.5px; color:#8c8678; line-height:1.5;">Log the reply, the meeting, the deal — build your track record</p>
    </div>
  </div>
  <div style="text-align:center;">
    <a href="/login" class="start-here-btn" onclick="this.classList.add('pressed');">Start here.</a>
  </div>
</div>

<!-- PRODUCT EXPERIENCE -->
<div class="section">
  <div class="vignette"></div><div class="stars"></div>  <p class="eyebrow">See Vantio in action</p>
  <h2 class="serif" style="margin-bottom:44px;">Every screen answers <span class="gold">a real question</span></h2>
  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:18px;">
    <div class="panel panel-lit card-glow card-glow-blue">
      <div class="icon-badge" style="margin-bottom:14px;"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="11" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg></div>
      <p style="font-size:15px;font-weight:600;margin-bottom:8px;">Pipeline</p><p style="font-size:12.5px;color:#777; line-height:1.5;">Every deal, staged from first contact to closed. See which leads have gone quiet, which need a follow-up today, and the exact reasoning behind every score</p>
    </div>
    <div class="panel panel-lit card-glow card-glow-gold">
      <div class="icon-badge" style="margin-bottom:14px;"><svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg></div>
      <p style="font-size:15px;font-weight:600;margin-bottom:8px;">Home</p><p style="font-size:12.5px;color:#777; line-height:1.5;">Your daily hub. High-opportunity leads scored to your profile, overdue follow-ups you might have missed, and the reasoning behind each one</p>
    </div>
    <div class="panel panel-lit card-glow card-glow-amber">
      <div class="icon-badge" style="margin-bottom:14px;"><svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg></div>
      <p style="font-size:15px;font-weight:600;margin-bottom:8px;">Outreach</p><p style="font-size:12.5px;color:#777; line-height:1.5;">Choose from proven templates, personalize each one to the specific lead, and send — by email or LinkedIn, in whatever tone fits the conversation</p>
    </div>
    <div class="panel panel-lit card-glow card-glow-green">
      <div class="icon-badge" style="margin-bottom:14px;"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 15l3-4 3 3 4-6"/></svg></div>
      <p style="font-size:15px;font-weight:600;margin-bottom:8px;">Stats</p><p style="font-size:12.5px;color:#777; line-height:1.5;">See which tones and angles actually get replies, track your close rate over time, and understand exactly why deals were lost</p>
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- COMPOUNDING INTELLIGENCE -->
<div class="section" style="text-align:center;">
  <div class="vignette"></div><div class="stars"></div>  <p class="eyebrow">Vantio gets better with time</p>
  <h2 class="serif">The more you use it,<br><span class="gold">the more it learns and adapts</span></h2>
  <p class="lead" style="margin: 20px auto;">Every contact, every reply, every closed deal becomes a signal. Vantio is recording which gaps, which angles and which tones actually convert from your target market.</p>
  <p style="font-size:11px; color:#5a5a5a; margin-top:22px;" class="mono">Available today: outcome tracking · Coming: adaptive prioritization</p>
</div>

<div class="divider"></div>

<!-- ECONOMIC VALUE -->
<div class="section" style="text-align:center;">  <div class="vignette"></div><div class="stars"></div>
  <p class="eyebrow">The real comparison</p>
  <h2 class="serif">The real cost isn't the subscription.<br><span class="gold">It's the time you're already losing.</span></h2>
  <p class="lead" style="margin: 20px auto;"><span class="gold">7.5 hours</span> a week spent on research that goes nowhere is <span class="gold">390 hours</span> a year — time you could have spent on the leads that actually close.</p>
</div>

<!-- WHO IT'S FOR -->
<div class="section">
  <div class="vignette"></div><div class="stars"></div>  <p class="eyebrow" style="text-align:center;">Built for</p>
  <h2 class="serif" style="text-align:center; margin-bottom:44px;">Built for teams who make <span class="gold">every hour count</span></h2>
  <div style="display:grid; grid-template-columns: repeat(4,1fr); gap:16px;">
    <div class="panel panel-lit card-glow card-glow-gold" style="text-align:center; padding:24px 16px;">
      <div class="icon-badge" style="margin:0 auto 12px;"><svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg></div>
      <p style="font-size:13.5px;font-weight:600;">Agencies</p>
      <p style="font-size:11px; color:#777; margin-top:6px; line-height:1.5;">Pitch twice as many qualified clients in the same working week</p>
    </div>
    <div class="panel panel-lit card-glow card-glow-gold" style="text-align:center; padding:24px 16px;">
      <div class="icon-badge" style="margin:0 auto 12px;"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="8" r="2.5"/><path d="M16 14.5c2.5.5 4.5 2.5 5 5.5"/></svg></div>
      <p style="font-size:13.5px;font-weight:600;">Sales teams</p>
      <p style="font-size:11px; color:#777; margin-top:6px; line-height:1.5;">Every rep's hours go toward leads actually worth calling</p>
    </div>
    <div class="panel panel-lit card-glow card-glow-gold" style="text-align:center; padding:24px 16px;">
      <div class="icon-badge" style="margin:0 auto 12px;"><svg viewBox="0 0 24 24"><path d="M6 9l6-6 6 6-6 12z"/><path d="M6 9h12"/></svg></div>
      <p style="font-size:13.5px;font-weight:600;">High-ticket founders</p>
      <p style="font-size:11px; color:#777; margin-top:6px; line-height:1.5;">Every meeting on the calendar is one worth having</p>
    </div>
    <div class="panel panel-lit card-glow card-glow-gold" style="text-align:center; padding:24px 16px;">
      <div class="icon-badge" style="margin:0 auto 12px;"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg></div>
      <p style="font-size:13.5px;font-weight:600;">Outbound-led teams</p>
      <p style="font-size:11px; color:#777; margin-top:6px; line-height:1.5;">Same volume of outreach, aimed at companies that actually convert</p>
    </div>
  </div>
</div>

<div class="divider divider-glow-down"></div>

<!-- FINAL CTA -->
<div class="section" style="text-align:center; padding-bottom: 160px;">
  <div class="vignette"></div><div class="signal-grid"></div><div class="grid-glow"></div>  <div class="stars"></div>
  <p class="eyebrow" style="text-align:center; position:relative;">Join the beta</p>
  <h2 class="serif" style="position:relative;">Stop guessing,<br><span class="gold">Start converting.</span></h2>
  <p class="lead" style="margin: 18px auto 34px; position:relative;">Join the beta today.</p>
  <div style="position:relative; display:inline-block;">
    <div style="position:absolute; inset:-30px; background:radial-gradient(ellipse 60% 60% at 50% 50%, rgba(232,201,122,0.3) 0%, transparent 75%); filter:blur(12px); pointer-events:none;"></div>
    <a href="/login" class="btn-outline" style="position:relative; font-size:14px; padding:17px 38px;" onclick="this.classList.add('pressed');">Join the beta →</a>
  </div>
</div>


`;

export default function LandingPage() {
  const isMobile = useIsMobile();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  // Auth-aware header/footer state — mirrors the previous landing page:
  // shows Home/Log out when signed in, Log in otherwise, and stays in
  // sync live if the session changes in another tab.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLandingSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    setUserEmail(null);
  }

  // Live waitlist count (not currently displayed anywhere on the page —
  // it wasn't rendered in the previous version either — kept here so it's
  // available to wire into copy later without another round of plumbing).
  useEffect(() => {
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.count === "number" && d.count > 0) setWaitlistCount(d.count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cleanup = runLandingAnimations({ isMobile, MOBILE_NEBULA_ENABLED });
    return cleanup;
  }, [isMobile]);

  return (
    <div style={{ minHeight: "100vh", background: "#050507", color: "#f5f0e8", overflowX: "hidden" }}>
      <header className="site-header">
        <div className="logo-row">
          <img className="logo-icon" src="/vantio-mark.png" alt="Vantio" />
          <img className="wordmark-img" src="/vantio-wordmark.png" alt="Vantio" />
        </div>
        <div className="nav-right">
          <Link href="/plans" className="nav-link">
            Pricing
          </Link>
          {userEmail ? (
            <>
              <Link href="/home" className="btn-outline">
                Home
              </Link>
              <button
                type="button"
                onClick={handleLandingSignOut}
                className="btn-outline"
                style={{ background: "none", cursor: "pointer" }}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-outline"
                onClick={(e) => {
                  const el = e.currentTarget;
                  el.classList.add("pressed");
                  setTimeout(() => el.classList.remove("pressed"), 1000);
                }}>
                Join the beta &#8594;
              </Link>
              <Link
                href="/login"
                className="btn-outline"
                onClick={(e) => {
                  const el = e.currentTarget;
                  el.classList.add("pressed");
                  setTimeout(() => el.classList.remove("pressed"), 1000);
                }}>
                Log in
              </Link>
            </>
          )}
        </div>
      </header>

      <div dangerouslySetInnerHTML={{ __html: SECTIONS_HTML }} />

      <footer
        style={{
          borderTop: "1px solid rgba(232,183,45,0.12)",
          padding: "32px 48px",
          position: "relative",
        }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/vantio-mark.png" alt="Vantio" style={{ height: 18, width: "auto" }} />
            <img src="/vantio-wordmark.png" alt="Vantio" style={{ height: 14, width: "auto" }} />
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              ["Pricing", "/plans"],
              ["Get Access", "/login"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
            ].map(([label, href]) => (
              <Link key={label} href={href} className="nav-link" style={{ fontSize: 12 }}>
                {label}
              </Link>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.06em" }}>
            &copy; {new Date().getFullYear()} Vantio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
