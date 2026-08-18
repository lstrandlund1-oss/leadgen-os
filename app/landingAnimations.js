/* global document, window, console, setTimeout, setInterval, clearTimeout, clearInterval, requestAnimationFrame, cancelAnimationFrame, performance, ImageData */
// This file is pure browser-runtime DOM script (not bundler/Node code), so
// the browser globals above are declared explicitly for ESLint's no-undef
// rule rather than relying on `/* eslint-env browser */`, which is a legacy
// feature not honoured by this project's flat eslint.config.mjs.
//
// Runs the landing page's hero animation timeline and scroll/hover
// effects. Ported from a static HTML/CSS/JS demo as imperative DOM code
// (not React state) to preserve the exact hand-tuned timings. Deliberately
// kept as plain JS (not .ts) — this file isn't type-checked by the project
// (checkJs is off in tsconfig.json), which is intentional here given how
// much of this is direct DOM querying that doesn't map cleanly onto
// strict TypeScript.
//
// isMobile/MOBILE_NEBULA_ENABLED are accepted but unused now that the
// canvas nebula system has been removed in favor of CSS-only backgrounds
// (static gradient blobs behind the hero, a star field + vignette
// elsewhere, a signal grid on two sections) — left in the signature so
// the page.tsx call site doesn't need to change.
//
// Call from a useEffect in the page component:
//   useEffect(() => {
//     const cleanup = runLandingAnimations({ isMobile, MOBILE_NEBULA_ENABLED });
//     return cleanup;
//   }, [isMobile]);
//
// Returns a cleanup function that clears every timeout/interval/animation
// frame this code scheduled, so nothing leaks if the component unmounts
// mid-animation.
export function runLandingAnimations({ isMobile, MOBILE_NEBULA_ENABLED }) {
  console.log("[vantio-hero] runLandingAnimations() started, isMobile:", isMobile);
  const timeouts = [];
  const intervals = [];
  const rafs = [];
  const scopedSetTimeout = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timeouts.push(id);
    return id;
  };
  const scopedSetInterval = (fn, ms) => {
    const id = setInterval(fn, ms);
    intervals.push(id);
    return id;
  };
  const scopedRAF = (fn) => {
    const id = requestAnimationFrame(fn);
    rafs.push(id);
    return id;
  };

  // Cursor-tracking glow for all buttons
  document.querySelectorAll(".btn, .start-here-btn, .btn-outline").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", x + "%");
      el.style.setProperty("--my", y + "%");
    });
  });

  const query = "web agencies · stockholm";
  // Every one of these is a live getter, not a cached reference — see the
  // comment above typeQuery() for why: a long-held DOM reference can go
  // stale if React ever replaces the underlying node after mount, and it
  // fails completely silently (no error, just invisible no-op writes).
  // Accessing els.whatever always re-queries the live DOM.
  const els = {
    get typedEl() {
      return document.getElementById("typed-text");
    },
    get searchBar() {
      return document.getElementById("search-bar");
    },
    get submitBtn() {
      return document.getElementById("search-submit");
    },
    get typingCursor() {
      return document.getElementById("cursor");
    },
    get loadingBlock() {
      return document.getElementById("loading-block");
    },
    get statusEl() {
      return document.getElementById("status-text");
    },
    get unfoldOuter() {
      return document.getElementById("unfold-outer");
    },
    get unfoldInner() {
      return document.getElementById("unfold-inner");
    },
    get rawListEl() {
      return document.getElementById("raw-list");
    },
    get phase1() {
      return document.getElementById("phase1");
    },
    get track() {
      return document.getElementById("track");
    },
    get dots() {
      return document.querySelectorAll(".phase-dot");
    },
    get barLabel() {
      return document.getElementById("bar-label");
    },
    get prepBtnSelected() {
      return document.getElementById("prep-btn-3");
    },
    get cardSelected() {
      return document.getElementById("card-3");
    },
    get tp3Panel() {
      return document.getElementById("tp3");
    },
    get chipEmail() {
      return document.getElementById("chip-email");
    },
    get chipConsultative() {
      return document.getElementById("chip-consultative");
    },
    get msgLabel() {
      return document.getElementById("msg-label");
    },
    get msgBox() {
      return document.getElementById("msg-box");
    },
    get sendBtn() {
      return document.getElementById("send-btn");
    },
    get sentToast() {
      return document.getElementById("sent-toast");
    },
    get demoWrap() {
      return document.querySelector(".demo-wrap");
    },
    get stageEl() {
      return document.querySelector(".stage");
    },
    get mouseCursor() {
      return document.getElementById("cursor-el");
    },
    get clickRing() {
      return document.getElementById("click-ring");
    },
    get snapshotCount() {
      return document.getElementById("snapshot-count");
    },
    get legendRows() {
      return document.querySelectorAll(".snap-legend-row");
    },
    get snapStatBoxes() {
      return document.querySelector(".snap-stat-boxes");
    },
    get segHigh() {
      return document.getElementById("seg-high");
    },
    get segGood() {
      return document.getElementById("seg-good");
    },
    get segLow() {
      return document.getElementById("seg-low");
    },
    get segContacted() {
      return document.getElementById("seg-contacted");
    },
  };

  // Brings the market snapshot to life on entry: donut segments draw in
  // one after another, the total count counts up, legend rows and the
  // stat boxes stagger in — instead of the whole panel just appearing
  // fully formed and static.
  function animateSnapshot() {
    els.segHigh.style.strokeDasharray = "0 238.76";
    els.segGood.style.strokeDasharray = "0 238.76";
    els.segLow.style.strokeDasharray = "0 238.76";
    els.segContacted.style.strokeDasharray = "0 238.76";
    els.snapshotCount.textContent = "0";
    els.legendRows.forEach((r) => {
      r.style.opacity = "0";
      r.style.transform = "translateX(-8px)";
    });
    els.snapStatBoxes.style.opacity = "0";
    els.snapStatBoxes.style.transform = "translateY(6px)";

    // Each segment's fill takes 350ms and they're scheduled fully
    // sequentially — each starts exactly when the previous one finishes
    // — so the whole donut fills as one continuous clockwise sweep, like
    // a clock hand moving around, rather than multiple segments growing
    // from different points at once.
    //
    // Fill order tells a story: the market broadly returns a large pool
    // of leads first (contacted, then low — the bulk, least-qualified
    // segments, positioned top-right sweeping down through the bottom),
    // narrowing down through each qualification stage (good, continuing
    // the sweep up the left side), and finally landing on the small,
    // exclusive gold "high-opportunity" slice last (top-left, closing
    // the loop back to the start) — not gold appearing first as if it
    // were already known. Every segment grows the same simple, natural
    // way: forward, clockwise, from its own fixed start point — no
    // segment fills backward or from a different direction than any
    // other, consistent with how the phase-1 loading circle behaves.
    scopedSetTimeout(() => {
      els.segContacted.style.strokeDasharray = "46.50 238.76";
    }, 0);
    scopedSetTimeout(() => {
      els.segLow.style.strokeDasharray = "95.28 238.76";
    }, 350);
    scopedSetTimeout(() => {
      els.segGood.style.strokeDasharray = "60.97 238.76";
    }, 700);
    scopedSetTimeout(() => {
      els.segHigh.style.strokeDasharray = "36.01 238.76";
    }, 1050);

    const target = 842;
    const duration = 900;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      els.snapshotCount.textContent = Math.round(progress * target);
      if (progress < 1) scopedRAF(tick);
    }
    scopedRAF(tick);

    els.legendRows.forEach((row, i) => {
      scopedSetTimeout(
        () => {
          row.style.opacity = "1";
          row.style.transform = "translateX(0)";
        },
        600 + i * 150,
      );
    });

    scopedSetTimeout(() => {
      els.snapStatBoxes.style.opacity = "1";
      els.snapStatBoxes.style.transform = "translateY(0)";
    }, 1500);
  }

  const statuses = ["Scanning the market…", "Checking web presence…", "Detecting opportunity signals…"];
  const rawNames = [
    "Baltic Digital AB",
    "Kvist & Partners",
    "North Signal Media",
    "Örn Consulting",
    "Fyra Studios",
    "Reva Marketing Group",
    "Hallonberg Media",
    "Stensson Digital",
    "Klarvik Studio",
    "Ängby Consulting",
  ];

  function setDot(i) {
    els.dots.forEach((d, idx) => (d.style.background = idx === i ? "#e8b72d" : "#333"));
  }

  // Custom-duration scroll (native smooth-scroll is too fast, typically
  // 300-500ms, to read as someone genuinely browsing a list).
  function slowScrollTo(el, targetTop, duration, onDone) {
    const startTop = el.scrollTop;
    const distance = targetTop - startTop;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      el.scrollTop = startTop + distance * eased;
      if (progress < 1) scopedRAF(tick);
      else if (onDone) onDone();
    }
    scopedRAF(tick);
  }

  function typeQuery(cb) {
    console.log(
      "[vantio-hero] typeQuery() started, els.typedEl found:",
      !!els.typedEl,
      "query:",
      JSON.stringify(query),
    );
    let i = 0;
    (function step() {
      if (i <= query.length) {
        const text = query.slice(0, i);
        // els.typedEl is a live getter (see the `els` object above) — this
        // always writes to whatever's actually on screen right now, so it
        // can't silently go stale even if React replaces this node.
        if (els.typedEl) els.typedEl.textContent = text;
        console.log(`[vantio-hero] step() i=${i} set textContent to "${text}"`);
        i++;
        scopedSetTimeout(step, 65);
      } else {
        console.log("[vantio-hero] typeQuery() finished, calling cb()");
        cb();
      }
    })();
  }

  // Moves the mouse cursor to the center of a target element, pauses
  // briefly as if arriving, plays a click pulse + expanding ring, then
  // fires onArrive. Positions are calculated live against demoWrap so
  // this works regardless of which track panel is currently visible.
  function clickOn(targetEl, onArrive, onDone) {
    const wrapRect = els.demoWrap.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const x = targetRect.left - wrapRect.left + targetRect.width / 2 - 8;
    const y = targetRect.top - wrapRect.top + targetRect.height / 2 - 8;

    els.mouseCursor.style.left = x + "px";
    els.mouseCursor.style.top = y + "px";
    els.mouseCursor.classList.add("visible");

    scopedSetTimeout(() => {
      els.mouseCursor.classList.add("clicking");
      els.clickRing.classList.add("pinging");
      onArrive();
      scopedSetTimeout(() => {
        els.mouseCursor.classList.remove("clicking");
        els.clickRing.classList.remove("pinging");
        scopedSetTimeout(() => {
          els.mouseCursor.classList.remove("visible");
          if (onDone) onDone();
        }, 350);
      }, 350);
    }, 750);
  }

  function resetAll() {
    els.typedEl.textContent = "";
    els.searchBar.classList.remove("submitted");
    els.submitBtn.classList.remove("clicked");
    els.loadingBlock.classList.remove("visible");
    els.unfoldInner.classList.remove("open");
    els.unfoldOuter.classList.remove("faded");
    els.rawListEl.innerHTML = "";
    els.phase1.classList.remove("swiping-out");
    els.phase1.style.opacity = "1";
    els.prepBtnSelected.classList.remove("clicked");
    els.cardSelected.classList.remove("pressed");
    els.chipEmail.classList.remove("active");
    els.chipConsultative.classList.remove("active");
    els.msgLabel.style.opacity = "0";
    els.msgBox.style.opacity = "0";
    els.sendBtn.style.opacity = "0";
    els.sendBtn.classList.remove("sent");
    els.sentToast.style.opacity = "0";
    els.sentToast.style.transform = "translateX(-6px)";
    els.mouseCursor.classList.remove("visible");
    els.tp3Panel.scrollTop = 0;
    els.segHigh.style.strokeDasharray = "0 238.76";
    els.segGood.style.strokeDasharray = "0 238.76";
    els.segLow.style.strokeDasharray = "0 238.76";
    els.segContacted.style.strokeDasharray = "0 238.76";
    els.snapshotCount.textContent = "0";
    els.legendRows.forEach((r) => {
      r.style.opacity = "0";
      r.style.transform = "translateX(-8px)";
    });
    els.snapStatBoxes.style.opacity = "0";
    els.snapStatBoxes.style.transform = "translateY(6px)";
    els.track.style.transition = "none";
    els.track.style.transform = "translateX(0)";
    void els.track.offsetWidth;
    els.track.style.transition = "transform 0.8s cubic-bezier(0.65,0,0.35,1)";
    setDot(0);
    els.barLabel.textContent = "vantioapp.com — Lead Tool";
    els.typingCursor.style.display = "inline-block";
  }

  function runSequence() {
    console.log("[vantio-hero] runSequence() called");
    try {
      resetAll();
      console.log("[vantio-hero] resetAll() completed");
    } catch (err) {
      console.error("[vantio-hero] resetAll() threw:", err);
      return;
    }

    typeQuery(() => {
      els.typingCursor.style.display = "none";

      // Cursor clicks the SCAN button to submit the search
      clickOn(els.submitBtn, () => {
        els.submitBtn.classList.add("clicked");
        scopedSetTimeout(() => els.submitBtn.classList.remove("clicked"), 200);
        els.searchBar.classList.add("submitted");
      });

      scopedSetTimeout(() => {
        els.loadingBlock.classList.add("visible");
        let si = 0;
        els.statusEl.textContent = statuses[0];
        const statusTimer = scopedSetInterval(() => {
          si = (si + 1) % statuses.length;
          els.statusEl.textContent = statuses[si];
        }, 900);

        scopedSetTimeout(() => {
          clearInterval(statusTimer);
          els.loadingBlock.classList.remove("visible");
          rawNames.forEach((n, i) => {
            const row = document.createElement("div");
            row.className = "raw-row";
            row.style.animationDelay = i * 0.12 + "s";
            row.innerHTML = `<div class="raw-dot"></div><span style="font-size:12px; color:#aaa;">${n}</span>`;
            els.rawListEl.appendChild(row);
          });
          els.unfoldInner.classList.add("open");
          scopedSetTimeout(() => els.unfoldOuter.classList.add("faded"), 700);
          setDot(1);

          scopedSetTimeout(() => {
            els.phase1.classList.add("swiping-out");
            els.track.style.transform = "translateX(-33.333%)";
            els.barLabel.textContent = "vantioapp.com — Home";
            setDot(1);
            scopedSetTimeout(animateSnapshot, 850);

            scopedSetTimeout(() => {
              els.track.style.transform = "translateX(-66.666%)";
              setDot(2);

              // Single scroll down — stops at a position where the
              // selected (3rd) card is visible but the 5th lead is not
              // yet even half revealed, then clicks and transitions
              // right there rather than scrolling further and back.
              scopedSetTimeout(() => {
                const lastCard = els.tp3Panel.querySelector(".score-card:last-child");
                const halfLastCardLimit = lastCard.offsetTop + lastCard.offsetHeight / 2 - els.tp3Panel.clientHeight;
                const selectedVisibleTarget = Math.max(0, els.cardSelected.offsetTop - 20);
                const targetTop = Math.max(0, Math.min(selectedVisibleTarget, halfLastCardLimit));

                slowScrollTo(els.tp3Panel, targetTop, 2800, () => {
                  clickOn(els.prepBtnSelected, () => {
                    els.cardSelected.classList.add("pressed");
                    els.prepBtnSelected.classList.add("clicked");
                  });
                });

                scopedSetTimeout(() => {
                  els.track.style.transform = "translateX(-100%)";
                  setDot(3);
                  els.barLabel.textContent = "vantioapp.com — Outreach";

                  // Cursor selects channel, then tone (chained via onDone so the
                  // second click never starts until the first cursor animation
                  // has genuinely finished — fixed timing offsets caused the
                  // cursor to reposition mid-fade before).
                  scopedSetTimeout(() => {
                    clickOn(
                      els.chipEmail,
                      () => els.chipEmail.classList.add("active"),
                      () => {
                        clickOn(
                          els.chipConsultative,
                          () => els.chipConsultative.classList.add("active"),
                          () => {
                            els.msgLabel.style.opacity = "1";
                            els.msgBox.style.opacity = "1";
                            els.sendBtn.style.opacity = "1";

                            // Cursor clicks Send as the final action of the sequence
                            scopedSetTimeout(() => {
                              clickOn(els.sendBtn, () => {
                                els.sendBtn.classList.add("sent");
                                els.sendBtn.style.transform = "scale(0.94)";
                                scopedSetTimeout(() => {
                                  els.sendBtn.style.transform = "scale(1)";
                                }, 150);

                                els.sentToast.style.opacity = "1";
                                els.sentToast.style.transform = "translateX(0)";
                                scopedSetTimeout(() => {
                                  els.sentToast.style.opacity = "0";
                                  els.sentToast.style.transform = "translateX(-6px)";
                                }, 1350);
                              });
                            }, 525);
                          },
                        );
                      },
                    );
                  }, 900);

                  scopedSetTimeout(() => {
                    els.stageEl.classList.add("fading");
                    scopedSetTimeout(() => {
                      runSequence();
                      scopedSetTimeout(() => els.stageEl.classList.remove("fading"), 50);
                    }, 500);
                  }, 7625);
                }, 4550);
              }, 900);
            }, 5200);
          }, 3400);
        }, 2600);
      }, 900);
    });
  }

  console.log("[vantio-hero] about to call runSequence() for the first time");
  try {
    runSequence();
  } catch (err) {
    console.error("[vantio-hero] runSequence() threw synchronously:", err);
  }
  console.log("[vantio-hero] runLandingAnimations() setup finished (async timers now scheduled)");

  return () => {
    timeouts.forEach((id) => clearTimeout(id));
    intervals.forEach((id) => clearInterval(id));
    rafs.forEach((id) => cancelAnimationFrame(id));
  };
}
