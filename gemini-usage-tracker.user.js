// ==UserScript==
// @name         Gemini Inline Usage Tracker
// @name:zh-CN   Gemini 网页端用量监测与额度显示
// @namespace    usage-tracker-of-gemini
// @version      2.5.0
// @description  Native-styled inline usage & quota tracker beneath Gemini input: multi-account isolation, 5-hour/weekly usage, reset countdowns, consumption pacing, and real-time generation metrics.
// @description:zh-CN 输入框下方的原生风格额度追踪条：精准支持多账号隔离检测，等宽通栏美化面板，无闪烁平滑挂载，5 小时 / 每周用量、重置倒计时、消耗节奏预测，并在生成回复时实时反馈耗时、字数与本次消耗。
// @homepageURL  https://github.com/Noctyn/gemini-inline-usage-tracker
// @supportURL   https://github.com/Noctyn/gemini-inline-usage-tracker/issues
// @author       omp
// @match        https://gemini.google.com/*
// @grant        none
// @run-at       document-idle
// @license      GPL-3.0
// @downloadURL  https://raw.githubusercontent.com/Noctyn/gemini-inline-usage-tracker/main/gemini-usage-tracker.user.js
// @updateURL    https://raw.githubusercontent.com/Noctyn/gemini-inline-usage-tracker/main/gemini-usage-tracker.user.js
// ==/UserScript==

