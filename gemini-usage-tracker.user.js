// ==UserScript==
// @name         Gemini Inline Usage Tracker
// @name:zh-CN   Gemini 网页端用量监测与额度显示
// @namespace    usage-tracker-of-gemini
// @version      2.4.5
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
        hoverOpenDelay: 120,
        hoverCloseDelay: 260,
        doneHold: 5_000,
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
            plan: (x) => `${x}`,
            refresh: '刷新用量',
            sessionTitle: '当前会话',
            sessionWin: '5 小时窗口',
            weeklyTitle: '每周限额',
            weeklyWin: '7 天窗口',
            s5h: '5小时用量',
            week: '周限额',
            resetIn: (d) => `${d}后重置`,
            resetSoon: '即将重置',
            resetUnknown: '重置时间未知',
            exhausted: '额度已用尽',
            runOut: (d) => `按当前速度约 ${d}后耗尽`,
            elapsedTip: (p) => `当前时间窗口已过去 ${p}%`,
            model: '模型',
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
            responding: (m) => `${m} 响应中`,
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
            plan: (x) => `${x}`,
            refresh: 'Refresh usage',
            sessionTitle: 'Current session',
            sessionWin: '5-hour window',
            weeklyTitle: 'Weekly limit',
            weeklyWin: '7-day window',
            s5h: '5h usage',
            week: 'Weekly',
            resetIn: (d) => `Resets in ${d}`,
            resetSoon: 'Resetting soon',
            resetUnknown: 'Reset time unknown',
            exhausted: 'Limit reached',
            runOut: (d) => `At this pace, runs out in ~${d}`,
            elapsedTip: (p) => `${p}% of this window has elapsed`,
            model: 'Model',
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
            responding: (m) => `${m} is responding`,
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
    };

    const icon = (d, size) =>
        s('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor', 'aria-hidden': 'true' }, s('path', { d }));

    /* ───────────────────────── 状态 ───────────────────────── */

    const S = {
        data: null,
        view: null,
        user: null,
        lastFetchAt: 0,
        error: null,
        inflight: null,
        fetchGen: 0,          // 优化: 竞态保护
        anchor: null,
        ui: null,
        currentModel: 'Gemini',
        modelCheckAt: 0,

        mode: 'idle',
        gen: null,
        liveTimer: 0,
        doneTimer: 0,

        open: false,
        pinned: false,
        openTimer: 0,
        closeTimer: 0,

        observer: null,
        tickTimer: 0,
        schedHandle: 0,
    };

    /* 优化: findStopBtn 缓存 */
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
            force = true;
            // 优化: 使旧请求失效，允许新请求
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

    /* 优化: 更稳健的耗尽预测 */
    function predictRunOut(pct, elapsedMs, resetAt, windowMs) {
        if (pct < 3 || pct >= 100) return null;
        // 最小观察时长：会话窗口 15 分钟，周窗口 ~3.4 小时
        const minRatio = windowMs <= CFG.sessionWindowMs ? 0.05 : 0.02;
        if (elapsedMs < windowMs * minRatio) return null;
        const rate = pct / elapsedMs;
        if (rate <= 0) return null;
        const remainMs = (100 - pct) / rate;
        const resetRemain = resetAt - Date.now();
        if (remainMs >= resetRemain) return null; // 不会在窗口重置前耗尽
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
    --gut-surface-high: var(--gem-sys-color-surface-container-high, #e9eef6);
    --gut-track: rgba(31, 31, 31, 0.09);
    --gut-state: rgba(31, 31, 31, 0.06);
    --gut-state-press: rgba(31, 31, 31, 0.1);
    --gut-divider: var(--gem-sys-color-outline-variant, rgba(196, 199, 197, 0.65));
    --gut-border: rgba(31, 31, 31, 0.07);
    --gut-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.05);
    --gut-primary: var(--gem-sys-color-primary, #0b57d0);
    --gut-primary-bg: var(--gem-sys-color-primary-container, #d3e3fd);
    --gut-primary-on-bg: var(--gem-sys-color-on-primary-container, #041e49);
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
    transition: opacity 0.25s cubic-bezier(0.05, 0.7, 0.1, 1), visibility 0s;
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
    --gut-state: rgba(227, 227, 227, 0.06);
    --gut-state-press: rgba(227, 227, 227, 0.11);
    --gut-divider: var(--gem-sys-color-outline-variant, rgba(68, 71, 70, 0.7));
    --gut-border: rgba(255, 255, 255, 0.08);
    --gut-shadow: 0 8px 24px rgba(0, 0, 0, 0.48), 0 2px 6px rgba(0, 0, 0, 0.32);
    --gut-primary: var(--gem-sys-color-primary, #a8c7fa);
    --gut-primary-bg: var(--gem-sys-color-primary-container, #0842a0);
    --gut-primary-on-bg: var(--gem-sys-color-on-primary-container, #d3e3fd);
    --gut-warn: #fdd663;   --gut-warn-t: #fdd663;   --gut-warn-bg: rgba(253, 214, 99, 0.14);
    --gut-danger: #f28b82; --gut-danger-t: #f28b82; --gut-danger-bg: rgba(242, 139, 130, 0.14);
}

#gut [data-level="ok"]     { --lv: var(--gut-primary); --lv-t: var(--gut-text);     --lv-bg: transparent; }
#gut [data-level="warn"]   { --lv: var(--gut-warn);    --lv-t: var(--gut-warn-t);   --lv-bg: var(--gut-warn-bg); }
#gut [data-level="danger"] { --lv: var(--gut-danger);  --lv-t: var(--gut-danger-t); --lv-bg: var(--gut-danger-bg); }

#gut button { appearance: none; background: transparent; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; }
#gut button:focus-visible, #gut a:focus-visible, #gut .gut-strip:focus-visible {
    outline: 2px solid var(--gut-primary);
    outline-offset: 2px;
}

#gut .gut-sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

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
    background: var(--lv, var(--gut-primary));
    /* 优化: 右端 M3 分割感 + 微内阴影 */
    box-shadow: 2px 0 0 0 var(--gut-surface), inset 0 0 0 1px rgba(0, 0, 0, 0.04);
    transition: width 0.55s cubic-bezier(0.2, 0, 0, 1), background-color 0.3s ease, filter 0.3s ease;
}

/* 优化: 危险状态脉冲（生成中不干扰） */
#gut:not(.is-generating) .gut-fill[data-level="danger"] {
    animation: gut-danger-pulse 2s ease-in-out infinite;
}
@keyframes gut-danger-pulse {
    0%, 100% { filter: brightness(1); }
    50%      { filter: brightness(1.15); }
}

#gut.is-generating .gut-fill {
    width: 100% !important;
    background: linear-gradient(90deg, #4285f4 0%, #9b72cb 35%, #d96570 68%, #4285f4 100%);
    background-size: 200% 100%;
    animation: gut-flow 1.6s linear infinite;
    box-shadow: none;
}
@keyframes gut-flow { to { background-position: -200% 0; } }

/* 优化: 完成时闪烁反馈 */
#gut.is-done .gut-fill {
    animation: gut-done-flash 0.7s cubic-bezier(0.2, 0, 0, 1);
}
@keyframes gut-done-flash {
    0%   { filter: brightness(1); }
    40%  { filter: brightness(1.55); }
    100% { filter: brightness(1); }
}

/* 优化: shimmer 骨架屏 */
#gut.is-loading .gut-fill,
#gut.is-loading .gut-row-fill {
    width: 100% !important;
    background: linear-gradient(90deg, var(--gut-track) 0%, var(--gut-text-3) 50%, var(--gut-track) 100%);
    background-size: 200% 100%;
    animation: gut-shimmer 1.6s linear infinite;
    opacity: 0.5;
    box-shadow: none;
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
#gut .gut-meta-right { flex-shrink: 0; }

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

/* 优化: 常驻条语义色 */
#gut .gut-main[data-level="warn"]   { color: var(--gut-warn-t); }
#gut .gut-main[data-level="danger"] { color: var(--gut-danger-t); font-weight: 600; }

#gut .gut-sub { overflow: hidden; text-overflow: ellipsis; }
#gut .gut-sub[data-tone="error"] { color: var(--gut-danger-t); font-weight: 500; }
#gut .gut-sub[data-tone="delta"] { color: var(--gut-primary); font-weight: 500; }


#gut .gut-plan { color: var(--gut-text-2); }

#gut .gut-panel {
    position: absolute;
    left: 0; right: 0; width: 100%;
    bottom: calc(100% + 8px);
    padding: 16px 20px 14px;
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
    transform: translateY(6px);
    transform-origin: center bottom;
    transition: opacity 0.15s cubic-bezier(0.2, 0, 0, 1), transform 0.18s cubic-bezier(0.2, 0, 0, 1), visibility 0s linear 0.18s;
    z-index: 1001;
}
#gut.is-open .gut-panel {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: none;
    transition: opacity 0.15s cubic-bezier(0.05, 0.7, 0.1, 1), visibility 0s;
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
    gap: 8px;
    margin: -2px -4px -2px 0;
}
#gut .gut-head-left { display: flex; align-items: center; gap: 8px; }
#gut .gut-head-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px; height: 20px;
    flex-shrink: 0;
}
#gut .gut-gemini-logo { width: 20px; height: 20px; display: block; object-fit: contain; }
#gut .gut-title { font-size: 14px; line-height: 20px; font-weight: 500; color: var(--gut-text); }
#gut .gut-refresh {
    width: 32px; height: 32px; border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--gut-text-2);
    transition: background-color 0.15s ease, color 0.15s ease;
}
#gut .gut-refresh:hover { background: var(--gut-state); color: var(--gut-text); }
#gut .gut-refresh:active { background: var(--gut-state-press); }
#gut .gut-refresh[aria-busy="true"] svg { animation: gut-spin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
@keyframes gut-spin { to { transform: rotate(360deg); } }

