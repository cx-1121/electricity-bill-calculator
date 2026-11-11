---
name: Electricity Split
description: The house's ruled ledger notebook for splitting the monthly TNB bill.
colors:
  cover-cobalt: "#2443a6"
  cover-deep: "#182f7e"
  cover-edge: "#3a58bd"
  paper: "#fbfcfe"
  feint-rule: "#c5d3ef"
  margin-red: "#e2636b"
  ballpoint: "#1f3fa6"
  ballpoint-strong: "#142d85"
  print-ink: "#1b1f2e"
  print-grey: "#4b5269"
  pencil: "#5f6679"
  pencil-hint: "#6a7183"
  pencil-faint: "#a9b0c0"
  red-pen: "#c22a35"
  stamp-ink: "#3340b3"
  highlighter: "#fff09a"
  staple-wire: "#eef1f6"
typography:
  display:
    fontFamily: "Archivo, Arial Narrow, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 68"
  headline:
    fontFamily: "Archivo, Arial Narrow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 72"
  title:
    fontFamily: "Kalam, Segoe Print, cursive"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: "Kalam, Segoe Print, cursive"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.1
  body-pencil:
    fontFamily: "Kalam, Segoe Print, cursive"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.15
  label:
    fontFamily: "Archivo, Arial Narrow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.1
    fontVariation: "'wdth' 88"
  label-printed:
    fontFamily: "Archivo, Arial Narrow, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 82"
rounded:
  hair: "2px"
  pen: "3px"
  stamp: "7px"
  round: "50%"
spacing:
  rule: "44px"
  margin-x: "54px"
  margin-x-narrow: "44px"
  gutter: "16px"
  gutter-narrow: "12px"
components:
  button-stamp:
    textColor: "{colors.stamp-ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.stamp}"
    padding: "0 26px"
    height: "66px"
  button-pen:
    textColor: "{colors.ballpoint}"
    typography: "{typography.label-printed}"
    rounded: "{rounded.pen}"
    padding: "0 6px"
    height: "40px"
  button-pen-danger:
    textColor: "{colors.red-pen}"
    typography: "{typography.label-printed}"
    rounded: "{rounded.pen}"
    padding: "0 6px"
    height: "40px"
  button-icon:
    textColor: "{colors.print-ink}"
    rounded: "{rounded.round}"
    size: "44px"
  input-ink:
    textColor: "{colors.ballpoint}"
    typography: "{typography.body}"
    rounded: "{rounded.hair}"
    padding: "0 4px"
    height: "34px"
---

# Design System: Electricity Split

## Overview

**Creative North Star: "The House Ledger"**

The app is the small ruled notebook a household keeps to tally who owes what. Each month is a page, and each housemate is a written line. What they owe is circled in ballpoint, with the working pencilled underneath. The interface never pretends to be a form. Everything the notebook *printed* (titles, section heads, field labels) is condensed grotesque caps in near-black. Everything the *user writes* (readings, names, amounts) is Kalam handwriting in ballpoint blue, sitting on the feint rule. Corrections come only in red pen.

Density follows the paper. One rule (44px) is one unit of everything: a field, a resident, an error, a line of working. Blank lines separate groups. The results page is the product's real output, because housemates receive it as a phone screenshot. So it must read as a finished, signed-off ledger page: circled totals, a double-underlined grand total, and a dated footer.

The page sits inside a cobalt cover with wire staples at the binding. On wide screens the notebook floats on the cover colour, with a stack of pages beneath it.

**Key Characteristics:**
- Feint blue rules every 44px, with a double red margin line down the left.
- Two voices: printed caps (Archivo, condensed) and ballpoint handwriting (Kalam).
- Results amounts are circled by hand-drawn ink rings, and the grand total gets an accountant's double underline.
- Red is reserved for corrections: errors, deletions and strike-throughs.
- One authored motion: turning to a new page.

## Colors