(() => {
    'use strict';

    if (window.__geminiUsageTrackerLoaded) return;
    window.__geminiUsageTrackerLoaded = true;

    /* 全局强制 DateTimeFormat 默认采用 UTC+8 (Asia/Shanghai)，避免被代理节点时区误导 */
    const OrigDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function (locales, options = {}) {
        const opt = Object.assign({}, options);
        if (!opt.timeZone) opt.timeZone = 'Asia/Shanghai';
        return new OrigDateTimeFormat(locales, opt);
    };
    Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
    Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;

    /* ───────────────────────── 配置 ───────────────────────── */

    const ID = 'gut';
    const SID = 'gut-style';
    const CFG = {
        maxWidth: 760,
        pollInterval: 60_000,
        hoverRefreshGap: 30_000,
        minFetchGap: 15_000,
        warn: 60,
        danger: 80,
        hoverOpenDelay: 140,
        hoverCloseDelay: 240,
        doneHold: 5_500,
        lastReplyTtl: 15 * 60_000,
        tickDelay: 150,
        sessionWindowMs: 5 * 3_600_000,
        weeklyWindowMs: 7 * 86_400_000,
    };

    /* ───────────────────────── 多语言 ───────────────────────── */

    const lang = /^zh/i.test(document.documentElement.lang || navigator.language || '') ? 'zh' : 'en';
    const LOCALE = lang === 'zh' ? 'zh-CN' : undefined;

    const I18N = {
        zh: {
            tip: 'Gemini 额度用量',
            panelTitle: '额度用量',
            refresh: '刷新用量',
            pin: '固定面板',
            unpin: '取消固定',
            sessionTitle: '当前会话',
            sessionWin: '5 小时窗口',
            weeklyTitle: '每周限额',
            weeklyWin: '7 天窗口',
            elapsedShort: (p) => `时间已过 ${p}%`,
            s5h: '5小时用量',
            week: '周限额',
            resetIn: (d) => `${d}后重置`,
            resetAtClock: (c) => `重置于 ${c}`,
            resetSoon: '即将重置',
            resetUnknown: '重置时间未知',
            exhausted: '额度已用尽',
            runOut: (d) => `按当前速度约 ${d}后耗尽`,
            elapsedTip: (p) => `当前时间窗口已过去 ${p}%`,
            justNow: '刚刚更新',
            agoS: (n) => `${n} 秒前`,
            agoM: (n) => `${n} 分钟前`,
            agoH: (n) => `${n} 小时前`,
            failed: '更新失败，点击重试',
            failedShort: '更新失败',
            loading: '同步中…',
            details: '用量详情',
            generating: '正在生成',
            done: '生成完成',
            syncing: '同步用量…',
            chars: (n) => `${n} 字`,
            thisReply: (p) => `本次 +${p}%`,
            lastReply: (p) => `上次 +${p}%`,
            responding: (m) => `${m} 响应中`,
            freePlan: 'Free 方案',
            freeSub: '动态配额',
            freeCap: '标准容量',
            freeSessionDesc: '动态容量 · 按需分配',
            freeWeeklyDesc: '可升级以获取高级模型配额',
            dur_m: (m) => `${m} 分钟`,
            dur_h: (h) => `${h} 小时`,
            dur_hm: (h, m) => `${h} 小时 ${m} 分钟`,
            dur_d: (d) => `${d} 天`,
            dur_dh: (d, h) => `${d} 天 ${h} 小时`,
            announceWarn: (p) => `5小时用量 ${p}%`,
            announceDanger: (p) => `额度紧张，已用 ${p}%`,
            announceExhausted: '5小时额度已用尽',
        },
        en: {
            tip: 'Gemini usage',
            panelTitle: 'Usage limits',
            refresh: 'Refresh usage',
            pin: 'Pin panel',
            unpin: 'Unpin panel',
            sessionTitle: 'Current session',
            sessionWin: '5-hour window',
            weeklyTitle: 'Weekly limit',
            weeklyWin: '7-day window',
            elapsedShort: (p) => `${p}% elapsed`,
            s5h: '5h usage',
            week: 'Weekly',
            resetIn: (d) => `Resets in ${d}`,
            resetAtClock: (c) => `Resets at ${c}`,
            resetSoon: 'Resetting soon',
            resetUnknown: 'Reset time unknown',
            exhausted: 'Limit reached',
            runOut: (d) => `At this pace, runs out in ~${d}`,
            elapsedTip: (p) => `${p}% of this window has elapsed`,
            justNow: 'Updated just now',
            agoS: (n) => `Updated ${n}s ago`,
            agoM: (n) => `Updated ${n}m ago`,
            agoH: (n) => `Updated ${n}h ago`,
            failed: 'Update failed, click to retry',
            failedShort: 'Update failed',
            loading: 'Syncing…',
            details: 'Details',
            generating: 'Generating',
            done: 'Done',
            syncing: 'Syncing usage…',
            chars: (n) => `${n} chars`,
            thisReply: (p) => `This reply +${p}%`,
            lastReply: (p) => `Last +${p}%`,
            responding: (m) => `${m} is responding`,
            freePlan: 'Free plan',
            freeSub: 'Dynamic quota',
            freeCap: 'Standard',
            freeSessionDesc: 'Dynamic capacity · As available',
            freeWeeklyDesc: 'Upgrade for higher model quotas',
            dur_m: (m) => `${m}m`,
            dur_h: (h) => `${h}h`,
            dur_hm: (h, m) => `${h}h ${m}m`,
            dur_d: (d) => `${d}d`,
            dur_dh: (d, h) => `${d}d ${h}h`,
            announceWarn: (p) => `5h usage ${p}%`,
            announceDanger: (p) => `Usage high, ${p}% used`,
            announceExhausted: '5h limit reached',
        },
    };

    const t = (key, ...args) => {
        const v = I18N[lang][key] ?? I18N.en[key] ?? key;
        return typeof v === 'function' ? v(...args) : v;
    };

    /* ───────────────────────── 工具函数 ───────────────────────── */

    const $ = (sel, root = document) => root.querySelector(sel);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, Number(v) || 0));
    const levelOf = (p) => (p >= CFG.danger ? 'danger' : p >= CFG.warn ? 'warn' : 'ok');

    const fmtPct = (v) => {
        v = clamp(v);
        if (v < 0.05) return '0';
        return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
    };

    const setText = (el, v) => {
        if (!el) return;
        v = String(v ?? '');
        if (el.textContent !== v) el.textContent = v;
    };

    function fmtDuration(ms) {
        const m = Math.round(ms / 60_000);
        if (!Number.isFinite(m) || m < 1) return '';
        if (m < 60) return t('dur_m', m);
        const h = Math.floor(m / 60);
        if (h < 24) return m % 60 ? t('dur_hm', h, m % 60) : t('dur_h', h);
        const d = Math.floor(h / 24);
        return h % 24 ? t('dur_dh', d, h % 24) : t('dur_d', d);
    }

    const fmtElapsed = (sec) => (sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`);

    const HOUR_CYCLE = lang === 'zh' ? 'h23' : undefined;
    const fmtClock = (ts) =>
        new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: HOUR_CYCLE }).format(ts);
    const fmtDateTime = (ts) =>
        new Intl.DateTimeFormat(LOCALE, {
            timeZone: 'Asia/Shanghai',
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: HOUR_CYCLE,
        }).format(ts);

    function fmtUtc8Clock(ts) {
        if (!ts || !Number.isFinite(ts)) return '';
        const d = new Date(ts);
        const now = new Date();
        const timeStr = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(d);

        const dayFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', day: 'numeric' });
        const isDifferentDay = dayFmt.format(d) !== dayFmt.format(now);

        if (isDifferentDay) {
            const dateStr = new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai',
                month: 'numeric',
                day: 'numeric',
            }).format(d);
            return `${dateStr} ${timeStr} (UTC+8)`;
        }
        return `${timeStr} (UTC+8)`;
    }

    function fixQuotaBannerTimezone() {
        const resetAt = S.view?.session?.resetAt ||
            Date.parse(S.data?.pools?.find((p) => p.poolType === 'GXU_FIVE_HOURLY')?.gxu?.windowRefreshesAt || '');
        const utc8Str = resetAt ? fmtUtc8Clock(resetAt) : '';

        const nodes = document.querySelectorAll(
            'input-area-v2 *, .input-area-container *, fieldset *, [class*="banner"] *'
        );

        for (const el of nodes) {
            if (el.children.length === 0 && el.textContent) {
                const txt = el.textContent.trim();
                if (/^(?:用量)?限额将在.+重置$/.test(txt)) {
                    if (txt.includes('UTC+8')) continue;
                    if (utc8Str) {
                        el.textContent = `用量限额将在 ${utc8Str} 重置`;
                    } else {
                        refresh(true);
                    }
                }
            }
        }
    }

    function resetText(ts) {
        const d = fmtDuration(ts - Date.now());
        return d ? t('resetIn', d) : t('resetSoon');
    }

    /* ───────────────────────── DOM 构建 ───────────────────────── */

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function h(tag, props = {}, ...children) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(props)) {
            if (v == null || v === false) continue;
            if (k === 'class') node.className = v;
            else if (k === 'text') node.textContent = v;
            else node.setAttribute(k, v === true ? '' : v);
        }
        for (const c of children.flat()) {
            if (c != null && c !== false) node.append(c);
        }
        return node;
    }

    function s(tag, attrs = {}, ...children) {
        const node = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        for (const c of children) node.append(c);
        return node;
    }

    const ICON = {
        refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
        open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
        chevron: 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z',
        pin: 'M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z',
        warn: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
        sparkle: 'M12 2c.4 5.2 4.8 9.6 10 10-5.2.4-9.6 4.8-10 10-.4-5.2-4.8-9.6-10-10 5.2-.4 9.6-4.8 10-10z',
    };

    const icon = (d, size, cls) =>
        s('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor', 'aria-hidden': 'true', ...(cls ? { class: cls } : {}) }, s('path', { d }));

    /* ───────────────────────── 状态 ───────────────────────── */

    const S = {
        data: null,
        view: null,
        user: null,
        lastFetchAt: 0,
        error: null,
        inflight: null,
        fetchGen: 0,
        manualGen: 0,
        manualBusy: false,
        anchor: null,
        ui: null,
        currentModel: 'Gemini',
        modelCheckAt: 0,

        mode: 'idle',
        gen: null,
        lastReply: null,
        liveTimer: 0,
        doneTimer: 0,

        open: false,
        pinned: false,
        hovered: false,
        openTimer: 0,
        closeTimer: 0,

        observer: null,
        tickTimer: 0,
        schedHandle: 0,
    };

    const stopCache = { el: null, at: 0 };

    /* ───────────────────────── 账号上下文 ───────────────────────── */

    function getCurrentUser() {
        const signOutLink = document.querySelector('a[href*="SignOutOptions"]');
        const href = signOutLink?.href || '';

        let index = '0';
        let match = location.pathname.match(/^\/u\/(\d+)/);

        if (!match) {
            const base = document.querySelector('base');
            match = (base?.getAttribute('href') || '').match(/\/u\/(\d+)\/?/);
        }
        if (!match) {
            const authuser = new URLSearchParams(location.search).get('authuser');
            if (authuser && /^\d+$/.test(authuser)) match = [null, authuser];
        }
        if (!match) match = href.match(/\/u\/(\d+)/);
        if (match) index = match[1];

        const pathPrefix = index === '0' && !match ? '' : `/u/${index}`;
        const usagePath = pathPrefix ? `${pathPrefix}/usage` : '/usage';

        const aria = signOutLink?.getAttribute('aria-label') || '';
        let email = '';
        let name = '';
        const emailMatch = aria.match(/\(([^)]+@[^)]+)\)/);
        if (emailMatch) email = emailMatch[1].trim();
        const nameMatch = aria.match(/Google (?:账号|Account)[：:]\s*([^\n(]+)/);
        if (nameMatch) name = nameMatch[1].trim();

        return { index, pathPrefix, usagePath, name, email };
    }

    /* ───────────────────────── 数据获取 ───────────────────────── */

    async function fetchUsage(force) {
        const currentUser = getCurrentUser();
        const userSwitched = !S.user || S.user.usagePath !== currentUser.usagePath;
        S.user = currentUser;

        if (userSwitched) {
            S.data = null;
            S.view = null;
            S.lastReply = null;
            S.lastFetchAt = 0;
            S.error = null;
            force = true;
            S.inflight = null;
            S.fetchGen++;
        }

        if (!force && S.data && Date.now() - S.lastFetchAt < CFG.minFetchGap) return S.data;
        if (S.inflight) return S.inflight;

        const myGen = S.fetchGen;
        const targetUrl = S.user?.usagePath || '/usage';

        S.inflight = (async () => {
            try {
                const res = await fetch(targetUrl, { credentials: 'include' });
                if (myGen !== S.fetchGen) return S.data;
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const html = await res.text();
                if (myGen !== S.fetchGen) return S.data;

                let fullChunk = '';
                for (const m of html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)) {
                    const content = (m[1] || '').trim();
                    if (!content.startsWith('{') || !content.includes('"chunk"')) continue;
                    try {
                        const parsed = JSON.parse(content);
                        for (const ev of parsed.events || []) {
                            if (ev.kind === 'chunk') fullChunk += ev.chunk;
                        }
                    } catch { /* 忽略非目标脚本 */ }
                }
                if (!fullChunk) throw new Error(`No chunk found in ${targetUrl}`);

                const arr = JSON.parse(fullChunk);
                if (myGen !== S.fetchGen) return S.data;

                let info = (Array.isArray(arr) ? arr : [])
                    .map((i) => i?.data?.viewer?.rpcs?.getUsageInfo)
                    .find(Boolean);
                if (!info) {
                    const isFreeAccount = (Array.isArray(arr) ? arr : []).some((i) => i?.data && i.data.viewer === null) ||
                        html.includes('DATA_FETCHING_EXCEPTION') ||
                        html.includes('gemini_out_of_quota_input_inline_upgrade_banner');
                    if (isFreeAccount) {
                        info = {
                            subscriptionTier: 'FREE',
                            isFree: true,
                            pools: [],
                            advancedSettings: null,
                            useOverageAiCredits: false,
                        };
                    } else {
                        throw new Error('getUsageInfo not present in response');
                    }
                }
                S.data = info;
                S.lastFetchAt = Date.now();
                S.error = null;
            } catch (err) {
                if (myGen !== S.fetchGen) return S.data;
                S.error = String(err?.message || err);
                console.warn('[Gemini Usage Tracker] fetchUsage error:', err);
            } finally {
                if (myGen === S.fetchGen) S.inflight = null;
            }
            return S.data;
        })();

        return S.inflight;
    }

    function predictRunOut(pct, elapsedMs, resetAt, windowMs) {
        if (pct < 3 || pct >= 100) return null;
        const minRatio = windowMs <= CFG.sessionWindowMs ? 0.05 : 0.02;
        if (elapsedMs < windowMs * minRatio) return null;
        const rate = pct / elapsedMs;
        if (rate <= 0) return null;
        const remainMs = (100 - pct) / rate;
        const resetRemain = resetAt - Date.now();
        if (remainMs >= resetRemain) return null;
        return remainMs;
    }

    function compute(data) {
        if (!data) return null;
        if (data.isFree || data.subscriptionTier === 'FREE') {
            return {
                tier: 'FREE',
                isFree: true,
                session: { pct: 0, level: 'ok', isFree: true },
                weekly: { pct: 0, level: 'ok', isFree: true },
            };
        }

        const raw = String(data.subscriptionTier || 'PRO').toUpperCase();
        const tier = /TIER2|ULTRA/.test(raw) ? 'ULTRA' : /TIER1|PRO/.test(raw) ? 'PRO' : 'FREE';
        const pools = Array.isArray(data.pools) ? data.pools : [];

        const pool = (type, windowMs) => {
            const p = pools.find((x) => x?.poolType === type);
            if (!p) return null;

            const pct = clamp((Number(p.percentageUsed) || 0) * 100);
            const resetAt = Date.parse(p.gxu?.windowRefreshesAt || '');
            const hasReset = Number.isFinite(resetAt);

            let elapsed = null;
            let runOutMs = null;
            if (hasReset) {
                const elapsedMs = Math.max(0, Date.now() - (resetAt - windowMs));
                elapsed = clamp(elapsedMs / windowMs, 0, 1);
                runOutMs = predictRunOut(pct, elapsedMs, resetAt, windowMs);
            }
            return { pct, level: levelOf(pct), resetAt: hasReset ? resetAt : null, elapsed, runOutMs };
        };

        return {
            tier,
            session: pool('GXU_FIVE_HOURLY', CFG.sessionWindowMs),
            weekly: pool('GXU_WEEKLY', CFG.weeklyWindowMs),
        };
    }

    /* ───────────────────────── 样式 ───────────────────────── */

    function injectStyle() {
        if (document.getElementById(SID)) return;
        const style = document.createElement('style');
        style.id = SID;
        style.textContent = `
#gut, #gut * { box-sizing: border-box; }
#gut {
    --gut-text: var(--gem-sys-color-on-surface, #1f1f1f);
    --gut-text-2: var(--gem-sys-color-on-surface-variant, #444746);
    --gut-text-3: var(--gem-sys-color-outline, #747775);
    --gut-surface: var(--gem-sys-color-surface-container, #f0f4f9);
    --gut-surface-high: var(--gem-sys-color-surface-container-low, #ffffff);
    --gut-track: rgba(31, 31, 31, 0.08);
    --gut-state: rgba(31, 31, 31, 0.06);
    --gut-state-press: rgba(31, 31, 31, 0.11);
    --gut-divider: var(--gem-sys-color-outline-variant, rgba(196, 199, 197, 0.65));
    --gut-border: rgba(31, 31, 31, 0.08);
    --gut-shadow: 0 8px 28px rgba(0, 0, 0, 0.11), 0 2px 6px rgba(0, 0, 0, 0.06);
    --gut-primary: var(--gem-sys-color-primary, #0b57d0);
    --gut-primary-end: #1a73e8;
    --gut-primary-bg: var(--gem-sys-color-primary-container, #d3e3fd);
    --gut-primary-on-bg: var(--gem-sys-color-on-primary-container, #041e49);
    --gut-ok-dot: #188038;
    --gut-warn: #e37400;   --gut-warn-t: #b06000;   --gut-warn-bg: rgba(249, 171, 0, 0.14);
    --gut-danger: #d93025; --gut-danger-t: #b3261e; --gut-danger-bg: rgba(217, 48, 37, 0.12);

    width: 100%;
    max-width: ${CFG.maxWidth}px;
    margin: 2px auto 4px;
    padding: 0 12px;
    position: relative;
    z-index: 50;
    font-family: 'Google Sans Text', 'Google Sans', 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif;
    font-variant-numeric: tabular-nums;
    text-rendering: optimizeLegibility;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(4px);
    transition: opacity 0.25s cubic-bezier(0.2, 0, 0, 1), transform 0.25s cubic-bezier(0.2, 0, 0, 1), visibility 0s linear 0.25s;
}
#gut.is-ready {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: none;
    transition: opacity 0.25s cubic-bezier(0.05, 0.7, 0.1, 1), transform 0.25s cubic-bezier(0.05, 0.7, 0.1, 1), visibility 0s;
}
#gut.is-open {
    z-index: 1000 !important;
}
#gut[data-theme="dark"] {
    --gut-text: var(--gem-sys-color-on-surface, #e3e3e3);
    --gut-text-2: var(--gem-sys-color-on-surface-variant, #c4c7c5);
    --gut-text-3: var(--gem-sys-color-outline, #8e918f);
    --gut-surface: var(--gem-sys-color-surface-container, #1e1f20);
    --gut-surface-high: var(--gem-sys-color-surface-container-high, #282a2c);
    --gut-track: rgba(227, 227, 227, 0.12);
    --gut-state: rgba(227, 227, 227, 0.07);
    --gut-state-press: rgba(227, 227, 227, 0.12);
    --gut-divider: var(--gem-sys-color-outline-variant, rgba(68, 71, 70, 0.7));
    --gut-border: rgba(255, 255, 255, 0.09);
    --gut-shadow: 0 10px 32px rgba(0, 0, 0, 0.56), 0 2px 8px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    --gut-primary: var(--gem-sys-color-primary, #a8c7fa);
    --gut-primary-end: #7cacf8;
    --gut-primary-bg: var(--gem-sys-color-primary-container, #0842a0);
    --gut-primary-on-bg: var(--gem-sys-color-on-primary-container, #d3e3fd);
    --gut-ok-dot: #81c995;
    --gut-warn: #fdd663;   --gut-warn-t: #fdd663;   --gut-warn-bg: rgba(253, 214, 99, 0.15);
    --gut-danger: #f28b82; --gut-danger-t: #f28b82; --gut-danger-bg: rgba(242, 139, 130, 0.15);
}

#gut [data-level="ok"]     { --lv: var(--gut-primary); --lv-end: var(--gut-primary-end); --lv-t: var(--gut-text);     --lv-bg: transparent; }
#gut [data-level="warn"]   { --lv: var(--gut-warn);    --lv-end: var(--gut-warn);        --lv-t: var(--gut-warn-t);   --lv-bg: var(--gut-warn-bg); }
#gut [data-level="danger"] { --lv: var(--gut-danger);  --lv-end: var(--gut-danger);      --lv-t: var(--gut-danger-t); --lv-bg: var(--gut-danger-bg); }

#gut button { appearance: none; background: transparent; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; }
#gut svg { display: block; flex-shrink: 0; }
#gut [hidden] { display: none !important; }
#gut button:focus-visible, #gut a:focus-visible, #gut .gut-strip:focus-visible {
    outline: 2px solid var(--gut-primary);
    outline-offset: 2px;
}

#gut .gut-sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

/* ── 常驻条 ── */
#gut .gut-strip {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 6px 10px 5px;
    margin: 0 -10px;
    border-radius: 12px;
    cursor: pointer;
    user-select: none;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
#gut .gut-strip:hover, #gut.is-open .gut-strip { background: var(--gut-state); }
#gut .gut-strip:active { background: var(--gut-state-press); }
#gut.is-pinned .gut-strip { background: var(--gut-state); }

#gut .gut-bar {
    height: 3px;
    border-radius: 999px;
    background: var(--gut-track);
    overflow: hidden;
    position: relative;
    transition: height 0.2s cubic-bezier(0.2, 0, 0, 1);
}
#gut .gut-strip:hover .gut-bar,
#gut.is-open .gut-bar,
#gut.is-generating .gut-bar { height: 4px; }

#gut .gut-fill {
    height: 100%;
    width: 0;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--lv, var(--gut-primary)), var(--lv-end, var(--gut-primary)));
    transition: width 0.55s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease, background-color 0.3s ease, filter 0.3s ease;
}

#gut:not(.is-generating) .gut-fill[data-level="danger"] {
    animation: gut-danger-pulse 2s ease-in-out infinite;
}
@keyframes gut-danger-pulse {
    0%, 100% { filter: brightness(1); }
    50%      { filter: brightness(1.16); }
}

#gut.is-generating .gut-fill {
    width: 100% !important;
    opacity: 1 !important;
    background: linear-gradient(90deg, #4285f4 0%, #9b72cb 35%, #d96570 68%, #4285f4 100%);
    background-size: 200% 100%;
    animation: gut-flow 1.6s linear infinite;
}
@keyframes gut-flow { to { background-position: -200% 0; } }

#gut.is-done .gut-fill {
    animation: gut-done-flash 0.7s cubic-bezier(0.2, 0, 0, 1);
}
@keyframes gut-done-flash {
    0%   { filter: brightness(1); }
    40%  { filter: brightness(1.55); }
    100% { filter: brightness(1); }
}

#gut.is-loading:not(.is-generating) .gut-fill,
#gut.is-loading .gut-row-fill {
    width: 100% !important;
    opacity: 0.45 !important;
    background: linear-gradient(90deg, var(--gut-track) 0%, var(--gut-text-3) 50%, var(--gut-track) 100%);
    background-size: 200% 100%;
    animation: gut-shimmer 1.5s linear infinite;
}
@keyframes gut-shimmer { to { background-position: -200% 0; } }

#gut .gut-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.1px;
    color: var(--gut-text-3);
    white-space: nowrap;
}
#gut .gut-meta-left, #gut .gut-meta-right { display: flex; align-items: center; gap: 6px; min-width: 0; }
#gut .gut-meta-right { flex-shrink: 0; gap: 4px; }

#gut .gut-dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: currentColor; opacity: 0.45; flex-shrink: 0;
}

#gut .gut-live-dot {
    display: none;
    width: 6px; height: 6px; border-radius: 50%;
    background: #9b72cb; flex-shrink: 0;
    animation: gut-pulse 1.2s ease-in-out infinite;
}
#gut.is-generating .gut-live-dot { display: inline-block; }
@keyframes gut-pulse {
    0%, 100% { transform: scale(0.85); opacity: 0.65; }
    50%      { transform: scale(1.15); opacity: 1; }
}

#gut .gut-main {
    color: var(--gut-text-2);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s ease;
}
#gut .gut-strip:hover .gut-main, #gut.is-open .gut-main, #gut.is-generating .gut-main { color: var(--gut-text); }

#gut .gut-main[data-level="warn"]   { color: var(--gut-warn-t); }
#gut .gut-main[data-level="danger"] { color: var(--gut-danger-t); font-weight: 600; }

#gut .gut-sub { overflow: hidden; text-overflow: ellipsis; }
#gut .gut-sub[data-tone="error"] { color: var(--gut-danger-t); font-weight: 500; }
#gut .gut-sub[data-tone="delta"] { color: var(--gut-primary); font-weight: 500; }

#gut .gut-plan { color: var(--gut-text-2); transition: color 0.15s ease; }
#gut .gut-plan[data-level="warn"]   { color: var(--gut-warn-t); font-weight: 500; }
#gut .gut-plan[data-level="danger"] { color: var(--gut-danger-t); font-weight: 600; }

#gut .gut-chevron {
    color: var(--gut-text-3);
    opacity: 0.75;
    transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s ease, color 0.15s ease;
}
#gut .gut-strip:hover .gut-chevron { opacity: 1; color: var(--gut-text-2); }
#gut.is-open .gut-chevron { transform: rotate(180deg); opacity: 1; color: var(--gut-text-2); }
#gut.is-pinned .gut-chevron { color: var(--gut-primary); }

