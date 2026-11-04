# Gemini Inline Usage Tracker

<div align="center">

[English](README.md) | [简体中文](README.zh-CN.md)

<br>

**Native-styled inline usage & reset countdown tracker docked right below the Gemini chat input.**
[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-v2.4.5-red?logo=greasyfork)](https://greasyfork.org/scripts/603683-gemini-inline-usage-tracker)
[![Direct Install](https://img.shields.io/badge/Direct%20Install-1--Click%20Install-37a77c?logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/Noctyn/gemini-inline-usage-tracker/main/gemini-usage-tracker.user.js)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Gemini%20Web-4285F4?logo=google&logoColor=white)](https://gemini.google.com)
[![Support](https://img.shields.io/badge/Userscript-Tampermonkey%20%7C%20Violentmonkey%20%7C%20ScriptCat-green.svg)](#-installation)

[Preview](#-preview) • [Key Features](#-key-features) • [Installation](#-installation) • [Technical Details](#-technical-details) • [License](#-license)

</div>

---

## 📸 Preview

### 1. Idle State
Docked cleanly beneath the input container. Displays 5-hour window usage, reset countdown, and weekly quota. Automatically adapts to dark/light theme.

<p align="center">
  <img src="./docs/images/idle.png" alt="Idle State">
</p>

### 2. Generating State
Switches to an active wave animation during streaming responses, displaying real-time generation elapsed time and word count. Automatically queries updated quotas upon completion to report exact per-turn consumption (e.g. `+3%`).

<p align="center">
  <img src="./docs/images/generating.png" alt="Generating State">
</p>

### 3. Details Panel
Hover or click to expand the full breakdown card. Inspect 5-hour and 7-day metrics, consumption pacing reference ticks, accurate reset timestamps, and trigger manual refresh.

<p align="center">
  <img src="./docs/images/panel.png" alt="Details Panel">
</p>

---

## ✨ Key Features

- **Seamless Native UI Integration**
  - Adheres strictly to Gemini's Material Design 3 design system, color palette, and corner radii.
  - Subpixel antialiasing optimizations tuned for high-DPI displays and Windows desktop scaling.
  - Automatically respects both system preferences and web theme switches (Dark / Light).

- **Generation Timer & Per-Turn Usage Tracking**
  - Displays dynamic wave animation and live response metrics (duration and output length) while streaming.
  - Silently synchronizes quota in the background once generation concludes, calculating the exact quota delta incurred by the prompt.

- **Dual-Window Quota Tracking**
  - Monitors both the short-term **5-hour sliding window** and the long-term **7-day weekly quota**.
  - **Consumption Pacing Tick**: Overlays an expected time-elapsed reference tick along the progress bar. Provides clear visual indicators when usage outpaces the linear time progression.

- **Multi-Account Isolation & Free Tier Compatibility**
  - Full support for multi-account routing (`/u/0`, `/u/1`, etc.). Isolates cached data by account context, ensuring immediate cache switches without data cross-contamination.
  - Fully compatible with dynamic quota models on Free tier accounts.

- **Timezone Correction**
  - Resolves timezone parsing inconsistencies occasionally returned by upstream API endpoints, aligning countdown timers with local machine time.

---

## 🚀 Installation
1. Install a userscript manager in your browser: [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [ScriptCat](https://scriptcat.org/).
2. Install the userscript via **[Greasy Fork](https://greasyfork.org/scripts/603683-gemini-inline-usage-tracker)** or click **[👉 1-Click Direct Install](https://raw.githubusercontent.com/Noctyn/gemini-inline-usage-tracker/main/gemini-usage-tracker.user.js)** (or copy [`gemini-usage-tracker.user.js`](./gemini-usage-tracker.user.js) manually).
3. Open or refresh [Google Gemini](https://gemini.google.com/app). The inline tracking bar will dock directly under the prompt area.

---

## ⚙️ Technical Details

To avoid unnecessary network traffic and respect Google API rate limits:
- **Background Polling**: Silently polls every 60 seconds only when the page tab is visible and active; pauses immediately when hidden or minimized.
- **Throttled Hover Interactions**: Includes a 120ms hover debounce. Reuses recent local cache if opened within 30 seconds to prevent redundant network requests.
- **Accessibility (a11y)**: Incorporates standard WAI-ARIA `progressbar` roles and value attributes for screen reader compatibility.

---

## 📄 License

[GPL-3.0](LICENSE)
