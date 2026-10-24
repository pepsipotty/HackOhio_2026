---
name: Rep One
description: A flat-pack assembly manual for your body, printed on one ultramarine flood.
colors:
  flood: "oklch(0.47 0.24 264)"
  flood-deep: "oklch(0.36 0.20 264)"
  flood-mid: "oklch(0.56 0.21 264)"
  flood-light: "oklch(0.70 0.14 264)"
  paper: "#ffffff"
  paper-soft: "oklch(0.90 0.05 264)"
  ink: "oklch(0.28 0.16 264)"
  ink-soft: "oklch(0.42 0.12 264)"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "clamp(64px, 10vw, 168px)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "-0.02em"
    fontVariation: "wdth 125"
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "clamp(40px, 5.2vw, 76px)"
    fontWeight: 800
    lineHeight: 0.95
    fontVariation: "wdth 112"
  title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 32px)"
    fontWeight: 750
    lineHeight: 1.1
    fontVariation: "wdth 100"
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 420
    lineHeight: 1.55
    fontVariation: "wdth 100"
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
    fontVariation: "wdth 88"
rounded:
  card: "20px"
  panel: "32px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  s8: "64px"
  s9: "96px"
components:
  button-glass:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "18px 30px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "16px 28px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    height: "34px"
  chip-pressed:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  parts-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "6px"
  step-key:
    backgroundColor: "{colors.flood}"
    textColor: "{colors.paper-soft}"
    rounded: "6px"
    size: "56px"
  step-key-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  demo-panel:
    backgroundColor: "{colors.flood-deep}"
    textColor: "{colors.paper}"
    rounded: "{rounded.panel}"
---

# Design System: Rep One

## Overview

**Creative North Star: "The Assembly Manual"**

Rep One is a flat-pack instruction manual for your body, printed on a single ultramarine flood. The page is the colour: every page is blue, every mark is white. Exercises are numbered steps, each drawn as white line art from the angle that shows it best. Depth is never shaded; it comes from overlapping flat tints of the same hue, like cut paper.

Scale is bimodal. Giant expanded-black numerals and display type jump straight to small uppercase caption labels, with few middle sizes. Mistakes and cues are drawn in the manual's own marks (an ink disc with a drawn cross, a ringed tick), not coloured badges. Primary buttons are the one deliberate departure from flatness: liquid glass over the blue.

**Key Characteristics:**
- One hue (264) at several lightnesses; white is the only other colour.
- Expanded-black numerals against tiny wide-tracked captions.
- Flat tints for depth; no soft shadows, no gradients except the glass highlight.
- Pill controls, large rounded panels, thin white line drawings.
- Motion is short and eased; all of it has a reduced-motion off switch.

## Colors

A monochrome-plus-white palette: five blues of one hue, white paper, and deep blue-ink for text on white.

### Primary
- **Ultramarine Flood** (`flood`): the page background on every surface, and the resting fill of step keys and preview windows.

### Secondary
- **Deep Flood** (`flood-deep`): inset panels (demo, viewport, filter band, playback bar, close band, mobile sticky step bar) and the tint behind glass labels.
- **Mid Flood** (`flood-mid`): the flat plates and oversized card numerals that sit one layer above the flood; card hover frame.
- **Light Flood** (`flood-light`): outline numerals in the parallax, far-side limbs of the figure, unselected key borders, disabled controls, scrollbar thumb.

### Neutral
- **Paper White** (`paper`): all type and line art on the flood; the fill of cards, selected chips and the plain button.
- **Paper Mist** (`paper-soft`): secondary copy and captions on the flood; dashed "placeholder" badges.
- **Manual Ink** (`ink`): text on white surfaces, selected-state text, the focus-ring halo.
- **Ink Soft** (`ink-soft`): secondary text on white cards.

### Named Rules
**The One Flood Rule.** The page background is always `flood` (or `flood-deep` for an inset). No second hue is introduced; if a new emphasis is needed, use a different lightness of the same blue or invert to white.

**The Flat Tint Rule.** Layering is shown by stepping flood, flood-mid, flood-light, flood-deep. Never by blur, drop shadow or opacity haze.

## Typography

**Display, Body, and Label Font:** Archivo Variable (with system-ui, sans-serif). One family; the width axis does the work.

**Character:** Expanded and heavy for numerals and the hero (wdth 125, 900), neutral width for reading (wdth 100), condensed-wide small caps for captions (wdth 88). Contrast comes from width and size, not from a second family.

### Hierarchy
- **Display** (900, clamp 64-168px, 0.86): hero title and giant step numerals. Tight tracking (-0.02em); hero title drops to wdth 100 only so "catalogue" fits its column.
- **Headline** (800, clamp 40-76px, 0.95): page titles, wdth 112.
- **Title** (750, clamp 24-32px, 1.1): step titles and card names.
- **Body** (420, 18px, 1.55, max 62ch): instructions and coaching copy; 17px under 480px.
- **Label** (700, 13px, 0.08em, uppercase, wdth 88): figure captions, step "of 7", card numbers and tabs, filter labels.

