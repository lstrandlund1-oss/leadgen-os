"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { MOBILE_NEBULA_ENABLED } from "@/lib/config/mobileVisuals";
import { runLandingAnimations } from "./landingAnimations";

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
  <canvas id="nebula-hero" class="nebula-canvas" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:0;"></canvas>
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
                <circle id="seg-high" cx="50" cy="50" r="38" fill="none" stroke="#e8b72d" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="0" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.7s ease;"/>
                <circle id="seg-good" cx="50" cy="50" r="38" fill="none" stroke="#a8a488" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="-36.01" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.7s ease;"/>
                <circle id="seg-low" cx="50" cy="50" r="38" fill="none" stroke="#2a2a2a" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="-96.98" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.7s ease;"/>
                <circle id="seg-contacted" cx="50" cy="50" r="38" fill="none" stroke="#2a2a2a" stroke-width="13" stroke-dasharray="0 238.76" stroke-dashoffset="-192.26" transform="rotate(-90 50 50)" style="transition: stroke-dasharray 0.7s ease;"/>
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
  <canvas id="nebula-problem" class="nebula-canvas" style="position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:0.7;"></canvas><div class="stars"></div>  <p class="eyebrow">The real cost</p>
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
  <canvas id="nebula-transform" class="nebula-canvas" style="position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:0.7;"></canvas><div class="stars"></div>  <p class="eyebrow">From noise to decision</p>
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
  <canvas id="nebula-diff" class="nebula-canvas" style="position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:0.65;"></canvas><div class="stars"></div>  <p class="eyebrow">The core difference</p>
  <h2 class="serif">Other tools give you names.<br><em class="gold" style="font-style:italic; font-weight:600;">We give you reasons.</em></h2>
  <p class="lead" style="margin: 20px auto 0;">A list of 500 companies still leaves you guessing which 10 are worth calling. Vantio scores every one, explains the reason, and hands you the opening line.</p>
</div>

<div class="divider divider-glow-up"></div>

<!-- HOW IT WORKS -->
<div class="section">  <div class="stars"></div>
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
  <canvas id="nebula-product" class="nebula-canvas" style="position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:0.65;"></canvas><div class="stars"></div>  <p class="eyebrow">See Vantio in action</p>
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
  <canvas id="nebula-compound" class="nebula-canvas" style="position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:0.65;"></canvas><div class="stars"></div>  <p class="eyebrow">Vantio gets better with time</p>
  <h2 class="serif">The more you use it,<br><span class="gold">the more it learns and adapts</span></h2>
  <p class="lead" style="margin: 20px auto;">Every contact, every reply, every closed deal becomes a signal. Vantio is recording which gaps, which angles and which tones actually convert from your target market.</p>
  <p style="font-size:11px; color:#5a5a5a; margin-top:22px;" class="mono">Available today: outcome tracking · Coming: adaptive prioritization</p>
</div>

<div class="divider"></div>

<!-- ECONOMIC VALUE -->
<div class="section" style="text-align:center;">  <div class="stars"></div>
  <p class="eyebrow">The real comparison</p>
  <h2 class="serif">The real cost isn't the subscription.<br><span class="gold">It's the time you're already losing.</span></h2>
  <p class="lead" style="margin: 20px auto;"><span class="gold">7.5 hours</span> a week spent on research that goes nowhere is <span class="gold">390 hours</span> a year — time you could have spent on the leads that actually close.</p>
</div>