/* ── 悬浮面板 ── */
#gut .gut-panel {
    position: absolute;
    left: 2px; right: 2px; width: auto;
    bottom: calc(100% + 8px);
    max-height: calc(100dvh - 130px);
    overflow-y: auto;
    padding: 16px 18px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--gut-surface-high);
    border: 1px solid var(--gut-border);
    border-radius: 22px;
    box-shadow: var(--gut-shadow);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(8px) scale(0.985);
    transform-origin: center bottom;
    transition: opacity 0.16s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1), visibility 0s linear 0.2s;
    z-index: 1001;
}
#gut.is-open .gut-panel {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0) scale(1);
    transition: opacity 0.18s cubic-bezier(0.05, 0.7, 0.1, 1), transform 0.22s cubic-bezier(0.05, 0.7, 0.1, 1), visibility 0s;
}
#gut:not(.is-open) .gut-panel, #gut:not(.is-open) .gut-panel * {
    pointer-events: none !important;
}
#gut .gut-panel::after {
    content: '';
    position: absolute;
    left: 0; right: 0; top: 100%;
    height: 16px;
}

#gut .gut-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: -2px -4px -2px 0;
}
#gut .gut-head-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
}
#gut .gut-head-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px; height: 20px;
    flex-shrink: 0;
}
#gut .gut-gemini-logo { width: 20px; height: 20px; display: block; object-fit: contain; }
#gut .gut-sparkle-fallback { color: var(--gut-primary); }
#gut .gut-title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--gut-text); flex-shrink: 0; }