#gut .gut-rows { display: flex; flex-direction: column; gap: 10px; }
#gut .gut-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--gut-surface);
    border: 1px solid var(--gut-border);
    transition: border-color 0.3s ease;
}
/* 优化: 重置临近时加柔和边框提示 */
#gut .gut-row[data-reset="soon"] { border-color: var(--gut-warn-t); }

#gut .gut-row-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
#gut .gut-row-title { font-size: 13px; font-weight: 500; line-height: 18px; color: var(--gut-text); }
#gut .gut-row-win { margin-left: 6px; font-size: 12px; font-weight: 400; color: var(--gut-text-3); }
#gut .gut-row-pct {
    font-size: 14px;
    line-height: 18px;
    font-weight: 600;
    padding: 1px 6px;
    margin: -1px -6px;
    border-radius: 6px;
    background: var(--lv-bg, transparent);
    color: var(--lv-t, var(--gut-text));
    transition: color 0.3s, background-color 0.3s;
}

#gut .gut-row-track {
    position: relative;
    height: 6px;
    border-radius: 999px;
    background: var(--gut-track);
}
#gut .gut-row-fill {
    height: 100%;
    width: 0;
    border-radius: 999px;
    background: var(--lv, var(--gut-primary));
    box-shadow: 2px 0 0 0 var(--gut-surface);
    transition: width 0.55s cubic-bezier(0.2, 0, 0, 1), background-color 0.3s;
}
#gut .gut-row-tick {
    position: absolute;
    top: -3px; bottom: -3px;
    width: 2px;
    border-radius: 999px;
    background: var(--gut-text-2);
    box-shadow: 0 0 0 1.5px var(--gut-surface);
    opacity: 0.7;
    transform: translateX(-1px);
    transition: left 0.55s cubic-bezier(0.2, 0, 0, 1);
}

