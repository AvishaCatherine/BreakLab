# BreakLab
BreakLab — a Chrome extension that helps developers visualize, debug, and stress-test their websites in real time. From layout mapping to performance heatmaps and AI-powered insights, BreakLab lets you break your site safely before your users do — smart, visual debugging made effortless.


🧩 BreakLab — Chrome Extension

BreakLab is an advanced developer-focused Chrome extension that helps you visualize, debug, and stress-test your website in real time.
From layout mapping to AI-powered insights, BreakLab lets you break your site safely before your users do.

🚀 Features

Layout View – Highlights all DOM structures with color-coded outlines.

Contrast Checker – Evaluates and visualizes live color contrast.

Performance Heat Map – Detects heavy DOM regions and reflow costs.

Shadow DOM View – Reveals hidden Shadow DOM boundaries.

AI Bug Suggestions (Google Gemini) – Smart, context-aware debugging recommendations.

Dev Insight Mode – Hover-based inspection for tags, sizes, and classes.

🛠️ Built With

HTML

CSS

JavaScript

Chrome Manifest V3

Google Gemini API

💡 Inspiration

Modern websites often look perfect — until something breaks.
BreakLab was built to help developers identify visual flaws, layout instability, and accessibility issues early, without heavy DevTools overhead.

⚙️ How We Built It

BreakLab integrates popup UI controls with content scripts injected into web pages.
Dynamic overlays analyze layout, color contrast, and performance metrics in real time.
Each feature updates as you scroll or resize — ensuring live, accurate debugging feedback.

🧩 Challenges We Ran Into

Managing scroll-linked overlays without lag.

Preventing DOM flooding from real-time analysis.

Aligning the settings UI perfectly within Chrome’s popup window.

Integrating Gemini AI securely for contextual code suggestions.

🏆 Accomplishments We’re Proud Of

Built a fully functional live DOM analyzer with real-time color, layout, and performance views.

Achieved smooth, lag-free overlays with clean, minimal UI.

Integrated AI-powered debugging using Google Gemini.

🧠 What We Learned

Deep understanding of Chrome’s Manifest V3 architecture.

Efficient DOM traversal and throttled rendering.

How to design for developers — minimal yet powerful UX principles.

🔮 What’s Next for BreakLab

Add dimension labels for Layout View (e.g., 200×150).

Expand AI debugging to auto-detect weak UI patterns.

Introduce multi-tab performance analytics.

🧪 Testing Instructions

Clone the repository.

Open Chrome → chrome://extensions/.

Enable Developer Mode.

Click Load Unpacked → select your BreakLab folder.

Open any webpage and launch BreakLab from the extensions bar.

“Break your site safely before your users do.”
