/**
 * Edge Runner - Web's Resonance Interpreter
 * Copyright (c) 2025 Aidgn
 * AGPL-3.0-or-later - See LICENSE file for details
 *
 * Created for ensemble performance with Full Score
 * This code structure is for edge runtime environments.
 * 
 * Different platforms require different entry point syntax:
 * - export default { fetch(request, env, ctx) }
 * - export default function handler(request)
 * 
 * Please adapt the entry point to your platform before deployment.
 * Core logic (scan, botPattern, humanPattern) works across all platforms.
 */

const TIC = 100; // 🚨 Important: BEAT Tick must match Full Score
const TOK = { P:'!', E:'*', T:'~', A:'/', L:'-' }; // 🚨 Important: BEAT Token must match Full Score
const RE_TIME = new RegExp(`(\\${TOK.T}|\\${TOK.A})(\\d+)(?=[\\${TOK.E}\\${TOK.A}\\${TOK.P}]|_|$)`, 'g');
const RE_SPACE = new RegExp(`(\\${TOK.P}|\\${TOK.T}|\\${TOK.E})`, 'g');
const EX_DEFAULT = `${TOK.P}home${TOK.T}23.7${TOK.E}nav-2${TOK.T}190.8${TOK.E}nav-3${TOK.T}37.5${TOK.A}12.3${TOK.E}help${TOK.T}112.8${TOK.E}more-1${TOK.T}4.3${TOK.P}prod${TOK.T}103.4${TOK.E}button-12${TOK.T}105.0${TOK.E}p1___2${TOK.P}p1${TOK.T}240.3${TOK.E}img-1${TOK.T}119.4${TOK.E}buy-1${TOK.T}1.3${TOK.A}0.8${TOK.A}0.8${TOK.E}buy-1-up${TOK.T}53.2${TOK.E}review${TOK.T}14${TOK.P}review${TOK.T}201.8${TOK.E}nav-1___1${TOK.T}659.0${TOK.E}mycart___3${TOK.P}cart`;
const EX_SPACE = EX_DEFAULT.replace(RE_SPACE, ' $1').replace(/___(\d+)/g, ' ___$1').trimStart();

const STREAMING = { // Security and Personalization
	LOG: false,		// Enable only in development (default: false)
	TIME: false,		// Include timestamp in logs. Excluding it helps reduce re-identification risk and strengthen compliance. (default: false)
	HASH: false,		// Include hash in logs. Must be enabled for reassembly when batches are fragmented due to settings like POW=true in Full Score (default: false)
	BOT: true,		// Listens for the RHYTHM of bot BEAT (default: true)
	HUMAN: true,	// Listens for the RHYTHM of human BEAT (default: true)
};

const ARCHIVING = { // Serverless Analytics with AI Insights
	LOG: true,		// Archive user journeys and push logs to cloud storage (default: false)
	TIME: false,		// Include timestamp in logs. Excluding it helps reduce re-identification risk and strengthen compliance. (default: false)
	HASH: false,		// Include hash in logs. Must be enabled for reassembly when batches are fragmented due to settings like POW=true in Full Score (default: false)
	SPACE: true,	// Add spaces to BEAT string for better readability (default: true)
	AI: false,		// Enable AI insights of archived BEAT logs (default: false)
	BOUNCE: 1,		// AI insights skipped below N clicks (default: 1)
	PROMPT: 1,		// Prompt option. Higher numbers need more capable AI (default: 1)
	MODEL: '@cf/openai/gpt-oss-20b'	// AI model (default: @cf/openai/gpt-oss-20b)
};

