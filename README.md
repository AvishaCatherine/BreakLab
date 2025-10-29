# BreakLab
BreakLab — a Chrome extension that helps developers visualize, debug, and stress-test their websites in real time. From layout mapping to performance heatmaps and AI-powered insights, BreakLab lets you break your site safely before your users do — smart, visual debugging made effortless.

🧩 BreakLab — Stress-Test Your Web Like a Pro

BreakLab is a Chrome extension built for developers and designers to visually debug, analyze, and stress-test live websites.
It turns complex front-end inspection into an interactive, real-time experience, helping you spot layout flaws, performance bottlenecks, and accessibility gaps instantly.


🌟 Key Features

🎨 Layout View

Highlights all DOM structures in real-time with color-coded boxes — perfect for understanding webpage hierarchy and structure.

🌈 Contrast Checker

Instantly evaluates and visualizes text–background contrast.
Dynamic updates ensure accessibility colors are tracked even as you scroll.

🔥 Performance Heat Map

Displays “hot zones” where rendering cost is high.
Useful for finding DOM-heavy sections or inefficient layout reflows.

🕶️ Shadow DOM View

Reveals hidden Shadow DOM boundaries — giving you visibility into components that traditional DevTools might miss.

🧠 AI Debug Suggestions (Powered by Google Gemini)

Your personal debugging assistant.
Get real-time, AI-powered insights on layout instability, accessibility issues, and color inconsistencies — directly from within the extension.

🎯 Why BreakLab?

Unlike traditional DevTools, BreakLab focuses on visual intuition.
Instead of combing through code, you see what’s wrong.
It helps developers break their website safely before their users do, catching potential UI/UX issues early.

BreakLab is designed for:

Front-end developers debugging layouts

Designers testing color contrast and visual hierarchy

QA engineers checking rendering performance

Students learning DOM structure and accessibility

⚡ Prerequisites

Before using BreakLab, make sure your setup meets these requirements:

Google Chrome Version

Version ≥ 128.0

Developer Mode enabled in chrome://extensions/

Permissions

“Access to all sites” (required for live DOM overlays)

“Scripting” permission for injecting analysis tools

🚀 Installation
Step 1: Clone the Repository

git clone https://github.com/AvishaCatherine/BreakLab.git

Step 2: Load the Extension

Open Chrome and go to chrome://extensions/

Enable Developer Mode (top-right corner)

Click Load Unpacked

Select your BreakLab folder

The green BreakLab icon will appear in your Chrome toolbar

⚙️ Features in Detail
1️⃣ Layout Visualization

Color-coded outlines group similar DOM elements

Will soon include dimension labels (width × height)

Dynamically updates as you scroll

2️⃣ Real-Time Contrast Tracking

Evaluates color contrast ratios

Ensures WCAG accessibility compliance

Auto-updates with scrolling and resizing

3️⃣ Performance Heat Map

Heat intensity corresponds to DOM depth and rendering cost

Helps you identify heavy components visually

4️⃣ Shadow DOM Explorer

Detects hidden Shadow DOM trees

Allows deeper inspection for component-based frameworks

5️⃣ AI Bug Suggestions

Integrated with Google Gemini API

Provides intelligent debugging tips, layout improvement hints, and accessibility warnings

💡 How It Works

BreakLab runs as a Chrome extension that uses:

Popup controls for feature selection

Content scripts for injecting live visualizations

Google Gemini API for contextual debugging advice

Once activated, it overlays your current webpage with visual indicators.
As you scroll or interact, BreakLab recalculates the layout and performance data in real-time.

🔒 Privacy & Security

BreakLab runs entirely on your browser —
no external data collection, no trackers, and no cloud dependencies.

If Gemini AI suggestions are enabled, only anonymized DOM summaries are sent securely to Google’s API (never your full page data).

⚠️ Troubleshooting

If you face issues:

Check if Developer Mode is enabled in Chrome

Refresh your target webpage

Ensure permissions for “Access to site data” are granted

If overlays freeze, toggle the feature off and on again

🧠 Built With

HTML
CSS
JavaScript
Chrome Manifest V3

Google Gemini API

📝 License
MIT License

----------------------------------------------------------------------------------------------------------------------------------------------------
💚 Made with precision for developers who love breaking and building beautiful web experiences.


“Break your site safely before your users do.”
