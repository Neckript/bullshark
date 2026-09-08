# Bullshark bilingual landing page design

**Date:** 2026-08-28
**Status:** Visual direction approved; specification awaiting review
**Scope:** One static, self-contained HTML landing page

## Goal

Create a simple public showcase for Bullshark that explains the product in seconds and leads visitors toward self-hosting it. The primary action is installation; GitHub is the secondary action.

The page must communicate three ideas immediately:

1. Bullshark is a modern voice and chat platform for gaming communities.
2. The community hosts and controls its own server and data.
3. The project is open source, free, and has no telemetry.

## Audience

The primary audience is French- and English-speaking gamers, community owners, and technically comfortable people looking for a Discord-like platform they can control. The installation section may be technical, but the rest of the page must remain understandable without infrastructure knowledge.

## Deliverable and location

- Add `website/index.html` as the only website source file.
- Keep HTML, CSS, JavaScript, translations, and the optimized Bullshark logo in that file.
- Do not add a framework, package, build step, analytics script, cookie banner, or third-party runtime dependency.
- The page must work when opened directly from disk and when served by any static host.

The supplied `bullshark_nex_logo.png` is the approved brand asset. It will be resized and compressed, then embedded as a data URI so the page remains a single portable file.

## Visual direction: Deep Ocean

The visual language is calm, premium, and technical rather than loud esports styling.

- Background: deep blue-green near black.
- Primary accent: cyan sampled from the logo.
- Secondary accent: the logo eye's orange, used sparingly for small status details only.
- Text: cool off-white with high-contrast muted blue-green secondary text.
- Typography: strong system sans-serif display type and a neutral system sans-serif body stack, avoiding network font requests.
- Signature element: the shark logo floats inside a restrained sonar-like circular field in the hero.
- Surfaces: square or subtly rounded edges, fine translucent dividers, and no generic glass-card collection.
- Motion: short entrance and hover transitions only. All nonessential motion is disabled under `prefers-reduced-motion`.

## Page structure

### Header

- Compact Bullshark wordmark using the supplied logo.
- Anchor links to benefits, features, and installation.
- GitHub link.
- Visible FR/EN language control.
- On narrow screens, keep the brand, GitHub action, and language control; collapse nonessential anchor links.

### Hero

- French headline: “Ta voix. Tes données. Ton serveur.”
- English headline: “Your voice. Your data. Your server.”
- One short description identifying Bullshark as a self-hosted voice and chat platform for gaming communities.
- Primary CTA scrolls to the installation section.
- Secondary CTA opens the Bullshark GitHub repository.
- The supplied shark logo is the dominant visual.

### Trust strip

Four concise facts:

- Open source, MIT licensed.
- Self-hosted.
- Low-latency voice.
- Free, with no subscription.

### Features

Three focused feature blocks:

- Low-latency voice with push-to-talk and voice activity detection.
- Video and screen sharing.
- Zero telemetry and locally controlled data.

The copy must only claim functionality documented in the repository README.

### Installation

- Explain that Bullshark can be started in a few minutes with Docker.
- Show the current Docker command from the repository README.
- Provide a “Copy command” button with visible success feedback and an accessible live announcement.
- Link to the repository documentation for full administration instructions.

### Footer

- Repeat the sovereignty statement.
- Link to GitHub, documentation, and the MIT license.
- Credit Sharkord as the upstream project without diluting the Bullshark identity.

## Bilingual behavior

- Every user-facing string exists in French and English within the HTML.
- French is the initial language when the browser language starts with `fr`; English is used otherwise.
- The user can switch languages without reloading.
- The selection is saved in `localStorage` when available; failure to access storage must not break the page.
- The script updates the document language, page title, metadata description, visible strings, and accessible labels.
- Content remains usable if JavaScript is disabled: French copy is rendered by default and links still work.

## Interaction and accessibility

- Use semantic landmarks and heading order.
- All controls and links are reachable and visibly focused by keyboard.
- Interactive targets are at least 44 pixels on touch screens.
- Text/background contrast meets WCAG AA for normal text.
- The language control exposes its current state.
- The copy button reports success or failure without relying on color alone.
- External links clearly indicate that they open GitHub and use safe `rel` attributes.
- The layout has no horizontal overflow at 320 pixels.

## Responsive behavior

- Desktop: split hero with copy on the left and logo on the right; three-column feature layout.
- Tablet: reduce display type size and spacing while preserving the split hero where practical.
- Mobile: stack the hero, place the logo below the copy, stack feature blocks, and simplify navigation.
- Verify at 320, 375, 768, 1024, and 1440 pixel widths.

## Performance and privacy

- No telemetry, trackers, cookies, remote fonts, or JavaScript libraries.
- Optimize and embed the logo at a size appropriate for the largest rendered width.
- Keep JavaScript small and defer all behavior until the document is ready.
- Avoid layout shifts by reserving the logo's dimensions.

## Error handling

- If Clipboard API access is unavailable, fall back to selecting/copying through a temporary text field.
- If copying still fails, show a clear bilingual instruction to copy the command manually.
- If `localStorage` is blocked, language switching continues for the current page view.

## Verification

- Validate the HTML structure and confirm there are no broken local or remote resources.
- Open the file directly and through a local static server.
- Exercise language switching, anchor navigation, GitHub/documentation links, and command copying.
- Check keyboard focus, reduced-motion behavior, and layout at the target widths.
- Capture desktop and mobile screenshots for visual review.
- Confirm Git only contains the intended website, design document, and no `.superpowers/` brainstorming artifacts.

## Explicitly out of scope

- Authentication, server discovery, account creation, downloads API, pricing, blog, analytics, CMS, or backend work.
- Modifying the existing Bullshark client or server.
- Hosting or deployment of the landing page.
- Claims or roadmap items not already documented as available in the repository README.