export default { // Start Edge Runner
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const cookies = request.headers.get("Cookie") || "";

		// Live streaming handler
		if (url.pathname === "/rhythm/" && url.searchParams.has("livestreaming")) {
			const match = scan(cookies); // Score cookie: field_time_hash___tabs
			if (!((STREAMING.BOT && match.bot) || (STREAMING.HUMAN && match.human))) return request.method === 'HEAD' ? new Response(null, {status: 204}) : fetch(request); // Early return when no detection - saves processing and network
			const save = match.score[0]; // Store original value for comparison

			// Update security field (OXXXXXXXXX)
			// 🚨 Important: Configure WAF rules with these expressions: 0=Pass, 1=Managed Challenge, 2=Block
			// Level 1 - Managed Challenge: (any(starts_with(http.request.cookies["score"][*], "1")) and not http.cookie contains "cf_chl")
			// Level 2 - Block: (any(starts_with(http.request.cookies["score"][*], "2")))
			if (STREAMING.BOT && match.bot) {
				match.score[0] = match.score[0].replace(/^./, m => m < 2 ? +m + 1 : 2);
				console.log('⛔ bot: ' + match.bot + ' (level ' + match.score[0][0] + ')'); // ⛔ bot: MachineGun:12 (level 1)
			}

			// Update personalization field (XOOOOOOOOO)
			// 🚨 Important: Requires customizing humanPattern() before enabling
			// Consider KV store validation to prevent users from tampering with cookies
			// where values like 0000000000, 0101010101 indicate independent flags for each position
			if (STREAMING.HUMAN && match.human) {
				const field = match.score[0].split('');
				if (field[match.human] === '0') { // client sets 0 to repeat or 2 for one time after run
					field[match.human] = '1';
					match.score[0] = field.join('');
					console.log('✅ Human: ' + match.score[0] + ' (case ' + match.human + ')'); // ✅ Human: 0100000000 (case 1)
				}
			}

			// Custom code can be added here to include AI analysis in live streaming as well.
			// Letting AI make decisions and update security or personalization fields is technically doable.
			// Analytics is even possible here, though probably overkill.
			// Keep in mind the operational cost trade-off.

			if (STREAMING.LOG) { // Shows live streaming logs every RHYTHM (default: false)
				let logs = cookies;
				logs = logs.replace(/rhythm_(\d+)=(\d+)_([^_]+)_([^_]+)_/g, (m, number, field, time, hash) => {
					const t = STREAMING.TIME ? time : '';
					const h = STREAMING.HASH ? hash : '';
					return `rhythm_${number}=${field}_${t}_${h}_`;
				});
				ctx.waitUntil(console.log(logs));
			}
			if (request.method === 'HEAD' && match.score[0] !== save) return new Response(null, {status: 204, headers: {'Set-Cookie': 'score=' + match.score[0] + '_' + match.score[1] + '_' + match.score[2] + match.score[3] + '; Path=/; SameSite=Lax; Secure'}}); // Only set cookie when value actually changed
			if (request.method === 'HEAD') return new Response(null, {status: 204}); // No cookie update when value unchanged reduces network overhead
		}

		// Batch archiving handler
		if (url.pathname === "/rhythm/echo" && request.method === "POST") {
			let body = await request.text();
			if (!ARCHIVING.LOG) return new Response('OK');

			const map = {};
			const match = body.match(/rhythm_\d+=.*?(?=rhythm_|$)/g);
			for (let i = 0; i < match.length; i++) {
				const split = match[i].split('=');
				const number = split[0].slice(7);
				const parts = split[1].split('_');
				map[number] = {
					time: parts[1],
					hash: parts[2],
					device: +parts[3],
					referrer: +parts[4],
					scrolls: +parts[5],
					clicks: +parts[6],
					duration: +parts[7],
					beat: parts.slice(8).join('_').split(/(___\d+)/).filter(Boolean)
				};
			}
			const first = String(Math.min(...Object.keys(map).map(Number)));
			let current = first;
			let flow = '';
			const index = {};
			while (map[current]) {
				const i = index[current] || 0;
				if (i >= map[current].beat.length) break;
				
				const token = map[current].beat[i];
				index[current] = i + 1;
				flow += token;
				
				if (token.startsWith('___')) current = token.slice(3);
			}
			const leader = map[first];
			const merge = {};
			if (leader.time) merge.time = leader.time;
			if (leader.hash) merge.hash = leader.hash;
			merge.device = leader.device;
			merge.referrer = leader.referrer;
			merge.scrolls = 0;
			merge.clicks = 0;
			merge.duration = 0;
			for (const number in map) {
				merge.scrolls += map[number].scrolls;
				merge.clicks += map[number].clicks;
				merge.duration += map[number].duration;
			}
			merge.beat = flow;
			if (!ARCHIVING.TIME) delete merge.time;
			if (!ARCHIVING.HASH) delete merge.hash;
			merge.duration = +(merge.duration * TIC / 1000).toFixed(1);
			merge.beat = merge.beat.replace(RE_TIME, (_, s, n) => s + (+n * TIC / 1000).toFixed(1));
			if (ARCHIVING.SPACE) {
				merge.beat = merge.beat
					.replace(RE_SPACE, ' $1')
					.replace(/___(\d+)/g, ' ___$1')
					.trimStart();
			}
			body = JSON.stringify(merge);

			// 🚨 Important: AI prompt dynamically adjusts based on BEAT Token and TIME, HASH, SPACE settings
			// Please review the structure carefully before making modifications
			if (ARCHIVING.AI && env.fullscore && merge.clicks >= ARCHIVING.BOUNCE) {
				const time = ARCHIVING.TIME ? `"time":"1735680000",` : '';
				const hash = ARCHIVING.HASH ? `"hash":"x7n4kb2p",` : '';
				const example = ARCHIVING.SPACE ? EX_SPACE : EX_DEFAULT;
				const space = ARCHIVING.SPACE ? ' ' : '';
				let messages;

				if (ARCHIVING.PROMPT === 1) {
					messages = [{
						role: 'system',
						content: `You are a web analytics expert specializing in user behavior pattern recognition, and your task is to convert NDJSON data into precise natural-language analysis.
						Produce exactly four lines in this order: [CONTEXT], [SUMMARY], [ISSUE], [ACTION].
						Do not include any extra text and do not quote the input.
						Follow the EXAMPLE format exactly.

						----------

						EXAMPLE

						Input = {${time}${hash}"device":1,"referrer":5,"scrolls":56,"clicks":15,"duration":1872.8,"beat":"${example}"}

						Output =
						[CONTEXT] Mobile user, direct visit, 56 scrolls, 15 clicks, 1872.8 seconds
						[SUMMARY] Confused behavior. Landed on homepage, hesitated in help section with repeated clicks at 37 and 12 second intervals. Moved to product page, opened details in a new tab, viewed images for about 240 seconds. Tapped buy button three times at 1.3, 0.8, and 0.8 second intervals. Returned after 660 seconds and opened cart but didn't proceed to checkout.
						[ISSUE] Cart reached but purchase not completed. Repeated buy actions may reflect either intentional multi-item additions or friction in option selection. Long delay before checkout suggests uncertainty.
						[ACTION] Evaluate if repeated buy or cart actions represent deliberate comparison behavior or checkout friction. If friction is likely, simplify option handling and highlight key product details earlier in the flow.

						----------

						[CONTEXT]
						Write by comparing the NDJSON fields as follows.

						device:
						- 0 = Desktop user
						- 1 = Mobile user
						- 2 = Tablet user

						referrer:
						- 0 = Direct visit
						- 1 = Internal visit
						- 2 = Unknown visit
						- 3+ = Mapped(n) visit

						scrolls: Use the input value as is. (e.g., 13 scrolls)

						clicks: Use the input value as is. (e.g., 25 clicks)

						duration: Use the input value as is. (e.g., 257.9 seconds)

						---

						[SUMMARY]
						Start with one behavior type and put it as the first word. Summarize the user journey chronologically using time intervals. Keep it factual and concise, using 3–5 short sentences.

						Behavior Types:
						- Normal behavior = Varied rhythm with smooth flow and human-like patterns
						- Confused behavior = Hesitant rhythm with repetitive and abandonment patterns
						- Irregular behavior = Erratic rhythm with potentially fake or manipulated patterns
						- Bot-like behavior = Mechanical rhythm with perfect timing, 0 scrolls, or repeated page navigation showing non-human patterns

						Beat Syntax:
						- ${TOK.P} = page
						- ${TOK.E} = element
						- ${TOK.T} = time interval from the previous event to selecting the next event
						- ${TOK.A} = time interval when repeatedly selecting the same event
						- ___N = tab switch
						(e.g., ${TOK.P}home, ${TOK.P}product-01, ${TOK.P}x3n, ${TOK.P}ds9df, ${TOK.E}7div1, ${TOK.E}6p4, ${TOK.E}button, ${TOK.T}1.3, ${TOK.T}43.1${TOK.A}0.6${TOK.A}1.2, ${TOK.T}6.4${TOK.A}8.3, ___2, ___1, ___3)

						Beat Interpretation Rules:
						- The beat always starts with '${TOK.P}' (page), and it's likely to begin with ${TOK.P}home.
						- '${TOK.A}' shows time intervals when the same element is selected repeatedly. For example, ${TOK.T}1.3${TOK.A}0.8${TOK.A}0.8${space}${TOK.E}button means ${TOK.T}1.3${space}${TOK.E}button${space}${TOK.T}0.8${space}${TOK.E}button${space}${TOK.T}0.8${space}${TOK.E}button.
						- Beat syntax should be interpreted in two group units to understand the entire flow and write effectively. The small group is from '${TOK.P}' (page) until the next '${TOK.P}' (page) appears. The large group is from '___N' (tab switch) until the next '___N' (tab switch) appears.
						- Time interval notations like '${TOK.T}' or '${TOK.A}' that appear immediately after '___N' (tab switch) include the elapsed time while being away from that tab. That's why time elapsed descriptions are mandatory, as shown in the EXAMPLE.

						---

						[ISSUE]
						Identify the conversion inhibitors or causes of metric distortion from the SUMMARY. Keep it concise and factual.

						---

						[ACTION]
						Suggest one clear and specific measure to resolve the ISSUE.`
					}, {
						role: 'user',
						content: body
					}];
				} else if (ARCHIVING.PROMPT === 2) {
					messages = [{
						role: 'system',
						content: `You are a web analytics expert specializing in user behavior pattern recognition, and your task is to convert NDJSON data into precise natural-language analysis.
						Produce exactly five lines in this order: [CONTEXT], [TIMELINE], [PATTERN], [ISSUE], [ACTION].
						Do not include any extra text and do not quote the input.
						Follow the EXAMPLE format exactly.

						----------

						EXAMPLE

						Input = {${time}${hash}"device":1,"referrer":5,"scrolls":56,"clicks":15,"duration":1872.8,"beat":"${example}"}

						Output =
						[CONTEXT] Mobile user, mapped(5) visit, 56 scrolls, 15 clicks, 1872.8 seconds
						[TIMELINE] The user landed on the homepage and clicked navigation after 23.7 seconds, then spent 190.8 seconds browsing before clicking another menu. In the help section, repetitive clicks at 37.5 and 12.3 second intervals revealed hesitation. After 112.8 seconds, the user clicked *more-1 and 4.3 seconds later moved to !prod. After 103.4 seconds, the user clicked *button-12, then after 105.0 seconds clicked *p1 and switched to the second tab. In the second tab, the user spent 240.3 seconds browsing product images and clicked *img-1. After another 119.4 seconds, the user pressed *buy-1 and quickly tapped *buy-1-up three times at 1.3, 0.8, and 0.8 second intervals, likely adjusting quantity or options. The user stayed for 53.2 seconds before opening *review and 1.4 seconds later moved to the !review page. After 201.8 seconds, the user clicked *nav-1 to return to the first tab. After 659.0 seconds on the first tab, the user opened *mycart in a third tab.
						[PATTERN] Confused behavior. Repeated help clicks, multiple buy button taps, and stopping at cart without buying show UX problems and user difficulty.
						[ISSUE] The user reached the cart but did not complete a purchase. Extended pauses and cross-tab navigation suggest uncertainty or friction near the decision point.
						[ACTION] Simplify checkout and surface key product differences on the product page to reduce tab switching. Add inline guidance near hesitation points like *help and *review.

						----------

						[CONTEXT]
						Write by comparing the NDJSON fields as follows.

						- "device"
						  0 = Desktop user
						  1 = Mobile user
						  2 = Tablet user

						- "referrer"
						  0 = Direct visit
						  1 = Internal visit
						  2 = Unknown visit
						  3+ = Mapped(n) visit

						- "scrolls"
						  Use the input value as is.
						  (e.g., 13 scrolls)

						- "clicks"
						  Use the input value as is.
						  (e.g., 25 clicks)

						- "duration"
						  Use the input value as is.
						  (e.g., 257.9 seconds)

						---

						[TIMELINE]
						The beat string lists user actions in chronological order. Follow these 5 rules precisely and write without arbitrary assumptions.

						- The beat syntax is as follows.
						  ${TOK.P} = page
						  ${TOK.E} = element
						  ${TOK.T} = time interval from the previous event to selecting the next event
						  ${TOK.A} = time interval when repeatedly selecting the same event
						  ___N = tab switch
						  (e.g., ${TOK.P}home, ${TOK.P}product-01, ${TOK.P}x3n, ${TOK.P}ds9df, ${TOK.E}7div1, ${TOK.E}6p4, ${TOK.E}button, ${TOK.T}1.3, ${TOK.T}43.1${TOK.A}0.6${TOK.A}1.2, ${TOK.T}6.4${TOK.A}8.3, ___2, ___1, ___3)

						- The beat always starts with '${TOK.P}' (page), and it's likely to begin with ${TOK.P}home.

						- '${TOK.A}' shows time intervals when the same element is selected repeatedly. For example, ${TOK.T}1.3${TOK.A}0.8${TOK.A}0.8${space}${TOK.E}button means ${TOK.T}1.3${space}${TOK.E}button${space}${TOK.T}0.8${space}${TOK.E}button${space}${TOK.T}0.8${space}${TOK.E}button.

						- Beat syntax should be interpreted in two group units to understand the entire flow and write effectively.
						  The small group is from '${TOK.P}' (page) until the next '${TOK.P}' (page) appears.
						  The large group is from '___N' (tab switch) until the next '___N' (tab switch) appears.

						- Time interval notations like '${TOK.T}' or '${TOK.A}' that appear immediately after '___N' (tab switch) include the elapsed time while being away from that tab. That's why time elapsed descriptions are mandatory, as shown in the EXAMPLE.

						---

						[PATTERN]
						Synthesize all information including time intervals of event selection, repetition, tab switching, and scroll-to-click ratio, then select only one behavior type from the 4 conditions below and briefly explain why, just like the EXAMPLE.

						- Normal behavior
						  Varied rhythm with smooth flow and human-like patterns

						- Confused behavior
						  Hesitant rhythm with repetitive and abandonment patterns

						- Irregular behavior
						  Erratic rhythm with potentially fake or manipulated patterns

						- Bot-like behavior
						  Mechanical rhythm with perfect timing, 0 scrolls, or repeated page navigation showing non-human patterns

						---

						[ISSUE]
						Write in one line the conversion inhibitors or causes of metric distortion identified from the PATTERN.

						---

						[ACTION]
						Suggest one specific measure to resolve the ISSUE.`
					}, {
						role: 'user',
						content: body
					}];
				}
				ctx.waitUntil(
					env.fullscore.run(
						ARCHIVING.MODEL,
						ARCHIVING.MODEL.includes('gpt-oss') ? { input: messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n') } : { messages }
					).then(r => console.log(body + '\n' + (r?.output?.filter(x => x.type === 'message') ?? [r]).map(o => o?.content?.[0]?.text ?? o?.response).join('\n')))
				);
			} else {
				console.log(body);
			}
			return new Response('OK');
		}
		return fetch(request);
	}
};

// Scan cookies
function scan(cookies) {
	const raw = cookies.match(/score=([^;]+)/)[1], sep = raw.indexOf('___');
	const score = raw.slice(0, sep).split('_').concat(raw.slice(sep));
	const rhythm = /rhythm_(\d+)=([^;]+)/g;
	let match, bot = null, human = null;
	while ((match = rhythm.exec(cookies))) {
		const p = match[2].split('_');
		const data = {scrolls: +p[5], clicks: +p[6], duration: +p[7], beat: p.slice(8).join('_')};
		if (!data.beat) continue;
		if ((bot = botPattern(data)) || (human = humanPattern(data))) break;
	}
	return {bot, human, score};
}

// Listens for the RHYTHM of bot BEAT (default: true)
function botPattern(data) {

	// MachineGun: 200ms or less, 10+ consecutive
	const machinegun = data.beat.match(new RegExp(`\\${TOK.T}(\\d+)`, 'g'));
	if (machinegun && machinegun.length >= 10) for (let i = 0, count = 0; i < machinegun.length; i++)
		if ((count = +machinegun[i].slice(1) <= 200/TIC ? count + 1 : 0) >= 10) return `MachineGun:${count}`;

	// Metronome: same interval 8+ times
	const metronome = data.beat.match(new RegExp(`[\\${TOK.A}\\${TOK.T}](\\d+)([\\${TOK.A}\\${TOK.T}]\\1){7,}`));
	if (metronome) return `Metronome:${metronome[1]}`;

	// NoVariance: standard deviation < 2, need 4+ data points
	const novariance = data.beat.match(new RegExp(`\\${TOK.T}(\\d+)`, 'g'));
	if (novariance && novariance.length >= 4) {
		const values = novariance.map(t => +t.slice(1)), average = values.reduce((x, y) => x + y) / values.length;
		const spread = Math.sqrt(values.reduce((s, x) => s + (x - average) ** 2, 0) / values.length);
		if (spread < 200/TIC && average > 1000/TIC) return `NoVariance:${spread.toFixed(1)}`;
	}

	// Arithmetic: constant interval increase/decrease, 4+ points
	const arithmetic = data.beat.match(new RegExp(`\\${TOK.T}(\\d+)`, 'g'));
	if (arithmetic && arithmetic.length >= 4) {
		const values = arithmetic.map(t => +t.slice(1)), delta = values[1] - values[0];
		if (delta && values.every((x, i) => !i || x - values[i - 1] === delta)) return `Arithmetic:${delta > 0 ? '+' : ''}${delta}`;
	}

	// Geometric: constant multiplication ratio, 4+ points
	const geometric = data.beat.match(new RegExp(`\\${TOK.T}(\\d+)`, 'g'));
	if (geometric && geometric.length >= 4) {
		const values = geometric.map(t => +t.slice(1));
		const ratio = values[0] > 0 && values[1] > 0 && values[1] / values[0];
		if (ratio && ratio !== 1 && values.every((x, i) => !i || (values[i - 1] > 0 && Math.abs(x / values[i - 1] - ratio) < 0.01))) return `Geometric:x${ratio.toFixed(1)}`;
	}

	// PingPong: A-B-A-B page bounce, 3+ cycles (6 pages total)
	const pingpong = data.beat.match(new RegExp(`\\${TOK.P}([^\\${TOK.T}\\${TOK.E}\\${TOK.P}]+)\\${TOK.P}([^\\${TOK.T}\\${TOK.E}\\${TOK.P}]+)(?:\\${TOK.P}\\1\\${TOK.P}\\2)+`));
	if (pingpong && pingpong[0].split(TOK.P).filter(Boolean).length >= 6) return `PingPong:${pingpong[1]}-${pingpong[2]}`;

	// Surface: DOM depth ≤2 is 90%+, need 10+ clicks
	const surface = data.beat.match(new RegExp(`\\${TOK.E}(\\d+)`, 'g'));
	if (surface && surface.length >= 10) {
		const shallow = surface.filter(d => +d.slice(1) <= 2).length;
		if (shallow / surface.length > 0.9) return `Surface:${shallow}/${surface.length}`;
	}

	// Monotonous: diversity < 15%, need 20+ clicks
	const monotonous = data.beat.match(new RegExp(`\\${TOK.E}[^\\${TOK.P}\\${TOK.T}]+`, 'g'));
	if (monotonous && monotonous.length >= 20) {
		const unique = new Set(monotonous).size;
		if (unique / monotonous.length < 0.15) return `Monotonous:${unique}t`;
	}

	// 🚨 Important: This is an example implementation
	// Detects 3+ rapid clicks on are-you-human button (~3/1/2*are-you-human)
	const example = data.beat.match(/((?:~[0-4]|\/[0-4])+)\*are-you-human[~\d.]*$/);
	if (example) {
		const count = (example[1].match(/[~\/]/g) || []).length;
		if (count >= 3) return `BotExample:${count}`;
	}

	return null;
}

// Listens for the RHYTHM of human BEAT (default: false)
function humanPattern(data) {

	// 🚨 Important: This is an example implementation
	// Detects 3+ slow clicks on are-you-human button (~15/12/14*are-you-human)
	// Sets personalization field to 0100000000 to trigger client-side behavior (e.g., show welcome popup)
	const example = data.beat.match(/((?:~(?:[5-9]|\d{2,})|\/(?:[5-9]|\d{2,}))+)\*are-you-human[~\d.]*$/);
	if (example) {
		const times = example[1].match(/\d+/g).map(Number);
		const sum = times.reduce((a, b) => a + b, 0);
		if (times.length >= 3 && sum < 100) return 1; // Use personalization field position 1 (XOXXXXXXXX)
	}

	if (false) return 2; // Use personalization field position 2 (XXOXXXXXXX)
	if (false) return 3; // Use personalization field position 3 (XXXOXXXXXX)
	if (false) return 4; // Use personalization field position 4 (XXXXOXXXXX)
	if (false) return 5; // Use personalization field position 5 (XXXXXOXXXX)
	if (false) return 6; // Use personalization field position 6 (XXXXXXOXXX)
	if (false) return 7; // Use personalization field position 7 (XXXXXXXOXX)
	if (false) return 8; // Use personalization field position 8 (XXXXXXXXOX)
	if (false) return 9; // Use personalization field position 9 (XXXXXXXXXO)

	return null;
}