### Named Rules
**The No Middle Sizes Rule.** Numerals and display type are huge; everything else is body or label. Do not invent a decorative mid-size tier. Secondary numerals stay in the display style at about 0.6x (the how-it-works numbers).

## Layout

A 12-column grid, max 1440px, 24px gutter, horizontal padding `clamp(16px, 4vw, 56px)`. Landing and exercise use a 7/5 split: a large rounded panel on columns 1-7, content on 8-12. Catalogue is an auto-fill card grid (minmax 280px) with a deep filter band above. Spacing is a 4px-based scale (4, 8, 12, 16, 24, 32, 48, 64, 96); sections are separated by 96px blocks.

Responsive: under 900px the landing stacks; under 1024px the exercise viewport sits on top (55svh) and the step row plus buttons become a sticky bottom bar on deep flood. Under 768px catalogue filters collapse behind a toggle. Phones hide the far and mid parallax layers.

## Elevation & Depth

Flat by design. Depth is tonal: panels in `flood-deep` on `flood`, plates in `flood-mid`, outlines in `flood-light`, white cards on blue. Parallax layers (outline numerals, cut plates and cable stack, white arrows) move at different rates behind content, fading out with a mask. Cards lift 4px on hover (motion-safe) and gain a 2px `flood-mid` offset frame. The only non-flat effect is the glass button.

### Shadow Vocabulary
- **Focus halo** (`outline: 3px solid paper; outline-offset: 3px; box-shadow: 0 0 0 6px var(--ink)`): every focus-visible state, white outline plus ink ring.
- **Glass rim** (`inset 0 0 0 1px rgb(255 255 255 / 0.55)`): the liquid glass button edge.

### Named Rules
**The Glass Is Singular Rule.** Liquid glass (translucent white 18% fill, displacement and blur backdrop, top highlight, deep-flood label plate for contrast) is for primary buttons only. Everything else is flat.

## Shapes

Three radii: 32px panels, 20px cards, 999px pills (buttons, chips, badges, playback bar). Step keys are the exception: 6px rounded squares. Cards use concentric corners: 6px white frame around a 14px-rounded preview window. Frames use thin white lines: a 2px inset rule on the demo panel (12px in), dashed 1.5-2px borders for anything placeholder or not yet drawn. Line art is 1.5px round-cap, round-join stroke (cable 2px).

## Components

### Buttons
- **Glass primary** (`.glass`): pill, 18px 30px, label style at 15px, arrow appended to the label. Fallback without refraction support is a solid white pill with ink text. In the refract mode: translucent white, backdrop distortion, highlight sliding 12px on hover, scale 1.02 hover and 0.98 press, label on a 65% deep-flood plate.
- **Outline** (`.btn-outline`): transparent, 2px white border, same label type, 14% white fill on hover; disabled uses `flood-light`.
- **Icon glass**: 52px circle (44px on phones) for play/pause.

### Chips
Pill, 1.5px white border, transparent; hover tints to `flood` or 14% white; pressed inverts to white with ink text. Catalogue pressed chips gain a drawn tick prefix. Active-filter chips are solid white.

### Cards / Containers
Parts card: white, 20px radius, 6px padding, ink text; a flood preview window with a giant `flood-mid` numeral behind a 64px white pictogram, a "No." caption top-left and a white tab top-right. Hover shows a looping preview. Coming-soon cards use a `flood-deep` window and a dashed ink-soft badge.

### Inputs / Fields
Sort select: pill, 1.5px white border, transparent, drawn chevron, white option list with ink text. Scrub slider: 2px white track, 20px white thumb.

### Navigation
Wordmark "REP ONE" in expanded black (28px) top-left; plain text back link, underlined on hover. 72px header, no bar background.

### Step Row (signature)
One unbroken 2px white rule carrying square numbered keys (56px, 44px on small screens), expanded-black numerals. States: unvisited (light-flood border, mist text), visited and hover (white border), selected (solid white, ink text). A 4px white "now" bar sweeps along the row during playback.

### Mistake and Cue marks
Mistake: a white card holding an ink disc with a drawn white cross. Cue: a white ringed circle with a drawn tick. Both are drawn, not typed.

### Viewer
The 3D figure follows the same palette: white toon-shaded figure with a two-tone ramp (shadow side equals `flood-light`), station shapes in flat `flood-mid`, white 2px lines, on a `flood-deep` panel. Colours are read from the CSS tokens.

## Do's and Don'ts

### Do:
- **Do** keep every page on `flood`, with white type and line art.
- **Do** build depth from stacked flat blue tints.
- **Do** pair huge expanded-black numerals with small uppercase wdth-88 labels.
- **Do** draw status marks (cross, tick, dashed placeholder) in the manual's line language.
- **Do** keep a white-and-ink focus halo on every interactive element.
- **Do** label placeholder media with a dashed pill and gate all motion on `prefers-reduced-motion`.

### Don't:
- **Don't** add a second hue or a dark gym hero with a neon accent.
- **Don't** use soft shadows, blur-glow or gradient fills on surfaces; the glass highlight is the only gradient.
- **Don't** use glass for anything but primary buttons.
- **Don't** introduce a second typeface or mid-size decorative type tier.
- **Don't** use stock athlete photography.
