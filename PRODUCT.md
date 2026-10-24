# Product

<!-- impeccable:product-schema 1 -->

> Written from the user's project brief and the approved spec (`docs/superpowers/specs/2026-10-24-rep-one-design.md`). The confirmation round was declined; lines marked *(inferred)* were not confirmed directly.

## Platform

web

## Stack

Vite + TypeScript + Three.js, multi-page, no framework (user chose this from three proposed approaches).

## Users

Beginner weightlifters learning form for the first time. *(inferred)* They are often alone, before or between gym sessions, on a laptop or phone, and unsure whether they are doing a movement safely.

## Product Purpose

Teach proper weightlifting form by breaking an exercise into small steps. On each step a 3D human model takes the correct posture, and the camera moves to the angle that shows it best. Success for this proof of concept is a smooth live demo at HackOhio 2026: landing, then catalogue, then Seated Cable Row stepped through end to end.

## Positioning

Video tutorials show a whole rep from one fixed angle at full speed. Rep One stops the movement into steps, and for each step chooses the camera angle (side, top, back, isometric) that reveals the thing to get right.

## Operating Context

Live demo on a Windows laptop in Chrome or Edge, on the laptop screen (no projector). It must also work from phone to desktop and on touch.

## Capabilities and Constraints

- Only Seated Cable Row is fully built; 31 other catalogue exercises open a "Coming soon" page.
- No backend, no accounts, no saved progress.
- Terms: "step" (one stage of an exercise), "camera preset" (side / top / back / iso), "pose" (joint angles for a step).

## Brand Commitments

- Name: **Rep One**.
- Voice: plain-language, encouraging, jargon-free (any term is defined where used); never intimidating or gym-bro.
- Visual direction pinned by the user: **one bold colour** floods each page, simple, with liquid glass primary buttons and a deep parallax landing background.

## Evidence on Hand

None yet. No 3D model, exercise GIFs, demo video or movement data exist; all are labelled placeholders. Do not invent testimonials, user counts, coach endorsements or expert claims. The Seated Cable Row instructions are a draft pending review by a qualified coach.

## Product Principles

1. One thing at a time: each step teaches one position or movement.
2. Show it from the angle that matters.
3. Encourage, never intimidate.
4. Text always works on its own: everything the 3D shows is also written out.

## Accessibility & Inclusion

*(inferred)* WCAG 2.2 AA: 4.5:1 text contrast (including on glass), full keyboard support, visible focus, reduced-motion and reduced-transparency support, text alternatives for 3D content.