#gut .gut-tier {
    display: inline-flex;
    align-items: center;
    height: 19px;
    padding: 0 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2px;
    flex-shrink: 0;
    background: var(--gut-state);
    color: var(--gut-text-2);
}
#gut .gut-tier[data-tier="PRO"] {
    background: var(--gut-primary-bg);
    color: var(--gut-primary-on-bg);
}
#gut .gut-tier[data-tier="ULTRA"] {
    background: linear-gradient(135deg, rgba(66, 133, 244, 0.16), rgba(155, 114, 203, 0.2), rgba(217, 101, 112, 0.16));
    color: var(--gut-text);
    border: 1px solid rgba(155, 114, 203, 0.28);
}

#gut .gut-account {
    font-size: 11.5px;
    line-height: 16px;
    color: var(--gut-text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}

#gut .gut-head-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }

#gut .gut-icon-btn {
    width: 32px; height: 32px; border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--gut-text-2);
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
#gut .gut-icon-btn:hover { background: var(--gut-state); color: var(--gut-text); }
#gut .gut-icon-btn:active { background: var(--gut-state-press); transform: scale(0.94); }

#gut .gut-pin svg { transform: rotate(35deg); transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1); }
#gut .gut-pin[aria-pressed="true"] {
    background: var(--gut-primary-bg);
    color: var(--gut-primary-on-bg);
}
#gut .gut-pin[aria-pressed="true"] svg { transform: rotate(0deg); }