#gut .gut-row-foot {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    line-height: 16px;
    color: var(--gut-text-3);
}
#gut .gut-row-reset { display: flex; justify-content: space-between; align-items: center; }
/* 优化: 重置临近文字高亮 */
#gut .gut-row[data-reset="soon"] .gut-row-reset span:first-child {
    color: var(--gut-warn-t);
    font-weight: 500;
}
#gut .gut-row-hint { color: var(--gut-warn-t); font-weight: 500; }
#gut .gut-row-hint:empty { display: none; }
#gut .gut-row-hint[data-tone="danger"] { color: var(--gut-danger-t); }

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
#gut .gut-foot-left { display: flex; align-items: center; gap: 6px; min-width: 0; }


#gut .gut-status, #gut .gut-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    margin: -4px -6px;
    border-radius: 999px;
    white-space: nowrap;
    text-decoration: none;
    transition: background-color 0.15s ease, color 0.15s ease;
}
#gut .gut-status:hover, #gut .gut-link:hover { background: var(--gut-state); color: var(--gut-text); }
#gut .gut-status[data-error="1"] { color: var(--gut-danger-t); }
#gut .gut-link { color: var(--gut-primary); font-weight: 500; flex-shrink: 0; }

@media (max-width: 520px) {
    #gut .gut-sub, #gut .gut-sub-dot, #gut .gut-tier { display: none !important; }
    #gut .gut-panel { left: 0; right: 0; width: 100%; padding: 14px 14px 12px; }
}
@media (prefers-reduced-motion: reduce) {
    #gut *, #gut *::before, #gut *::after { transition-duration: 0.001s !important; }
    #gut.is-generating .gut-fill,
    #gut.is-generating .gut-live-dot,
    #gut.is-loading .gut-fill,
    #gut.is-loading .gut-row-fill,
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
                h('div', { class: 'gut-row-title' }, t(titleKey), h('span', { class: 'gut-row-win', text: t(winKey) })),
                (r.pct = h('div', { class: 'gut-row-pct', text: '--' }))),
            h('div', { class: 'gut-row-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
                (r.fill = h('div', { class: 'gut-row-fill' })),
                (r.tick = h('div', { class: 'gut-row-tick' }))),
            h('div', { class: 'gut-row-foot' },
                h('div', { class: 'gut-row-reset' },
                    (r.resetLeft = h('span')),
                    (r.resetRight = h('span'))),
                (r.hint = h('span', { class: 'gut-row-hint' }))));
        r.track = r.root.querySelector('.gut-row-track');
        r.tick.style.display = 'none';
        return r;
    }

    function buildUI() {
        const u = {};

        u.strip = h('div', {
            class: 'gut-strip', role: 'button', tabindex: '0',
            'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': t('tip'),
        },
            h('div', { class: 'gut-bar' }, (u.fill = h('div', { class: 'gut-fill', 'data-level': 'ok' }))),
            h('div', { class: 'gut-meta' },
                h('div', { class: 'gut-meta-left' },
                    h('span', { class: 'gut-live-dot' }),
                    (u.main = h('span', { class: 'gut-main' })),
                    (u.subDot = h('span', { class: 'gut-dot gut-sub-dot' })),
                    (u.sub = h('span', { class: 'gut-sub' }))),
                h('div', { class: 'gut-meta-right' },
                    (u.plan = h('span', { class: 'gut-plan' })))));

        u.rows = {
            session: buildRow('sessionTitle', 'sessionWin'),
            weekly: buildRow('weeklyTitle', 'weeklyWin'),
        };

        u.refreshBtn = h('button', { class: 'gut-refresh', type: 'button', title: t('refresh'), 'aria-label': t('refresh'), 'aria-busy': 'false' },
            icon(ICON.refresh, 18));

        u.panel = h('div', { class: 'gut-panel', role: 'dialog', 'aria-label': t('panelTitle') },
            h('div', { class: 'gut-head' },
                h('div', { class: 'gut-head-left' },
                    h('span', { class: 'gut-head-icon' },
                        h('img', {
                            class: 'gut-gemini-logo',
                            src: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg',
                            width: 20, height: 20, alt: 'Gemini',
                        })),
                    h('span', { class: 'gut-title', text: t('panelTitle') })),
                u.refreshBtn),
            h('div', { class: 'gut-rows' }, u.rows.session.root, u.rows.weekly.root),
            h('div', { class: 'gut-foot' },
                h('div', { class: 'gut-foot-left' },
                    (u.status = h('button', { class: 'gut-status', type: 'button', title: t('refresh') }))),
                (u.link = h('a', { class: 'gut-link', href: '/usage', target: '_blank', rel: 'noopener' },
                    h('span', { text: t('details') }), icon(ICON.open, 12)))));

        // 优化: 屏幕阅读器播报
        u.live = h('div', { class: 'gut-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });

        u.root = h('div', { id: ID, class: 'is-loading' }, u.strip, u.panel, u.live);

        /* 交互 */
        u.root.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'touch') return;
            clearTimeout(S.closeTimer);
            if (!S.open) {
                clearTimeout(S.openTimer);
                S.openTimer = setTimeout(openPanel, CFG.hoverOpenDelay);
            }
        });
        u.root.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'touch') return;
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
        u.refreshBtn.addEventListener('click', async () => {
            const t0 = Date.now();
            u.refreshBtn.setAttribute('aria-busy', 'true');
            await refresh(true);
            setTimeout(() => u.refreshBtn.setAttribute('aria-busy', 'false'), Math.max(0, 600 - (Date.now() - t0)));
        });
        u.status.addEventListener('click', () => refresh(true));

        return u;
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

    function closePanel() {
        clearTimeout(S.openTimer);
        clearTimeout(S.closeTimer);
        S.open = false;
        S.pinned = false;
        if (!S.ui) return;
        S.ui.root.classList.remove('is-open');
        S.ui.strip.setAttribute('aria-expanded', 'false');
    }

    function togglePin() {
        if (S.open && S.pinned) closePanel();
        else { S.pinned = true; openPanel(); }
    }

    /* ───────────────────────── 渲染 ───────────────────────── */

    function detectCurrentModel() {
        const now = Date.now();
        if (now - S.modelCheckAt < 2000) return;
        S.modelCheckAt = now;
        const btn = $('button.input-area-switch') || $('[data-test-id="bard-mode-menu-button"]');
        const txt = (btn?.innerText ?? btn?.textContent)?.replace(/\s+/g, ' ').trim();
        if (txt && txt !== S.currentModel) S.currentModel = txt;
    }

    function renderRow(row, p, kind) {
        if (p?.isFree) {
            row.root.dataset.level = 'ok';
            setText(row.pct, 'Free');
            row.fill.style.width = '0%';
            row.track.setAttribute('aria-valuenow', '0');
            row.tick.style.display = 'none';
            row.root.dataset.reset = '';
            setText(row.resetLeft, kind === 'session' ? '动态容量 · 按需分配' : '可升级以获取高级模型配额');
            setText(row.resetRight, '');
            setText(row.hint, '');
            return;
        }

        row.root.dataset.level = p ? p.level : 'ok';
        setText(row.pct, p ? `${fmtPct(p.pct)}%` : '--');
        row.fill.style.width = `${p ? p.pct : 0}%`;

        // 优化: progressbar 语义值
        row.track.setAttribute('aria-valuenow', String(Math.round(p ? p.pct : 0)));

        if (p && p.elapsed != null) {
            row.tick.style.display = '';
            row.tick.style.left = `${p.elapsed * 100}%`;
            row.tick.title = t('elapsedTip', Math.round(p.elapsed * 100));
        } else {
            row.tick.style.display = 'none';
        }

        // 优化: 重置临近标记
        const soon = p?.resetAt && (p.resetAt - Date.now()) < 5 * 60 * 1000 && p.resetAt > Date.now();
        row.root.dataset.reset = soon ? 'soon' : '';

        if (p?.resetAt) {
            const at = kind === 'session' ? fmtClock(p.resetAt) : fmtDateTime(p.resetAt);
            setText(row.resetLeft, resetText(p.resetAt));
            setText(row.resetRight, at);
        } else if (p) {
            setText(row.resetLeft, t('resetUnknown'));
            setText(row.resetRight, '');
        } else {
            setText(row.resetLeft, '');
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
        setText(row.hint, hint);
        row.hint.dataset.tone = urgent ? 'danger' : 'warn';
    }

    /* 优化: aria-live 播报，仅等级变化时触发 */
    let lastAnnouncedLevel = '';
    function announceLevel(level, pct) {
        if (!S.ui?.live || level === lastAnnouncedLevel) return;
        lastAnnouncedLevel = level;
        const p = Math.round(pct);
        if (level === 'danger') setText(S.ui.live, t('announceDanger', p));
        else if (level === 'warn') setText(S.ui.live, t('announceWarn', p));
        else if (pct >= 100) setText(S.ui.live, t('announceExhausted'));
        else setText(S.ui.live, t('s5h') + ' ' + p + '%');
    }

    function render() {
        const u = S.ui;
        if (!u) return;

        const v = (S.view = compute(S.data));
        const ses = v?.session;
        const wk = v?.weekly;

        u.root.classList.toggle('is-loading', !S.data && !S.error);

        u.fill.style.width = `${ses ? ses.pct : 0}%`;
        u.fill.dataset.level = ses?.level || 'ok';
        // 优化: 常驻条也带 progressbar 语义
        u.strip.setAttribute('aria-valuenow', String(Math.round(ses?.pct || 0)));


        renderRow(u.rows.session, ses, 'session');
        renderRow(u.rows.weekly, wk, 'weekly');


        if (u.link && S.user?.usagePath) u.link.href = S.user.usagePath;

        const ago = Date.now() - S.lastFetchAt;
        let status;
        if (S.error) status = t('failed');
        else if (!S.lastFetchAt) status = t('loading');
        else if (ago < 10_000) status = t('justNow');
        else if (ago < 60_000) status = t('agoS', Math.round(ago / 1000));
        else if (ago < 3_600_000) status = t('agoM', Math.round(ago / 60_000));
        else status = t('agoH', Math.round(ago / 3_600_000));
        setText(u.status, status);
        u.status.dataset.error = S.error ? '1' : '';

        u.strip.setAttribute('aria-label',
            `${t('tip')}: ${t('s5h')} ${ses ? fmtPct(ses.pct) : '--'}%, ${t('week')} ${wk ? fmtPct(wk.pct) : '--'}%`);

        paintMeta();

        // 优化: 无障碍播报
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

        let main, sub = '', tier = '', plan, tone = '', mainLevel = '';

        if (S.mode === 'live') {
            const sec = Math.floor((Date.now() - g.start) / 1000);
            main = `${t('generating')} ${fmtElapsed(sec)}`;
            sub = g.chars ? t('chars', g.chars.toLocaleString()) : '';
            plan = t('responding', S.currentModel);
        } else {
            if (S.mode === 'done') {
                const sec = Math.max(1, Math.round((g.end - g.start) / 1000));
                main = `${t('done')} ${fmtElapsed(sec)}`;
                if (g.syncing) sub = t('syncing');
                else if (g.delta > 0.04) { sub = t('thisReply', fmtPct(g.delta)); tone = 'delta'; }
            } else if (v?.isFree) {
                main = 'Free 方案';
                sub = '动态配额';
                plan = '标准容量';
            } else {
                main = `${t('s5h')} ${ses ? fmtPct(ses.pct) : '--'}%`;
                if (S.error) { sub = t('failedShort'); tone = 'error'; }
                else sub = ses?.resetAt ? resetText(ses.resetAt) : '';
                mainLevel = S.error ? 'danger' : (ses?.level || 'ok');
                plan = `${t('week')} ${wk ? fmtPct(wk.pct) : '--'}%`;
            }
        }

        setText(u.main, main);
        setText(u.sub, sub);
        setText(u.plan, plan);
        u.main.dataset.level = mainLevel;
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
        // 优化: 250ms 缓存，避免高频 DOM 查询
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
        const nodes = document.querySelectorAll('message-content');
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

        // 优化: 4 次递增轮询，更好捕捉服务端延迟更新
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
            if (S.open && S.ui && !S.ui.root.contains(e.target)) closePanel();
        }, true);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && S.open) closePanel();
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