<!-- WHO IT'S FOR -->
<div class="section">
  <canvas id="nebula-whofor" class="nebula-canvas" style="position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:0.83;"></canvas><div class="stars"></div>  <p class="eyebrow" style="text-align:center;">Built for</p>
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
<div class="section" style="text-align:center; padding-bottom: 160px; overflow:hidden;">
  <canvas id="nebula-cta" class="nebula-canvas" style="position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:0.75;"></canvas>  <div class="stars"></div>
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
  // shows Dashboard/Log out when signed in, Log in otherwise, and stays in
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
      <style>{`  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #050507; color: #f5f0e8; font-family: var(--font-body), sans-serif; overflow-x: hidden; scrollbar-color: #e8b72d #0c0c0f; scrollbar-width: thin; }
  ::-webkit-scrollbar { width: 12px; }
  ::-webkit-scrollbar-track { background: #0c0c0f; }
  ::-webkit-scrollbar-thumb { background: linear-gradient(180deg,#fac93f,#b3882b); border-radius: 8px; border: 2px solid #0c0c0f; }
  ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg,#ffdd87,#e8b72d); }
  .serif { font-family: var(--font-display), serif; }
  .mono { font-family: "SF Mono", monospace; }
  .eyebrow { font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: #a0761a; margin-bottom: 20px; text-shadow: 0 0 10px rgba(200,150,40,0.85), 0 0 22px rgba(160,118,26,0.5); }
  .gold { background: linear-gradient(135deg,#ffdd87 0%,#fac93f 50%,#b3882b 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 14px rgba(250,201,63,0.75)) drop-shadow(0 0 34px rgba(250,201,63,0.5)) drop-shadow(0 0 64px rgba(250,201,63,0.28)); }
  .btn { display: inline-block; padding: 15px 32px; background: linear-gradient(135deg,#ffd363,#e8b72d); color: #080808; border-radius: 10px; font-weight: 700; font-size: 13px; text-decoration: none; box-shadow: 0 8px 24px rgba(201,168,76,0.4), 0 0 34px rgba(250,201,63,0.22); }
  .btn, .start-here-btn, .btn-outline { position: relative; overflow: hidden; }
  .btn::before, .start-here-btn::before, .btn-outline::before {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(circle 90px at var(--mx, 50%) var(--my, 50%), rgba(250,219,140,0.2625), transparent 70%);
    opacity: 0; transition: opacity 0.25s ease;
  }
  .btn:hover::before, .start-here-btn:hover::before, .btn-outline:hover::before { opacity: 1; }
  .start-here-btn {
    display: inline-block; margin-top: 36px; padding: 12px 30px; border-radius: 10px;
    border: 1.5px solid #e8b72d; background: transparent; color: #fac93f;
    font-family: var(--font-display), serif; font-size: 20px; font-style: italic; font-weight: 500;
    text-decoration: none; cursor: pointer; text-shadow: 0 0 10px rgba(250,201,63,0.9), 0 0 22px rgba(250,201,63,0.5);
    box-shadow: 0 0 18px rgba(232,183,45,0.18);
    transition: background 0.15s ease, color 0.15s ease;
  }
  .start-here-btn.pressed { background: #e8b72d; color: #080808; text-shadow: none; }
  .btn-outline {
    display: inline-block; padding: 15px 32px; border-radius: 10px;
    border: 1.5px solid #e8b72d; background: transparent; color: #fac93f;
    font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; text-shadow: 0 0 10px rgba(250,201,63,0.9), 0 0 22px rgba(250,201,63,0.5);
    box-shadow: 0 0 18px rgba(232,183,45,0.18);
    transition: background 0.15s ease, color 0.15s ease;
  }
  .btn-outline.pressed { background: #e8b72d; color: #080808; text-shadow: none; }
  .site-header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px; background: rgba(5,5,7,0.55); backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(232,183,45,0.12);
  }
  .site-header .logo-row { display: flex; align-items: center; gap: 10px; }
  .site-header .logo-icon { height: 30px; width: auto; display: block; }
  .site-header .wordmark-img { height: 26px; width: auto; display: block; }
  .site-header .nav-right { display: flex; align-items: center; gap: 28px; }
  .site-header .nav-link {
    font-family: var(--font-body), sans-serif; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.82);
    text-decoration: none; transition: color 0.15s ease;
  }
  .site-header .nav-link:hover { color: #fac93f; text-shadow: 0 0 8px rgba(250,201,63,0.9), 0 0 18px rgba(250,201,63,0.5); }
  .site-header .btn-outline { padding: 10px 22px; font-size: 12.5px; }
  .hero { position: relative; min-height: 1100px; padding: 190px 24px 0; text-align: center; overflow: hidden; z-index: 0; }
  .nebula-canvas {
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%);
  }
  .nebula-a { position: absolute; inset: -10%; background: radial-gradient(ellipse 800px 500px at 20% 20%, rgba(90,60,140,0.16), transparent 60%), radial-gradient(ellipse 700px 600px at 80% 15%, rgba(201,168,76,0.1), transparent 55%), radial-gradient(ellipse 900px 500px at 50% 90%, rgba(40,60,120,0.14), transparent 60%); animation: drift 40s ease-in-out infinite alternate; -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 96%); mask-image: linear-gradient(to bottom, black 70%, transparent 96%); }
  @keyframes drift { from { transform: translate(0,0) scale(1); } to { transform: translate(-2%,1.5%) scale(1.04); } }
  .stars-small { position:absolute; inset:0; opacity:0.95; background-image:
    radial-gradient(1.6px 1.6px at 8% 15%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%),
    radial-gradient(1.4px 1.4px at 22% 60%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%),
    radial-gradient(2px 2px at 60% 20%, #fff, rgba(255,255,255,0.5) 60%, transparent 100%),
    radial-gradient(1.6px 1.6px at 85% 35%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%),
    radial-gradient(2px 2px at 92% 70%, #fff, rgba(255,255,255,0.5) 60%, transparent 100%),
    radial-gradient(1.4px 1.4px at 38% 40%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%),
    radial-gradient(1.8px 1.8px at 12% 82%, #fff, rgba(255,255,255,0.45) 60%, transparent 100%),
    radial-gradient(1.4px 1.4px at 68% 55%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%),
    radial-gradient(1.6px 1.6px at 50% 8%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%),
    radial-gradient(1.8px 1.8px at 78% 88%, #fff, rgba(255,255,255,0.45) 60%, transparent 100%),
    radial-gradient(1.4px 1.4px at 30% 12%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%),
    radial-gradient(1.6px 1.6px at 95% 50%, #fff, rgba(255,255,255,0.4) 60%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 96%);
    mask-image: linear-gradient(to bottom, black 70%, transparent 96%); }
  .demo-wrap { position: relative; margin: 56px auto 0; max-width: 640px; }
  .demo-glow { position: absolute; inset: -60px; background: radial-gradient(ellipse 70% 60% at 50% 45%, rgba(232,201,122,0.28) 0%, rgba(201,168,76,0.12) 40%, transparent 75%); filter: blur(20px); z-index: 0; pointer-events:none; }
  .chrome { position:relative; z-index:2; background: rgba(8,8,14,0.97); border: 1px solid rgba(201,168,76,0.22); border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px rgba(201,168,76,0.08), 0 40px 90px rgba(0,0,0,0.8); }
  .chrome-topline { height: 1px; background: linear-gradient(90deg,transparent 5%,rgba(201,168,76,0.5) 50%,transparent 95%); }
  .chrome-bar { display: flex; align-items: center; gap: 7px; padding: 12px 18px; background: rgba(5,5,10,0.85); border-bottom: 1px solid rgba(201,168,76,0.08); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #16161f; }

  .stage { position: relative; height: 460px; overflow: hidden; transition: opacity 0.5s ease; }
  .stage.fading { opacity: 0; }

  #phase1 { position:absolute; inset:0; padding:30px; text-align:left; transition: opacity 0.5s ease, transform 0.7s cubic-bezier(0.65,0,0.35,1); }
  #phase1.swiping-out { opacity:0; transform: translateX(-100%); }

  .search-bar { display:flex; align-items:center; gap:10px; background: rgba(255,255,255,0.02); border:1px solid rgba(201,168,76,0.25); border-radius:10px; padding:12px 16px; transition: border-color 0.3s, box-shadow 0.3s; }
  .search-bar.submitted { border-color: rgba(201,168,76,0.55); box-shadow: 0 0 14px rgba(201,168,76,0.2); }
  .cursor { display:inline-block; width:2px; height:14px; background:#e8b72d; animation: blink 0.9s infinite; vertical-align:middle; }
  @keyframes blink { 0%,49% {opacity:1;} 50%,100% {opacity:0;} }
  .search-submit { font-size:9px; padding:5px 10px; border-radius:6px; background:#e8b72d; color:#080808; font-weight:700; letter-spacing:0.05em; margin-left:auto; transition: transform 0.15s; }
  .search-submit.clicked { transform: scale(0.92); }

  #loading-block { text-align:center; margin-top:26px; opacity:0; max-height:0; overflow:hidden; transition: opacity 0.4s ease, max-height 0.4s ease; }
  #loading-block.visible { opacity:1; max-height:200px; }
  .loader-ring { width:56px; height:56px; margin: 14px auto 14px; }
  .loader-ring circle { fill:none; stroke-width:3; }
  .loader-track { stroke:#1a1a1a; }
  .loader-fill { stroke:#e8b72d; stroke-linecap:round; transform-origin:center; animation: spin 1.4s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status-text { font-size: 12px; color: #999; text-align:center; height: 18px; }

  #unfold-outer { position: relative; margin-top: 6px; }
  #unfold-outer::after { content:""; position:absolute; left:0; right:0; bottom:0; height:70px; background: linear-gradient(180deg, transparent, rgba(8,8,14,1)); pointer-events:none; opacity:0; transition: opacity 0.5s ease; }
  #unfold-outer.faded::after { opacity:1; }
  #unfold-inner { max-height:0; overflow:hidden; transition: max-height 0.9s cubic-bezier(0.16,1,0.3,1); }
  #unfold-inner.open { max-height: 500px; }
  .raw-row { display:flex; align-items:center; gap:12px; padding:9px 4px; border-bottom:1px solid rgba(255,255,255,0.03); opacity:0; animation: riseIn 0.4s ease forwards; }
  @keyframes riseIn { to { opacity:1; transform:translateY(0); } }
  .raw-dot { width:5px; height:5px; border-radius:50%; background:#444; flex-shrink:0; }

  .track { position:absolute; top:0; left:100%; display:flex; width:300%; height:100%; transition: transform 0.8s cubic-bezier(0.65,0,0.35,1); }
  .track-panel {
    width: 33.333%; height:100%; padding:30px; text-align:left; box-sizing:border-box;
    overflow-y:auto; scroll-behavior: smooth; pointer-events: none;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .track-panel::-webkit-scrollbar { display: none; width: 0; height: 0; }

  .score-card { display:flex; align-items:flex-start; gap:16px; padding:14px; border:1px solid rgba(201,168,76,0.1); border-radius:12px; margin-bottom:10px; background: rgba(255,255,255,0.015); opacity:0; transform: translateY(10px); animation: riseIn2 0.6s ease forwards; transition: border-color 0.3s, box-shadow 0.3s, background 0.3s; }
  .score-card.pressed { border-color: rgba(201,168,76,0.5); box-shadow: 0 0 20px rgba(201,168,76,0.15); background: rgba(201,168,76,0.03); }
  @keyframes riseIn2 { to { opacity:1; transform:translateY(0); } }
  .score-num-wrap { text-align:center; width: 74px; flex-shrink:0; }
  .score-num { font-size: 28px; font-weight: 600; }
  .score-underline { width: 20px; height: 2px; margin: 3px auto 8px; border-radius: 1px; }
  .subscore-2x2 { display:grid; grid-template-columns: repeat(2,1fr); gap: 5px 8px; }
  .subscore-label { font-size: 7.5px; color: #666; text-transform:uppercase; letter-spacing:0.04em; }
  .subscore-val { font-size: 10px; font-weight: 600; margin-top: 1px; }
  .prep-btn { font-size:10px; padding:5px 12px; border:1px solid #e8b72d; border-radius:7px; color:#fac93f; font-weight:600; display:inline-block; margin-top:10px; text-shadow: 0 0 6px rgba(250,201,63,0.9), 0 0 16px rgba(250,201,63,0.5); box-shadow: 0 0 12px rgba(232,183,45,0.15); transition: background 0.25s, color 0.25s, transform 0.15s; }
  .prep-btn.clicked { background:#e8b72d; color:#080808; transform: scale(0.95); }

  .chip { font-size:10px; padding:6px 12px; border-radius:8px; border:1px solid rgba(201,168,76,0.2); color:#888; transition: border-color 0.25s, color 0.25s, background 0.25s; }
  .chip.active { border-color:#fac93f; color:#fac93f; background: rgba(201,168,76,0.08); text-shadow: 0 0 6px rgba(250,201,63,0.9), 0 0 16px rgba(250,201,63,0.5); box-shadow: 0 0 12px rgba(232,183,45,0.15); }
  #send-btn.sent { background: linear-gradient(135deg,#4ade80,#22c55e); }

  /* ── Cursor: appears before each click, fades out after ── */
  #cursor-el { position:absolute; width:16px; height:16px; z-index:50; opacity:0; pointer-events:none; transition: left 0.75s cubic-bezier(0.65,0,0.35,1), top 0.75s cubic-bezier(0.65,0,0.35,1), opacity 0.3s ease; }
  #cursor-el svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
  #cursor-el.visible { opacity:1; }
  #cursor-el.clicking svg { animation: clickPulse 0.35s ease; }
  @keyframes clickPulse { 0% { transform: scale(1); } 40% { transform: scale(0.75); } 100% { transform: scale(1); } }
  .click-ring { position:absolute; top:50%; left:50%; width:16px; height:16px; margin:-8px 0 0 -8px; border-radius:50%; border:1.5px solid #e8b72d; opacity:0; pointer-events:none; }
  .click-ring.pinging { animation: ringPing 0.5s ease-out; }
  @keyframes ringPing { 0% { opacity:0.8; transform:scale(0.4); } 100% { opacity:0; transform:scale(2.2); } }

  /* ── Classes from the full landing page structure demo ── */
  .section { padding: 130px 24px; max-width: 1100px; margin: 0 auto; position: relative; z-index: 0; }
  .section::before, .section::after {
    content: ""; position: absolute; left: 0; right: 0; height: 110px; pointer-events: none; z-index: 0;
  }
  .section::before { top: 0; background: linear-gradient(to bottom, #050507 0%, transparent 100%); }
  .section::after { bottom: 0; background: linear-gradient(to top, #050507 0%, transparent 100%); }
  .section-label { position: absolute; top: 40px; left: 24px; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #2a2a2a; font-family: monospace; }
  h2 { font-family: var(--font-display), serif; font-size: clamp(38px,5vw,58px); font-weight: 300; line-height: 1.1; letter-spacing: -0.01em; margin-bottom: 22px; }
  .lead { font-size: 18px; color: #9c9689; max-width: 620px; line-height: 1.65; font-weight: 300; }
  .divider { height: 1px; background: linear-gradient(90deg,transparent,rgba(201,168,76,0.22),transparent); position: relative; }
  .divider::after { content: ""; position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 60%; height: 140px; background: radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.08) 0%, transparent 70%); pointer-events: none; }
  .divider-quiet::after { content: none; }
  .divider-glow-down::after { transform: translate(-50%, 0%); height: 180px; }
  .divider-glow-up::after { transform: translate(-50%, -100%); height: 180px; }
  .stars { position: absolute; inset: 0; pointer-events: none; opacity: 0.9; background-image:
    radial-gradient(1.8px 1.8px at 15% 25%, #ffdd87, rgba(250,201,63,0.5) 60%, transparent 100%),
    radial-gradient(1.6px 1.6px at 75% 10%, #ffdd87, rgba(250,201,63,0.5) 60%, transparent 100%),
    radial-gradient(2px 2px at 45% 60%, #ffdd87, rgba(250,201,63,0.55) 60%, transparent 100%),
    radial-gradient(1.6px 1.6px at 90% 70%, #ffdd87, rgba(250,201,63,0.5) 60%, transparent 100%),
    radial-gradient(1.8px 1.8px at 25% 85%, #ffdd87, rgba(250,201,63,0.5) 60%, transparent 100%),
    radial-gradient(1.4px 1.4px at 55% 18%, #ffdd87, rgba(250,201,63,0.45) 60%, transparent 100%),
    radial-gradient(1.8px 1.8px at 8% 55%, #ffdd87, rgba(250,201,63,0.5) 60%, transparent 100%),
    radial-gradient(1.6px 1.6px at 65% 45%, #ffdd87, rgba(250,201,63,0.45) 60%, transparent 100%),
    radial-gradient(2px 2px at 35% 35%, #ffdd87, rgba(250,201,63,0.55) 60%, transparent 100%),
    radial-gradient(1.4px 1.4px at 95% 25%, #ffdd87, rgba(250,201,63,0.45) 60%, transparent 100%),
    radial-gradient(1.8px 1.8px at 5% 90%, #ffdd87, rgba(250,201,63,0.5) 60%, transparent 100%),
    radial-gradient(1.6px 1.6px at 82% 92%, #ffdd87, rgba(250,201,63,0.45) 60%, transparent 100%); }

  .panel { position: relative; border-radius: 18px; border: 1px solid rgba(201,168,76,0.35); background: linear-gradient(160deg, rgba(20,18,14,0.92) 0%, rgba(8,8,10,0.97) 100%); padding: 26px; overflow: hidden; }
  .corner-glow { position: absolute; width: 60px; height: 60px; pointer-events: none; border-radius: 50%; filter: blur(16px); }
  .cg-tl { top: -20px; left: -20px; background: radial-gradient(circle, rgba(232,201,122,0.5), transparent 70%); }
  .cg-br { bottom: -20px; right: -20px; background: radial-gradient(circle, rgba(232,201,122,0.5), transparent 70%); }

  /* ── Section 2 variant: the BORDER LINE itself is lit, bright at the
     top-left (light source) fading to shadow at the bottom-right - not
     a background fill inside the card. Uses the padding-box/border-box
     double-background trick so only the border ring is affected. ── */
  .panel-lit {
    border: 1.5px solid transparent;
    background:
      radial-gradient(ellipse 190% 30% at 0% 0%, rgba(232,201,122,0.16) 0%, rgba(232,201,122,0.06) 45%, transparent 80%) padding-box,
      linear-gradient(160deg, rgba(20,18,14,0.92) 0%, rgba(8,8,10,0.97) 100%) padding-box,
      radial-gradient(ellipse 150% 55% at 0% 0%, rgba(255,248,225,1) 0%, rgba(232,201,122,0.6) 30%, rgba(80,66,32,0.22) 65%, rgba(20,17,10,0.15) 100%) border-box;
  }
  .card-glow { transition: transform 1s ease-out, box-shadow 1s ease-out; }
  .card-glow-blue:hover { transition: transform 0.25s ease, box-shadow 0.25s ease; transform: translateY(-4px); box-shadow: 0 12px 40px rgba(90,150,230,0.35); }
  .card-glow-gold:hover { transition: transform 0.25s ease, box-shadow 0.25s ease; transform: translateY(-4px); box-shadow: 0 12px 40px rgba(250,201,63,0.35); }
  .card-glow-amber:hover { transition: transform 0.25s ease, box-shadow 0.25s ease; transform: translateY(-4px); box-shadow: 0 12px 40px rgba(230,150,70,0.35); }
  .card-glow-green:hover { transition: transform 0.25s ease, box-shadow 0.25s ease; transform: translateY(-4px); box-shadow: 0 12px 40px rgba(74,222,128,0.35); }
  .card-glow-red:hover { transition: transform 0.25s ease, box-shadow 0.25s ease; transform: translateY(-4px); box-shadow: 0 12px 40px rgba(232,138,138,0.35); }

  .icon-badge { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(201,168,76,0.45); background: rgba(201,168,76,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .icon-badge svg { width: 16px; height: 16px; stroke: #ffd363; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .list-row { display: flex; align-items: center; gap: 14px; padding: 9px 0; }
`}</style>

      <header className="site-header">
        <div className="logo-row">
          <img className="logo-icon" src="/vantio-mark.png" alt="Vantio" />
          <img className="wordmark-img" src="/vantio-wordmark.png" alt="Vantio" />
        </div>
        <div className="nav-right">
          <Link href="/plans" className="nav-link">
            Pricing
          </Link>
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
          {userEmail ? (
            <>
              <Link href="/dashboard" className="btn-outline">
                Dashboard
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
