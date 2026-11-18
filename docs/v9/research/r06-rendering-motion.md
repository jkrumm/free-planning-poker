# Rendering and motion for the poker table

Research run of 2026-11-18 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 36/36. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Rendering:** Build the table as ordinary DOM. Each seat is an absolutely positioned element placed with a `transform` computed from a seat-layout function (ellipse, superellipse or rounded rectangle, spaced by arc length). Animate only `transform` and `opacity`, with CSS transitions, keyframes and `linear()` easings. This works on desktop and phones and gives screen readers and keyboards the seats for free.
- **Motion:** Not needed on the default path. Motion 14.14.0 is current and actively released, but CSS transitions already move seats and flip cards. Add Motion (`m` plus `LazyMotion` with `domAnimation`) only if you need exit animations or gesture physics that CSS cannot express.
- **Canvas:** One lazily loaded canvas layer, used only for confetti and particles.
- **PixiJS, React Three Fiber, Rive, dotLottie:** Not for the table. Rive is the right tool only if you later want a bespoke animated character such as a dealer or mascot.
- **Sound and haptics:** Opt-in and off by default. Haptics are progressive enhancement only (Android Chrome), never the only feedback.
- **Reduced motion:** One set of motion tokens that a `prefers-reduced-motion` rule overrides globally; decorative motion goes, state changes stay visible.
- **Must decide now:** votes never leave the server before reveal; seat positions are derived on the client from shape and count, not stored; motion, sound and haptic preferences live in localStorage; the DOM is the source of truth for state; reconnecting clients must not replay the reveal.

## 1. Rendering options compared

Versions are from the npm and GitHub registries as of 18 Nov 2026.