The palette is restrained: paper and ink, with one committed cobalt cover field around the page.

### Primary
- **Cover Cobalt** (#2443a6): the notebook cover. It fills the page background around the book, the binding strip and the theme-color. It does not appear on the paper itself.
- **Ballpoint Blue** (#1f3fa6): everything the user writes or the app writes on the user's behalf, such as readings, names, amounts, ticks and ink rings. Also used for pen-button links and focus outlines.
- **Ballpoint Pressed** (#142d85): circled amounts, which are written harder.

### Secondary
- **Stamp Violet-Blue** (#3340b3): only the Submit rubber stamp.

### Tertiary
- **Red Pen** (#c22a35): validation messages, squiggle underlines, margin "!" marks, strike-throughs, Delete and Move-out.
- **Margin Red** (#e2636b): the printed double margin line and the double rule under the header band.
- **Highlighter** (#fff09a): the focused input (a highlighter swipe under the text) and text selection.

### Neutral
- **Paper** (#fbfcfe): a cool white page, never cream.
- **Feint Rule** (#c5d3ef): ruled lines.
- **Print Ink** (#1b1f2e): printed titles and labels.
- **Print Grey** (#4b5269): small printed caps labels.
- **Pencil** (#5f6679): working, hints and previous readings.
- **Pencil Hint** (#6a7183): placeholders (4.8:1 on paper).
- **Pencil Faint** (#a9b0c0): leader dots only, never text.
- **Staple Wire** (#eef1f6 → #8b94a8): staple crowns.

### Named Rules
**The Red Pen Rule.** Red appears only when something is being corrected or removed. Never use it for emphasis, branding or a primary action.

**The Two Inks Rule.** User-written data is ballpoint blue, and app-printed furniture is print ink. A value that came from the user must never be set in the printed voice.

## Typography

**Printed Font:** Archivo variable (width axis 62–125, weight 400–800), with Arial Narrow as fallback.
**Handwritten Font:** Kalam 400/700, with Segoe Print as fallback.

**Character:** a cheap offset-printed notebook in condensed caps, filled in with a confident ballpoint.

### Hierarchy
- **Display** (Archivo 800, 30px, wdth 68, uppercase): page titles: "Electric Bill", "Who pays what", "Settings".
- **Headline** (Archivo 800, 15px, wdth 72, 0.14em, uppercase): section heads: The bill, Rooms, To pay, Housemates, History.
- **Title** (Kalam 700, 22–25px): resident names and circled amounts.
- **Body** (Kalam 400, 22–23px): written values and inputs.
- **Body-pencil** (Kalam 400, 17px): working lines, hints and the live Common Usage sum.
- **Label** (Archivo 500, 16px, wdth 88): bill field labels in sentence case, matching the TNB bill wording.
- **Label-printed** (Archivo 600, 12.5px, wdth 82, 0.08em, uppercase): small printed captions and pen-button text.

### Named Rules
**The Bill Wording Rule.** Field labels quote the TNB bill exactly: "Total Usage (kWh)" and "Total Bill Amount (RM)".

## Layout

The ruled page is a strict vertical grid. `--rule` is 44px, and every block inside `.ruled` is a whole number of rules tall (`.line`, or `.line.tall` for 2 rules). Text sits on the rule: lines align to `flex-end` with 6px bottom padding, and inputs pull down 7px so their handwriting lands on the rule just as names do. Content starts right of the margin at `--mx` (54px; 44px at ≤380px), and the double margin line sits 16px left of that. The margin column is reserved for red-pen marks.

The notebook is at most 560px wide, centred, and fills the viewport height on phones. At ≥640px it gains a 36px top margin, a soft page shadow and a page stack beneath it. A label and its value share one line, joined by a dotted leader where it is a ledger figure. On phones, a resident takes two lines: name and Present tick, then previous → current = usage.

## Elevation & Depth

The paper is flat, and depth exists only between the notebook and its cover.

### Shadow Vocabulary
- **Page lift** (`box-shadow: 0 2px 3px rgba(8,18,60,.28), 0 28px 60px -18px rgba(6,14,50,.6)`): the page on the cover. Desktop only.
- **Page stack** (`box-shadow: 0 6px 14px -6px rgba(6,14,50,.5)`): the sheets under the page.
- **Staple shadow** (`box-shadow: 0 1px 0 rgba(10,20,60,.35)`).

### Named Rules
**The Flat Paper Rule.** Nothing on the paper casts a shadow. Hierarchy on the page comes from ink, weight, rings and underlines.

## Shapes

The form language is that of ink on paper, not containers. There are no cards and no filled boxes. Lines (rules, leaders, underlines, double underlines, strike-throughs) and hand-drawn loops (ink rings, the tick box) carry structure. Radii are near-zero: 2–3px on inputs and pen buttons, and 7px on the stamp. The only circular shape is the 44px icon-button hit area.

## Components

### Buttons
- **Rubber stamp (primary, Submit):** a 4px double border in stamp ink, Archivo 800 caps at 23px (wdth 66, 0.22em), rotated −2.2deg, with a turbulence mask that drops out ink like a real impression. It spans two rules. On hover it gets a 7% ink wash; it scales on press and plays a short "thump" when it fires. Use one per page.
- **Pen link (secondary):** Archivo 700 caps at 13.5px in ballpoint, with a 1.5px underline at 5px offset. The underline darkens on hover. Variants: quiet (print grey) and danger (red pen).
- **Icon button:** a 44px round hit area with a 24px icon in a 1.8 stroke, round caps and joins. Hover tints it 8% ballpoint.

### Inputs / Fields
- **Style:** no border and no box. Kalam 23px ballpoint text written straight onto the rule, right-aligned for numbers. All numeric fields use `inputmode="decimal"`.
- **Focus:** a highlighter swipe (#fff09a) across the lower half of the text box.
- **Error:** a red squiggle under the field, a red-pen message on the next rule, and a "!" in the margin.

### Present tick box
A 24px hand-ruled square rotated −3deg. Ticking it draws a ballpoint check with a stroke-dash animation. When unchecked, its label drops to pencil.

### Ink ring (signature)
A hand-drawn SVG loop around each amount owed: ballpoint, 1.7px non-scaling stroke, with RM tucked inside the loop. It always renders closed, and its entrance is only a blur/scale ink-in. Every frame of it is screenshot-safe.

### Ledger lines
Summary rows are a label, a dotted leader and a written value with a small pencil unit. Each payee row reads name, then that room's kWh in pencil, then the leader and the circled amount. Working lines are pencil, indented 14px, with figures in bold ballpoint. The grand total gets a 4px double underline and a "✓ matches bill" check.

### Navigation
Pages, not routes. The gear (sliders icon) opens Settings, and a back chevron returns. Changing page plays the page-turn motion: rotateX −24deg from the binding edge, 0.62s ease-out.

## Do's and Don'ts

### Do:
- **Do** keep every block in the ruled area to a whole multiple of the 44px rule.
- **Do** write user data in Kalam ballpoint (#1f3fa6) and app furniture in Archivo caps (#1b1f2e / #4b5269).
- **Do** show the arithmetic for every amount in pencil working lines beneath it.
- **Do** strike through removed things (moved-out housemates, a month being deleted) in red rather than making them vanish.
- **Do** keep results screenshot-safe: no element may depend on an animation finishing to be legible.

### Don't:
- **Don't** use red for anything except corrections and removals.
- **Don't** put cards, filled panels or shadows on the paper.
- **Don't** use cream or parchment paper. The page is cool white (#fbfcfe).
- **Don't** set placeholder or body text in Pencil Faint (#a9b0c0); it is for leader dots only.
- **Don't** add a kicker or eyebrow label above a heading.