#gut .gut-refresh[aria-busy="true"] svg { animation: gut-spin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
@keyframes gut-spin { to { transform: rotate(360deg); } }

/* ── 用量卡片 ── */
#gut .gut-rows { display: flex; flex-direction: column; gap: 10px; }
#gut .gut-row {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--gut-surface);
    border: 1px solid var(--gut-border);
    transition: border-color 0.3s ease;
}
#gut .gut-row[data-reset="soon"] { border-color: var(--gut-warn-t); }

#gut .gut-row-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
#gut .gut-row-title-wrap { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; min-width: 0; }
#gut .gut-row-title { font-size: 13px; font-weight: 500; line-height: 18px; color: var(--gut-text); }
#gut .gut-row-win { font-size: 12px; font-weight: 400; color: var(--gut-text-3); }
#gut .gut-row-elapsed { font-size: 11.5px; font-weight: 400; color: var(--gut-text-3); opacity: 0.9; }
#gut .gut-row-pct {
    font-size: 13.5px;
    line-height: 18px;
    font-weight: 600;
    padding: 1px 7px;
    margin: -1px -4px -1px 0;
    border-radius: 8px;
    background: var(--lv-bg, transparent);
    color: var(--lv-t, var(--gut-text));
    flex-shrink: 0;
    transition: color 0.3s, background-color 0.3s;
}

#gut .gut-row-track {
    position: relative;
    height: 7px;
    border-radius: 999px;
    background: var(--gut-track);
}
#gut .gut-row-fill {
    height: 100%;
    width: 0;
    max-width: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--lv, var(--gut-primary)), var(--lv-end, var(--gut-primary)));
    transition: width 0.55s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease, background-color 0.3s;
}
#gut .gut-row-tick {
    position: absolute;
    top: -3px; bottom: -3px;
    width: 2px;
    border-radius: 999px;
    background: var(--gut-text-2);
    box-shadow: 0 0 0 2px var(--gut-surface);
    opacity: 0.78;
    transform: translateX(-1px);
    transition: left 0.55s cubic-bezier(0.2, 0, 0, 1), width 0.15s ease, opacity 0.15s ease;
}
#gut .gut-row-tick::after {
    content: '';
    position: absolute;
    top: -4px; bottom: -4px;
    left: -6px; right: -6px;
}
#gut .gut-row-tick:hover {
    width: 3px;
    opacity: 1;
}

#gut .gut-row-foot {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    line-height: 16px;
    color: var(--gut-text-3);
}
#gut .gut-row-reset {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    min-height: 16px;
}
#gut .gut-row[data-reset="soon"] .gut-row-reset span:first-child {
    color: var(--gut-warn-t);
    font-weight: 500;
}

#gut .gut-row-hint {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 4px 9px;
    border-radius: 8px;
    font-size: 11.5px;
    line-height: 16px;
    font-weight: 500;
    background: var(--gut-warn-bg);
    color: var(--gut-warn-t);
}
#gut .gut-row-hint[data-tone="danger"] {
    background: var(--gut-danger-bg);
    color: var(--gut-danger-t);
}

/* ── 面板底部 ── */
#gut .gut-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-top: 2px;
    font-size: 12px;
    line-height: 16px;
    color: var(--gut-text-3);
}
#gut .gut-foot-left { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; }

#gut .gut-status, #gut .gut-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    margin: -4px -6px;
    border-radius: 999px;
    white-space: nowrap;
    text-decoration: none;
    transition: background-color 0.15s ease, color 0.15s ease;
}
#gut .gut-status { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
#gut .gut-status:hover, #gut .gut-link:hover { background: var(--gut-state); color: var(--gut-text); }

#gut .gut-status-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--gut-ok-dot);
    flex-shrink: 0;
    transition: background-color 0.2s ease;
}
#gut.is-loading .gut-status-dot {
    background: var(--gut-primary);
    animation: gut-pulse 1.2s ease-in-out infinite;
}
#gut .gut-status[data-error="1"] { color: var(--gut-danger-t); }
#gut .gut-status[data-error="1"] .gut-status-dot { background: var(--gut-danger); animation: none; }

#gut .gut-last-reply {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    background: var(--gut-primary-bg);
    color: var(--gut-primary-on-bg);
    white-space: nowrap;
    flex-shrink: 0;
}

#gut .gut-link { color: var(--gut-primary); font-weight: 500; flex-shrink: 0; }

@media (max-width: 520px) {
    #gut .gut-sub, #gut .gut-sub-dot, #gut .gut-account, #gut .gut-last-reply { display: none !important; }
    #gut .gut-panel { left: 0; right: 0; padding: 14px 14px 12px; border-radius: 20px; }
}
@media (prefers-reduced-motion: reduce) {
    #gut *, #gut *::before, #gut *::after { transition-duration: 0.001s !important; }
    #gut.is-generating .gut-fill,
    #gut.is-generating .gut-live-dot,
    #gut.is-loading .gut-fill,
    #gut.is-loading .gut-row-fill,
    #gut.is-loading .gut-status-dot,
    #gut:not(.is-generating) .gut-fill[data-level="danger"],
    #gut.is-done .gut-fill { animation: none !important; }
}
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    /* ───────────────────────── UI 构建 ───────────────────────── */

    const TIER_LABEL = { PRO: 'Pro', ULTRA: 'Ultra', FREE: 'Free' };

    function buildRow(titleKey, winKey) {
        const r = {};
        r.root = h('div', { class: 'gut-row', 'data-level': 'ok' },
            h('div', { class: 'gut-row-head' },
                h('div', { class: 'gut-row-title-wrap' },
                    h('span', { class: 'gut-row-title', text: t(titleKey) }),
                    h('span', { class: 'gut-row-win', text: t(winKey) }),
                    (r.elapsed = h('span', { class: 'gut-row-elapsed', hidden: true }))),
                (r.pct = h('div', { class: 'gut-row-pct', text: '--' }))),
            h('div', { class: 'gut-row-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': t(titleKey) },
                (r.fill = h('div', { class: 'gut-row-fill' })),
                (r.tick = h('div', { class: 'gut-row-tick' }))),
            h('div', { class: 'gut-row-foot' },
                h('div', { class: 'gut-row-reset' },
                    (r.resetLeft = h('span')),
                    (r.resetRight = h('span'))),
                (r.hint = h('div', { class: 'gut-row-hint', hidden: true },
                    icon(ICON.warn, 13),
                    (r.hintText = h('span'))))));
        r.track = r.root.querySelector('.gut-row-track');
        r.tick.style.display = 'none';
        return r;
    }

    function buildUI() {
        const u = {};

        u.bar = h('div', {
            class: 'gut-bar',
            role: 'progressbar',
            'aria-valuemin': '0',
            'aria-valuemax': '100',
            'aria-valuenow': '0',
            'aria-label': t('s5h'),
        }, (u.fill = h('div', { class: 'gut-fill', 'data-level': 'ok' })));

        u.strip = h('div', {
            class: 'gut-strip',
            role: 'button',
            tabindex: '0',
            'aria-haspopup': 'dialog',
            'aria-expanded': 'false',
            'aria-controls': 'gut-panel',
            'aria-label': t('tip'),
        },
            u.bar,
            h('div', { class: 'gut-meta' },
                h('div', { class: 'gut-meta-left' },
                    h('span', { class: 'gut-live-dot' }),
                    (u.main = h('span', { class: 'gut-main' })),
                    (u.subDot = h('span', { class: 'gut-dot gut-sub-dot' })),
                    (u.sub = h('span', { class: 'gut-sub' }))),
                h('div', { class: 'gut-meta-right' },
                    (u.plan = h('span', { class: 'gut-plan', 'data-level': 'ok' })),
                    icon(ICON.chevron, 14, 'gut-chevron'))));

        u.rows = {
            session: buildRow('sessionTitle', 'sessionWin'),
            weekly: buildRow('weeklyTitle', 'weeklyWin'),
        };

        u.pinBtn = h('button', {
            class: 'gut-icon-btn gut-pin',
            type: 'button',
            title: t('pin'),
            'aria-label': t('pin'),
            'aria-pressed': 'false',
        }, icon(ICON.pin, 16));

        u.refreshBtn = h('button', {
            class: 'gut-icon-btn gut-refresh',
            type: 'button',
            title: t('refresh'),
            'aria-label': t('refresh'),
            'aria-busy': 'false',
        }, icon(ICON.refresh, 18));

        const logoImg = h('img', {
            class: 'gut-gemini-logo',
            src: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg',
            width: 20, height: 20, alt: 'Gemini',
        });
        const logoFallback = icon(ICON.sparkle, 18, 'gut-sparkle-fallback');
        logoFallback.setAttribute('hidden', '');
        logoImg.addEventListener('error', () => {
            logoImg.setAttribute('hidden', '');
            logoFallback.removeAttribute('hidden');
        }, { once: true });

        u.panel = h('div', { id: 'gut-panel', class: 'gut-panel', role: 'dialog', 'aria-label': t('panelTitle') },
            h('div', { class: 'gut-head' },
                h('div', { class: 'gut-head-left' },
                    h('span', { class: 'gut-head-icon' }, logoImg, logoFallback),
                    h('span', { class: 'gut-title', text: t('panelTitle') }),
                    (u.tierBadge = h('span', { class: 'gut-tier', hidden: true })),
                    (u.account = h('span', { class: 'gut-account', hidden: true }))),
                h('div', { class: 'gut-head-actions' }, u.pinBtn, u.refreshBtn)),
            h('div', { class: 'gut-rows' }, u.rows.session.root, u.rows.weekly.root),
            h('div', { class: 'gut-foot' },
                h('div', { class: 'gut-foot-left' },
                    (u.status = h('button', { class: 'gut-status', type: 'button', title: t('refresh') },
                        h('span', { class: 'gut-status-dot' }),
                        (u.statusText = h('span')))),
                    (u.lastReplyEl = h('span', { class: 'gut-last-reply', hidden: true }))),
                (u.link = h('a', { class: 'gut-link', href: '/usage', target: '_blank', rel: 'noopener' },
                    h('span', { text: t('details') }), icon(ICON.open, 12)))));

        u.live = h('div', { class: 'gut-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });

        u.root = h('div', { id: ID, class: 'is-loading' }, u.strip, u.panel, u.live);

        /* 交互 */
        u.root.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'touch') return;
            S.hovered = true;
            clearTimeout(S.closeTimer);
            if (!S.open && !e.buttons) {
                clearTimeout(S.openTimer);
                S.openTimer = setTimeout(openPanel, CFG.hoverOpenDelay);
            }
        });
        u.root.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'touch') return;
            S.hovered = false;
            clearTimeout(S.openTimer);
            if (S.open && !S.pinned) S.closeTimer = setTimeout(closePanel, CFG.hoverCloseDelay);
        });
        u.strip.addEventListener('click', togglePin);
        u.strip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePin();
            }
        });
        u.pinBtn.addEventListener('click', () => {
            if (!S.pinned) {
                setPinned(true);
            } else {
                setPinned(false);
                if (!S.hovered) closePanel();
            }
        });
        u.refreshBtn.addEventListener('click', triggerManualRefresh);
        u.status.addEventListener('click', triggerManualRefresh);

        return u;
    }

    async function triggerManualRefresh() {
        const u = S.ui;
        if (!u || S.manualBusy) return;
        S.manualBusy = true;
        const myGen = ++S.manualGen;
        const t0 = Date.now();
        u.refreshBtn.setAttribute('aria-busy', 'true');
        if (S.error || !S.data) setText(u.statusText, t('loading'));
        try {
            await refresh(true);
        } finally {
            const left = Math.max(0, 550 - (Date.now() - t0));
            setTimeout(() => {
                if (myGen !== S.manualGen) return;
                S.manualBusy = false;
                S.ui?.refreshBtn.setAttribute('aria-busy', 'false');
            }, left);
        }
    }

    function setPinned(val) {
        S.pinned = Boolean(val);
        if (!S.ui) return;
        S.ui.root.classList.toggle('is-pinned', S.pinned);
        S.ui.pinBtn.setAttribute('aria-pressed', String(S.pinned));
        const label = S.pinned ? t('unpin') : t('pin');
        S.ui.pinBtn.setAttribute('title', label);
        S.ui.pinBtn.setAttribute('aria-label', label);
    }

    function openPanel() {
        clearTimeout(S.openTimer);
        clearTimeout(S.closeTimer);
        if (S.open || !S.ui) return;
        S.open = true;
        S.ui.root.classList.add('is-open');
        S.ui.strip.setAttribute('aria-expanded', 'true');
        detectCurrentModel();
        render();
        if (Date.now() - S.lastFetchAt > CFG.hoverRefreshGap) refresh(true);
    }

    function closePanel(restoreFocus = false) {
        clearTimeout(S.openTimer);
        clearTimeout(S.closeTimer);
        S.open = false;
        setPinned(false);
        if (!S.ui) return;
        S.ui.root.classList.remove('is-open');
        S.ui.strip.setAttribute('aria-expanded', 'false');
        if (restoreFocus) S.ui.strip.focus({ preventScroll: true });
    }

    function togglePin() {
        if (S.open && S.pinned) {
            closePanel();
        } else {
            setPinned(true);
            openPanel();
        }
    }

    /* ───────────────────────── 渲染 ───────────────────────── */

    function extractCleanText(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        for (const trash of clone.querySelectorAll('mat-icon, svg, [aria-hidden="true"], .mat-mdc-button-touch-target')) {
            trash.remove();
        }
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function detectCurrentModel() {
        const now = Date.now();
        if (now - S.modelCheckAt < 2000) return;
        S.modelCheckAt = now;
        const btn = $('button.input-area-switch') || $('[data-test-id="bard-mode-menu-button"]');
        const txt = extractCleanText(btn) || (btn?.innerText ?? btn?.textContent)?.replace(/\s+/g, ' ').trim();
        if (txt && txt !== S.currentModel) S.currentModel = txt;
    }

    function renderRow(row, p, kind, view) {
        if (view && !view.isFree && !p) {
            row.root.hidden = true;
            return;
        }
        row.root.hidden = false;

        if (p?.isFree) {
            row.root.dataset.level = 'ok';
            setText(row.pct, 'Free');
            row.fill.style.width = '0%';
            row.fill.style.opacity = '0';
            row.track.setAttribute('aria-valuenow', '0');
            row.elapsed.hidden = true;
            row.tick.style.display = 'none';
            row.root.dataset.reset = '';
            setText(row.resetLeft, kind === 'session' ? t('freeSessionDesc') : t('freeWeeklyDesc'));
            setText(row.resetRight, '');
            row.hint.hidden = true;
            return;
        }

        const pctVal = p ? p.pct : 0;
        row.root.dataset.level = p ? p.level : 'ok';
        setText(row.pct, p ? `${fmtPct(pctVal)}%` : '--');
        row.fill.style.width = `${pctVal}%`;
        row.fill.style.opacity = pctVal > 0 ? '1' : '0';
        row.track.setAttribute('aria-valuenow', String(Math.round(pctVal)));

        if (p && p.elapsed != null) {
            const elapsedPct = Math.round(p.elapsed * 100);
            row.tick.style.display = '';
            row.tick.style.left = `${p.elapsed * 100}%`;
            row.tick.title = t('elapsedTip', elapsedPct);
            row.elapsed.hidden = false;
            setText(row.elapsed, `· ${t('elapsedShort', elapsedPct)}`);
        } else {
            row.tick.style.display = 'none';
            row.elapsed.hidden = true;
        }

        const soon = p?.resetAt && (p.resetAt - Date.now()) < 5 * 60 * 1000 && p.resetAt > Date.now();
        row.root.dataset.reset = soon ? 'soon' : '';

        if (p?.resetAt) {
            const at = kind === 'session' ? fmtClock(p.resetAt) : fmtDateTime(p.resetAt);
            setText(row.resetLeft, resetText(p.resetAt));
            setText(row.resetRight, t('resetAtClock', at));
        } else if (p) {
            setText(row.resetLeft, t('resetUnknown'));
            setText(row.resetRight, '');
        } else {
            setText(row.resetLeft, S.error ? t('failedShort') : t('loading'));
            setText(row.resetRight, '');
        }

        let hint = '';
        let urgent = false;
        if (p) {
            if (p.pct >= 100) {
                hint = t('exhausted');
                urgent = true;
            } else if (p.runOutMs) {
                const d = fmtDuration(p.runOutMs);
                if (d) hint = t('runOut', d);
                urgent = p.runOutMs < 30 * 60 * 1000;
            }
        }
        if (hint) {
            row.hint.hidden = false;
            row.hint.dataset.tone = urgent ? 'danger' : 'warn';
            setText(row.hintText, hint);
        } else {
            row.hint.hidden = true;
        }
    }

    let lastAnnouncedLevel = '';
    function announceLevel(level, pct) {
        if (!S.ui?.live || level === lastAnnouncedLevel) return;
        lastAnnouncedLevel = level;
        const p = Math.round(pct);
        if (pct >= 100) setText(S.ui.live, t('announceExhausted'));
        else if (level === 'danger') setText(S.ui.live, t('announceDanger', p));
        else if (level === 'warn') setText(S.ui.live, t('announceWarn', p));
        else setText(S.ui.live, `${t('s5h')} ${p}%`);
    }

    function render() {
        const u = S.ui;
        if (!u) return;

        const v = (S.view = compute(S.data));
        const ses = v?.session;
        const wk = v?.weekly;

        const isLoading = !S.data && !S.error;
        u.root.classList.toggle('is-loading', isLoading);

        const sesPct = ses ? ses.pct : 0;
        u.fill.style.width = `${sesPct}%`;
        u.fill.style.opacity = sesPct > 0 ? '1' : '0';
        u.fill.dataset.level = ses?.level || 'ok';
        u.bar.setAttribute('aria-valuenow', String(Math.round(sesPct)));

        if (v?.tier && TIER_LABEL[v.tier]) {
            u.tierBadge.hidden = false;
            u.tierBadge.dataset.tier = v.tier;
            setText(u.tierBadge, TIER_LABEL[v.tier]);
        } else {
            u.tierBadge.hidden = true;
        }

        if (S.user?.email) {
            u.account.hidden = false;
            setText(u.account, S.user.email);
            u.account.title = S.user.email;
        } else {
            u.account.hidden = true;
        }

        renderRow(u.rows.session, ses, 'session', v);
        renderRow(u.rows.weekly, wk, 'weekly', v);

        if (u.link && S.user?.usagePath) u.link.href = S.user.usagePath;

        const ago = Date.now() - S.lastFetchAt;
        let status;
        if (S.error) status = t('failed');
        else if (!S.lastFetchAt) status = t('loading');
        else if (ago < 10_000) status = t('justNow');
        else if (ago < 60_000) status = t('agoS', Math.round(ago / 1000));
        else if (ago < 3_600_000) status = t('agoM', Math.round(ago / 60_000));
        else status = t('agoH', Math.round(ago / 3_600_000));
        setText(u.statusText, status);
        u.status.dataset.error = S.error ? '1' : '';

        const showLastReply = S.lastReply && S.lastReply.delta > 0.04 && (Date.now() - S.lastReply.at < CFG.lastReplyTtl);
        if (showLastReply) {
            u.lastReplyEl.hidden = false;
            setText(u.lastReplyEl, t('lastReply', fmtPct(S.lastReply.delta)));
        } else {
            u.lastReplyEl.hidden = true;
        }

        u.strip.setAttribute('aria-label',
            `${t('tip')}: ${t('s5h')} ${ses ? fmtPct(ses.pct) : '--'}%, ${t('week')} ${wk ? fmtPct(wk.pct) : '--'}%`);

        paintMeta();

        if (S.error) announceLevel('danger', 0);
        else if (ses) announceLevel(ses.pct >= 100 ? 'danger' : ses.level, ses.pct);
    }

    function paintMeta() {
        const u = S.ui;
        if (!u) return;
        const v = S.view;
        const ses = v?.session;
        const wk = v?.weekly;
        const g = S.gen;

        let main, sub = '', plan = '', tone = '', mainLevel = '', planLevel = 'ok';

        if (S.mode === 'live') {
            const sec = Math.floor((Date.now() - g.start) / 1000);
            main = `${t('generating')} ${fmtElapsed(sec)}`;
            sub = g.chars ? t('chars', g.chars.toLocaleString()) : '';
            plan = t('responding', S.currentModel);
        } else if (S.mode === 'done') {
            const sec = Math.max(1, Math.round((g.end - g.start) / 1000));
            const charsStr = g.chars ? t('chars', g.chars.toLocaleString()) : '';
            main = `${t('done')} ${fmtElapsed(sec)}`;
            if (g.syncing) {
                sub = charsStr ? `${charsStr} · ${t('syncing')}` : t('syncing');
            } else if (g.delta > 0.04) {
                sub = charsStr ? `${charsStr} · ${t('thisReply', fmtPct(g.delta))}` : t('thisReply', fmtPct(g.delta));
                tone = 'delta';
            } else {
                sub = charsStr;
            }
            if (v?.isFree) {
                plan = t('freeCap');
            } else if (ses) {
                plan = `${t('s5h')} ${fmtPct(ses.pct)}%`;
                planLevel = ses.level || 'ok';
            } else if (wk) {
                plan = `${t('week')} ${fmtPct(wk.pct)}%`;
                planLevel = wk.level || 'ok';
            }
        } else if (!S.data && !S.error) {
            main = t('loading');
            sub = '';
            plan = '';
        } else if (v?.isFree) {
            main = t('freePlan');
            sub = S.error ? t('failedShort') : t('freeSub');
            if (S.error) { tone = 'error'; mainLevel = 'danger'; }
            plan = t('freeCap');
        } else {
            main = ses ? `${t('s5h')} ${fmtPct(ses.pct)}%` : `${t('s5h')} --%`;
            if (S.error) {
                sub = t('failedShort');
                tone = 'error';
            } else {
                sub = ses?.resetAt ? resetText(ses.resetAt) : '';
            }
            mainLevel = S.error ? 'danger' : (ses?.level || 'ok');
            if (wk) {
                plan = `${t('week')} ${fmtPct(wk.pct)}%`;
                planLevel = wk.level || 'ok';
            } else if (v?.tier && TIER_LABEL[v.tier]) {
                plan = TIER_LABEL[v.tier];
            } else {
                plan = `${t('week')} --%`;
            }
        }

        setText(u.main, main);
        setText(u.sub, sub);
        setText(u.plan, plan);
        u.main.dataset.level = mainLevel;
        u.plan.dataset.level = planLevel;
        u.sub.hidden = !sub;
        u.subDot.hidden = !sub;
        if (u.sub.dataset.tone !== tone) u.sub.dataset.tone = tone;
    }

    async function refresh(force = false) {
        if (!S.ui || (!force && document.hidden)) return S.data;
        S.ui.root.setAttribute('aria-busy', 'true');
        try {
            const data = await fetchUsage(Boolean(force));
            render();
            return data;
        } finally {
            S.ui.root.setAttribute('aria-busy', 'false');
        }
    }

    /* ───────────────────────── 生成状态监测 ───────────────────────── */

    const STOP_SEL = [
        'button.stop',
        'button[aria-label*="停止"]',
        'button[aria-label*="Stop" i]',
    ].join(',');

    function findStopBtn() {
        const now = Date.now();
        if (now - stopCache.at < 250) return stopCache.el;
        let found = null;
        for (const b of document.querySelectorAll(STOP_SEL)) {
            if (!b.closest('model-response, response-container, message-content')) { found = b; break; }
        }
        stopCache.el = found;
        stopCache.at = now;
        return found;
    }

    function countLastResponse() {
        let nodes = document.querySelectorAll('model-response message-content');
        if (!nodes.length) nodes = document.querySelectorAll('message-content');
        const last = nodes[nodes.length - 1];
        return last ? last.textContent.trim().length : 0;
    }

    function startLive() {
        if (!S.ui) return;
        clearTimeout(S.doneTimer);
        clearInterval(S.liveTimer);
        detectCurrentModel();

        S.mode = 'live';
        S.gen = {
            start: Date.now(),
            end: 0,
            chars: 0,
            basePct: S.view?.session?.pct ?? null,
            idleSince: 0,
            syncing: false,
            delta: null,
        };
        S.ui.root.classList.add('is-generating');
        S.ui.root.classList.remove('is-done');
        S.liveTimer = setInterval(liveTick, 500);
        liveTick();
    }

    function liveTick() {
        const g = S.gen;
        if (S.mode !== 'live' || !g) return clearInterval(S.liveTimer);

        if (findStopBtn()) {
            g.idleSince = 0;
            g.chars = countLastResponse();
            paintMeta();
        } else if (!g.idleSince) {
            g.idleSince = Date.now();
        } else if (Date.now() - g.idleSince > 600) {
            endLive();
        }
    }

    function endLive() {
        clearInterval(S.liveTimer);
        const g = S.gen;
        if (!g) return;
        g.end = Date.now();
        g.chars = Math.max(g.chars, countLastResponse());
        g.syncing = true;
        S.mode = 'done';
        S.ui.root.classList.remove('is-generating');
        S.ui.root.classList.add('is-done');
        setTimeout(() => S.ui?.root.classList.remove('is-done'), 800);
        paintMeta();
        syncAfterReply(g);
    }

    async function syncAfterReply(g) {
        const alive = () => S.gen === g && S.mode === 'done';
        const before = g.basePct;

        for (let attempt = 0; attempt < 4; attempt++) {
            const wait = attempt === 0 ? 1500 : 2500 + attempt * 1500;
            await sleep(wait);
            if (!alive()) return;

            await fetchUsage(true);
            if (!alive()) return;

            const after = compute(S.data)?.session?.pct;
            if (before != null && after != null && after > before + 0.04) {
                g.delta = after - before;
                break;
            }
        }

        g.syncing = false;
        if (g.delta > 0.04) {
            S.lastReply = { delta: g.delta, chars: g.chars, at: Date.now() };
        }
        render();

        clearTimeout(S.doneTimer);
        S.doneTimer = setTimeout(() => {
            if (S.gen === g && S.mode === 'done') {
                S.mode = 'idle';
                paintMeta();
            }
        }, CFG.doneHold);
    }

    /* ───────────────────────── 挂载与生命周期 ───────────────────────── */

    function syncTheme() {
        if (!S.ui) return;
        const has = (c) => document.body?.classList.contains(c) || document.documentElement.classList.contains(c);
        const dark = has('dark-theme') ? true : has('light-theme') ? false : matchMedia('(prefers-color-scheme: dark)').matches;
        const v = dark ? 'dark' : 'light';
        if (S.ui.root.dataset.theme !== v) S.ui.root.dataset.theme = v;
    }

    function findAnchor() {
        const v2 = $('input-area-v2');
        if (!v2 || !v2.isConnected) return null;
        const editor = v2.querySelector('rich-textarea, .ql-editor, [contenteditable="true"]');
        if (!editor) return null;
        const rect = v2.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 20) return null;
        return v2;
    }

    function place() {
        const a = S.anchor;
        const root = S.ui?.root;
        if (!a?.isConnected || !root) return;

        const container = a.closest('.input-area-container') || a.parentElement;
        if (!container) return;

        const rect = a.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 20) return;

        const toggle = container.querySelector('chat-spark-toggle');
        if (toggle?.parentNode === container) {
            if (toggle.previousElementSibling !== root) container.insertBefore(root, toggle);
        } else if (a.nextElementSibling !== root) {
            a.insertAdjacentElement('afterend', root);
        }

        root.classList.add('is-ready');
    }

    function attach() {
        const anchor = S.anchor?.isConnected ? S.anchor : findAnchor();
        if (!anchor) return;
        S.anchor = anchor;

        if (!S.ui) {
            S.ui = buildUI();
            syncTheme();
            place();
            render();
            refresh(true);
            return;
        }
        place();
        syncTheme();
    }

    function scheduleAttach() {
        if (S.schedHandle) return;
        const run = () => {
            S.schedHandle = 0;
            attach();
        };
        S.schedHandle = window.requestIdleCallback
            ? requestIdleCallback(run, { timeout: 600 })
            : setTimeout(run, 50);
    }

    function tick() {
        if (!S.anchor?.isConnected) {
            S.ui?.root.classList.remove('is-ready');
            scheduleAttach();
        } else if (!S.ui?.root.isConnected) {
            scheduleAttach();
        }
        syncTheme();
        fixQuotaBannerTimezone();
        if (S.ui && S.mode !== 'live' && findStopBtn()) startLive();
    }

    function slowTick() {
        if (document.hidden || !S.ui) return;
        render();
        const now = Date.now();
        const stale = [S.view?.session, S.view?.weekly].some(
            (p) => p?.resetAt && now > p.resetAt + 2000 && S.lastFetchAt < p.resetAt);
        if (stale && S.mode !== 'live') refresh(true);
    }

    function setupObserver() {
        S.observer = new MutationObserver((records) => {
            if (S.ui && records.every((r) => S.ui.root.contains(r.target))) return;
            if (S.tickTimer) return;
            S.tickTimer = setTimeout(() => {
                S.tickTimer = 0;
                tick();
            }, CFG.tickDelay);
        });

        const start = () => S.observer.observe(document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-label'],
        });
        if (document.body) start();
        else document.addEventListener('DOMContentLoaded', start, { once: true });
    }

    function setupHooks() {
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            history[method] = function (...args) {
                const res = original.apply(this, args);
                scheduleAttach();
                const newUser = getCurrentUser();
                if (S.user && S.user.usagePath !== newUser.usagePath) refresh(true);
                return res;
            };
        }
        window.addEventListener('popstate', () => {
            scheduleAttach();
            const newUser = getCurrentUser();
            if (S.user && S.user.usagePath !== newUser.usagePath) refresh(true);
        }, { passive: true });
        window.addEventListener('hashchange', scheduleAttach, { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            scheduleAttach();
            refresh(true);
        }, { passive: true });
        window.addEventListener('focus', () => refresh(false), { passive: true });

        document.addEventListener('pointerdown', (e) => {
            if (!S.open || !S.ui) return;
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            if (!path.includes(S.ui.root) && !S.ui.root.contains(e.target)) closePanel();
        }, true);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && S.open) {
                const focusInside = S.ui?.root.contains(document.activeElement);
                closePanel(focusInside);
            }
        }, true);

        matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncTheme);
    }

    function init() {
        const start = () => {
            injectStyle();
            setupHooks();
            setupObserver();
            scheduleAttach();

            setInterval(() => {
                if (!document.hidden && S.mode !== 'live') refresh(false);
            }, CFG.pollInterval);
            setInterval(slowTick, 15_000);
            setInterval(() => { if (!document.hidden) tick(); }, 1000);
        };

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    }

    init();
})();