| Option | Current version (release) | Fit for a 2-30 seat table | Bundle or cost evidence | Main risk |
|---|---|---|---|---|
| DOM + CSS | Platform | Best: text, focus, screen readers, theming | 0 KB extra | Many 3D layers on weak Android phones; needs own testing |
| Motion | 14.14.0 (13 Nov 2026) | Good for presence/exit and gestures | `m` + `LazyMotion` about 5 KB initial, +24 KB `domAnimation`, +38 KB `domMax`, `useAnimate` mini 3.3 KB (Motion's own Rollup figures) | Second animation system; layout animation is FLIP-based |
| Canvas 2D | Browser API | Good for particles only | 0 KB | No DOM accessibility; you rebuild hit-testing and focus |
| PixiJS | 8.23.0 (11 Nov 2026) | Overkill for seats | Bundle size not verified | Its Canvas fallback drops filters and custom shaders |
| React Three Fiber | 9.8.2 (15 Oct 2026) | Wrong tool | three.js size not verified | Battery and GPU cost on phones; draw-call budget; poor accessibility |
| Rive | @rive-app/react-canvas 4.39.0 | Only for bespoke characters | Runtime 222-648 KB brotli by Rive's figures; Charmotion measured canvas-lite at about 373 KB | Single-device evidence only |
| dotLottie | @lottiefiles/dotlottie-react 0.22.3 | Pre-rendered clips | dotlottie-web about 433 KB brotli WASM plus 23 KB JS; lottie-web about 76 KB gzip (Charmotion, Oct 2026) | Heavier WASM player than lottie-web |

Motion's own docs say the `motion` component cannot be tree-shaken below about 43 KB, and that `m` with `LazyMotion` brings the initial render to about 5 KB. Motion's changelog shows steady size work: `drag` was made 20% smaller and `m` 6% smaller in 14.8.0 (29 Oct 2026), so older size figures overstate today's cost. Motion's layout animations use CSS `transform`, and the docs describe `layout`, `layoutId` and `arc()` paths.

### CSS features in this design

- **Trigonometric seat placement with `transform`:** This is the core. Seats are positioned with `translate()` from a computed point. Changing seat count or shape moves seats through CSS transitions on `transform`, so no layout library is needed for reflow.
- **offset-path:** Usable for a one-off flight of a chip from a seat to the pot. I did not verify its current Baseline status. Computing WAAPI keyframes from `getBoundingClientRect` is simpler and avoids the question.
- **3D card flips:** `transform-style: preserve-3d` with `backface-visibility: hidden` is the standard approach. Each flipping card is a compositing layer, so limit how many flip at once: stagger the 30-card reveal, which keeps layer count and memory down on low-end phones. (My recommendation, not a sourced claim.)
- **View Transitions:** Same-document transitions are Baseline 'newly available' since October 2025 per MDN. Cross-document transitions are 'Limited availability' per MDN's `@view-transition` page: Chrome 126 and Safari 18.2 support them, and Firefox has not shipped them. Use them for route changes such as lobby to room, not for seat movement.
- **@starting-style:** Enter animations without JavaScript. Secondary sources date it to Chrome 117, Firefox 129 and Safari 17.5 (August 2024). Good for a card or chip appearing, but I did not read a primary MDN compatibility table for it.
- **linear() easing:** Gives spring-like curves in CSS. A secondary source dates it as widely available from June 2026; treat that date as approximate.
- **Anchor positioning:** Shipped in all three engines; Firefox 147 was the last, 13 January 2026. Use it for vote popovers, reveal bubbles and tooltips anchored to a seat, not for seat placement itself.
- **Container queries:** Baseline since 2023 (newly), widely available since August 2025 per a secondary source. Use `cqmin` units so the table and avatars scale with their container. Container style queries became newly available in May 2026, which is enough for variant switching.

## 2. Seat layout algorithms

The core idea is to space seats by arc length on any closed curve, not by angle. Angular spacing on an ellipse with a different from b bunches seats near the ends of the long axis.

**Ellipse.** With semi-axes a and b, the naive position for seat i of N is x = cx + a cos t, y = cy + b sin t, where t = -pi/2 + 2 pi i / N. Use that only as a starting point. The perimeter is approximately P = pi [3(a+b) - sqrt((3a+b)(a+3b))] (Ramanujan's approximation). Place seat i at arc length s_i = i P / N, and invert the cumulative length table.

**Superellipse.** The curve |x/a|^n + |y/b|^n = 1 (Wikipedia). n = 2 is an ellipse; larger n gives a rectangle with rounded corners; n = 4 is a 'squircle'. Parametrically, x = a sgn(cos t) |cos t|^(2/n) and y = b sgn(sin t) |sin t|^(2/n). A poker-table feel is a value somewhat above 2 (my suggestion; tune visually). Wikipedia notes that CSS defines a superellipse() function with n = 2K. I did not check the CSS spec, so do not rely on it.

**Rounded rectangle.** Four straight runs and four quarter-circle arcs of radius r. Sum their lengths to get the perimeter, then place seats by arc length. For 2 seats, put them at the two short ends (head and foot), a design choice rather than a formula.

**Generic path.** Sample any shape at about 1024 points, build the cumulative length table, place seats at s_i = (i + offset) P / N with binary search. This one routine covers all three shapes.

**Viewer-relative layout.** Rotate the ring so the viewer's own seat is at the bottom centre. Seat identity stays server-side; the rotation is pure presentation.

**Size check (my arithmetic).** For a desktop ellipse with a = 400 px and b = 240 px, P is about 2042 px, so 30 seats are about 68 px apart: avatars of 56 px fit. For a phone ellipse with a = 160 px and b = 110 px, P is about 855 px, so 30 seats are about 28.5 px apart, which is too tight for avatars. Phones need a compact mode: avatars around 28-32 px with names hidden, two concentric rows, or a seat list below a width breakpoint. Decide this breakpoint now, but it does not affect the data model.

## 3. Motion, game feel and production apps

- **Duolingo** uses Rive for interactive characters and math visuals. Its engineering blog (October 2024) says it moved from programmatic drawing to Rive for cross-platform reasons, and that Rive's programmatic inputs keep functionality while moving work to design. Its creative technologists refine the animation. Lesson: bespoke art for characters and set pieces, not for core UI. Rive's own marketing quotes a Duolingo staffer on state machines; that is vendor copy.
- **Linear** (March 2026 redesign note) states design principles that bear on motion: 'Don't compete for attention you haven't earned' and 'Structure should be felt not seen'. Its refresh dimmed chrome and cut separators and icons, and it shipped incrementally behind feature flags. I did not find a motion-specific primary post, so lessons about motion are inferred from those principles.
- **Figma** renders its canvas through a C++ engine compiled to WebAssembly, moved from WebGL to WebGPU (blog, September 2025), and chose a GPU canvas over DOM, SVG and Canvas 2D for an infinite canvas with thousands of shapes. A 30-seat poker table with text and avatars does not have that problem; DOM is the right choice.
- **Kahoot, Gather, skribbl**: I found no primary engineering source for their motion or rendering stacks, so I make no claims about them.

Game feel that does not tire a daily user (my recommendations, with the reasoning):

1. Motion only on state changes: a vote lands, the round starts, the reveal happens. No idle loops.
2. Seat moves at about 250-400 ms with an ease-out; flips about 400 ms, staggered.
3. Celebration (confetti) only on consensus or a clear milestone, at most once per round.
4. Sound off by default; haptics never the only feedback.
5. Honour `prefers-reduced-motion`, and offer an in-app motion control, since WCAG treats animation triggered by interaction as something users must be able to turn off.

## 4. Accessibility and reduced motion

- WCAG 2.3.3 (Animation from Interactions, AAA) says motion triggered by interaction can be disabled unless it is essential, and lists `prefers-reduced-motion` as a sufficient technique. WCAG 2.2.2 (Pause, Stop, Hide) applies to animation the page starts on its own, such as an idle loop; avoid those or give a pause control.
- Build seats as focusable buttons in a logical DOM order (not the visual ring order), with arrow-key navigation. A canvas-first design would have to rebuild all of this.
- Announce state, not every change: an `aria-live=polite` region reports 'n of m have voted' at intervals or on completion, and the reveal result on reveal. Never announce each vote value before reveal.
- Reduced motion: keep opacity fades and colour changes, drop transforms, flips become instant face swaps, confetti is off.
- Votes must be readable as text and not conveyed by colour alone.

## 5. Low-end mobile performance

- web.dev's guidance is to animate only `transform` and `opacity` and to avoid properties that trigger layout or paint. Use `will-change` sparingly and verify with DevTools, looking for dropped frames and paint flashing. Seat positions and flips should use transforms and opacity exclusively.
- Do not drive per-frame motion through React state. Motion's docs say motion values avoid re-renders. With the React Compiler, use CSS custom properties set on the table root or WAAPI, not 30 React state updates per frame.
- Cap particles (for example about 150 on desktop, about 60 on phones, my suggestion), pause when the tab is hidden, and respect the reduced-motion setting.
- Callstack's 2023 React Native test measured about 60 FPS for Rive against about 17 FPS for Lottie on a 2014 Sony Xperia Z3. That is one device, one framework, and 2023, so it shows only that weak devices can separate runtimes. It is no evidence for DOM against canvas.
- R3F's docs recommend `frameloop='demand'` to save battery, keep draw calls to a few hundred, and reuse geometries. Those are the costs a 3D table would bring to phones.
- I found no published benchmark of 30 DOM seats with 30 concurrent 3D flips on low-end Android. Measure it on a real mid-range phone before launch.

## 6. Sound design with Web Audio

- Browsers require the audio context to be created or resumed inside a user gesture. MDN's best-practice guide recommends creating or resuming it from a click handler, and suggests howler.js for simple playback or tone.js for scheduling and synthesis.
- Load short sounds with `fetch` and `decodeAudioData` into `AudioBuffer`s, which MDN says suits short, sample-like tracks.
- Keep the set small: a vote tick, a reveal sting, a consensus chime, and a 'new round' cue, four or five sounds in total (my suggestion).
- Default off, with a visible toggle set once the user has clicked. Store the preference in localStorage, which matches the anonymous model.
- I did not verify whether iOS silent-switch behaviour mutes Web Audio in Safari; test on a physical iPhone.

## 7. Haptics

- `navigator.vibrate` works only in Chromium on Android, only after the user has tapped (sticky user activation), and without intensity control. Firefox does not support it, and Safari on iPhone never has.
- On iPhone, the only haptic a page can trigger is the system tick of a native `<input type='checkbox' switch>`. That worked from iOS 17.4 to 26.4. Since iOS 26.5, WebKit requires a trusted event, so a script `.click()` no longer ticks. A real tap landing on a transparent label over the switch still does, according to a 3 November 2026 tutorial, and its author says the approach is fragile.
- Recommendation: wrap `navigator.vibrate` in a helper that returns false instead of throwing, add the iOS label trick only if you accept breakage between iOS releases, and never make haptics the only feedback for a vote or a reveal.

## 8. Confetti and particles

- `canvas-confetti` (1.9.4 on npm) is a small, single-purpose canvas library. Lazy-load it on first reveal, on its own canvas overlay that has `pointer-events: none`.
- Fire it only on consensus, and never when reduced motion is set.
- The particle canvas must handle devicePixelRatio and resize, and must stop its own animation loop when empty.
- Do not build a particle system into the table. Keep it separate so it can be removed without touching the seat layer.

## 9. Recommendation

Use the DOM-first, CSS-driven approach:

1. Seats are DOM elements placed by a shared layout function (ellipse, superellipse or rounded rectangle, arc-length spaced, viewer-relative).
2. Motion is CSS: transform and opacity transitions, `linear()` easings, `@starting-style` for enters, anchor positioning for popovers, container queries for scaling.
3. The reveal is a staggered flip sequence, with reduced-motion overrides from one token set.
4. Confetti is a lazy-loaded canvas overlay; sound and haptics are opt-in layers.
5. Motion is added only if exit or gesture needs arise, through `LazyMotion` with `domAnimation`, so the initial bundle stays small.
6. Rive is held in reserve for a bespoke character.

This fits the stack: React 19 and the React Compiler keep rendering cheap, Tailwind 4 and Base UI give the DOM primitives, and the accessibility model comes for free.

## 10. Main tradeoffs

- **DOM vs canvas:** DOM gives accessibility, text, and form and focus behaviour. Canvas gives fine particle and shader control and fewer layers. Here DOM wins on everything except particles.
- **CSS vs Motion:** CSS has no bundle cost and matches the transform-only budget. Motion gives exit animations (AnimatePresence) and springs with gesture handling, at a bundle cost, and its layout animation is FLIP-based. Start with CSS and add Motion only where a concrete requirement appears.
- **Rive vs CSS:** Rive gives state machines and authored character animation at a runtime cost of 222-648 KB brotli by Rive's figures. Not worth it for seats.
- **Phone density:** 30 seats on a phone need a compact or list mode. A single ring cannot fit avatars.
- **Daily use:** Restraint is a product decision. A tool used every day needs fewer, shorter, optional effects, and a fast path that skips them.

## 11. What must be decided now (cannot be retrofitted)

1. **Vote privacy at the protocol level.** Do not send vote values to clients before reveal; CSS hiding leaks them to anyone who opens devtools. The animation should carry only a 'has voted' boolean until the reveal event.
2. **Seat model.** Seats are an ordered list of anonymous client ids with a count, with no stored coordinates. Geometry is client-side, so changing shape or the phone layout needs no migration.
3. **DOM as the source of truth,** with a keyboard and screen-reader model defined up front. A canvas-first design cannot be made accessible later without a parallel DOM.
4. **Sequenced events.** Give reveal and round events sequence numbers so a reconnecting client does not replay a celebration, and so animations can be skipped safely.
5. **Preferences in localStorage:** reduced motion override, sound, haptics. Default sound and haptics off.
6. **Motion tokens.** Durations and easings as CSS custom properties from day one, so reduced motion is one override.
7. **Phone breakpoint and compact seat mode** for large rooms, decided before layout code is written.

## 12. What stayed open

- PixiJS and three.js bundle sizes, and Pixi's performance on low-end phones, are not measured here.
- Motion's current bundle figures come from Motion's docs and may be stale against 14.x.
- Cross-document view transitions in Firefox: MDN shows limited availability; I found no Mozilla roadmap page.
- Baseline dates for `@starting-style` and `linear()` rest on secondary sources.
- No primary engineering sources were read for Kahoot, Gather or skribbl.
- iOS silent-switch behaviour for Web Audio is untested.
- No benchmark of 30 DOM seats with concurrent 3D flips on low-end Android was found.

## Not verified in this run

- PixiJS and three.js bundle sizes, and PixiJS performance on low-end phones: No primary bundle measurement was found or read; the PixiJS search returned no size figures.
- Current Motion bundle sizes for version 14.x: The size figures come from Motion's docs (Rollup builds) and may be stale; the changelog shows size reductions since then.
- Cross-document view transitions in Firefox: MDN shows limited availability; the claim that Firefox support is still in development rests on a secondary source, with no Mozilla roadmap page read.
- Baseline dates for @starting-style and linear(): Only secondary sources were found (agent-skill repositories); no MDN compatibility table was read for these features.
- Motion and game-feel practices at Kahoot, Gather and skribbl: Searches returned no primary engineering source for these apps' animation or rendering stacks.
- Web Audio behaviour under the iOS silent switch: Not verified; needs a test on a physical iPhone.
- 30 DOM seats with concurrent 3D card flips on low-end Android: No published benchmark found; this needs a measurement on a real mid-range phone.
- canvas-confetti bundle size: Only the version was read; the package page was not fetched for its size.
- iOS haptic label technique stability after iOS 26.5: A single tutorial from November 2026 describes it; WebKit's bug and commit were not read directly, and the technique may change again.

## Sources

- https://www.npmjs.com/package/motion
- https://motion.dev/changelog
- https://motion.dev/docs/react-motion-component
- https://motion.dev/docs/react-layout-animations
- https://motion.dev/docs/react-reduce-bundle-size
- https://www.npmjs.com/package/pixi.js
- https://github.com/pixijs/pixijs/releases/tag/v8.23.0
- https://github.com/pmndrs/react-three-fiber/releases/tag/v9.8.2
- https://r3f.docs.pmnd.rs/advanced/scaling-performance
- https://www.npmjs.com/package/@rive-app/react-canvas
- https://www.npmjs.com/package/@lottiefiles/dotlottie-react
- https://www.npmjs.com/package/canvas-confetti
- https://charmotion.app/guides/rive-vs-lottie-performance
- https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@view-transition
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning
- https://blog.teliaz.com/2026/10/21/view-transitions-in-2026-same-document-cross-document-and-the-firefox-threshold/
- https://dev.to/richicodes/css-anchor-positioning-tooltips-that-flip-3ld6
- https://handoff.design/guides/modern-css/
- https://github.com/brndngln/agent-skills-HORMOZI/blob/main/skills/web-ui/modern-css/TRANSITIONS-AND-STARTING-STYLE.md
- https://github.com/Sensiblemnd/css-reasoning-engine/blob/main/skills/shared/references/browser-profiles.md
- https://web.dev/articles/animations-guide
- https://en.wikipedia.org/wiki/Superellipse
- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- https://dev.to/wingo-ui/web-vibration-api-haptic-feedback-on-android-and-iphone-32bk
- https://docs.flarum.org/extend/haptic-feedback/
- https://blog.duolingo.com/developing-math/
- https://rive.app/blog/creative-technologists-duolingo-s-solution-to-the-designer-to-developer-handoff
- https://linear.app/now/behind-the-latest-design-refresh
- https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
- https://github.com/pixijs/pixijs-skills/blob/83760c6f53462ca9cecd68055041f5a8c94758ce/skills/pixijs-core-concepts/references/renderers.md
- https://www.npmjs.com/package/@react-three/fiber
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning
- https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition
