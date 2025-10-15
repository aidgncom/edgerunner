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

const STREAMING = { // Security and Personalization
	DEBUG: false,	// Enable only in development (default: false)
	BOT: true,		// Listens for the RHYTHM of bot BEAT (default: true)
	HUMAN: false,	// Listens for the RHYTHM of human BEAT (default: false)
};

const ARCHIVING = { // Serverless Analytics
	LOG: true,		// Archive user journeys and push logs to cloud storage (default: false)
	TIME: false,		// Include timestamp in logs. Excluding it helps reduce re-identification risk and strengthen compliance. (default: false)
	HASH: false,		// Include hash in logs. Must be enabled for reassembly when batches are fragmented due to settings like POW=true in Full Score (default: false)
	AI: true,		// Enable AI insights of archived BEAT logs (default: false)
	MODEL: '@cf/openai/gpt-oss-20b'	// Default AI model
};

export default { // Start Edge Runner
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const cookies = request.headers.get("Cookie") || "";

		// Debug mode shows live streaming logs every RHYTHM (default: false)
		if (STREAMING.DEBUG) ctx.waitUntil(console.log(cookies));

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

			// Update addon field (XOOOOOOOOO)
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

			let flow = '';
			let current = '1';
			const index = {};

			while (map[current]) {
				const i = index[current] || 0;
				if (i >= map[current].beat.length) break;
				
				const token = map[current].beat[i];
				index[current] = i + 1;
				flow += token;
				
				if (token.startsWith('___')) current = token.slice(3);
			}

			const r1 = map['1'];
			const merge = {};

			if (r1.time) merge.time = r1.time;
			if (r1.hash) merge.hash = r1.hash;
			merge.device = r1.device;
			merge.referrer = r1.referrer;
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

			body = JSON.stringify(merge);

			if (ARCHIVING.AI && env.fullscore) {
				const messages = [{
					role: 'system',
					content: `You are a web analytics expert specializing in user behavior pattern recognition, and your task is to convert NDJSON data into precise natural-language analysis.
					You must understand the structure of the EXAMPLE and then perform the TASK in the exact order given.

					----------

					### EXAMPLE

					Input = {"device":1,"referrer":5,"scrolls":56,"clicks":15,"duration":18728,"beat":"!home~237*nav-2~1908*nav-3~375/123*help~1128*more-1~43!prod~1034*button-12~1050*p1___2!p1~2403*img-1~1194*buy-1~13/8/8*buy-1-up~532*review~14!review~2018*nav-1___1~6590*mycart___3!cart"}

					Output =
					[CONTEXT] Mobile user, mapped(5) visit, 56 scrolls, 15 clicks, 1872.8 seconds
					[TIMELINE] The user landed on the homepage and clicked navigation after 23.7 seconds, then spent 190.8 seconds browsing before clicking another menu. In the help section, repetitive clicks at 37.5 and 12.3 second intervals revealed hesitation. After 112.8 seconds, the user clicked *more-1 and 4.3 seconds later moved to !prod. After 103.4 seconds, the user clicked *button-12, then after 105.0 seconds clicked *p1 and switched to the second tab. In the second tab, the user spent 240.3 seconds browsing product images and clicked *img-1. After another 119.4 seconds, the user pressed *buy-1 and quickly tapped *buy-1-up three times at 1.3, 0.8, and 0.8 second intervals, likely adjusting quantity or options. The user stayed for 53.2 seconds before opening *review and 1.4 seconds later moved to the !review page. After 201.8 seconds, the user clicked *nav-1 to return to the first tab. After 659.0 seconds on the first tab, the user opened *mycart in a third tab.
					[PATTERN] Confused behavior. Repeated help clicks, multiple buy button taps, and stopping at cart without buying show UX problems and user difficulty.
					[ISSUE] The user reached the cart but did not complete a purchase. Extended pauses and cross-tab navigation suggest uncertainty or friction near the decision point.
					[ACTION] Simplify checkout and surface key product differences on the product page to reduce tab switching. Add inline guidance near hesitation points like *help and *review.

					----------

					### TASK

					Produce exactly five lines in this order: [CONTEXT], [TIMELINE], [PATTERN], [ISSUE], [ACTION].
					Do not include any extra text and do not quote the input.

					---

					## 1. CONTEXT
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
					  All time-related numbers in NDJSON are based on 0.1-second units, so divide the input value by 10 to display in 1-second units.
					  (e.g., 2579 → 257.9 seconds)

					---

					## 2. TIMELINE
					The beat string lists user actions in chronological order. Follow these 6 rules precisely and write without arbitrary assumptions.

					- The beat syntax is as follows.
					  ! = page
					  * = element
					  ~ = time interval from the previous event to selecting the next event
					  / = time interval when repeatedly selecting the same event
					  ___N = tab switch
					  (e.g., !home, !product-01, !x3n, !ds9df, *7div1, *6p4, *button, ~13, ~431/6/12, ~64/83, ___2, ___1, ___3)

					- All time-related numbers in NDJSON are based on 0.1-second units, so divide the input value by 10 to display in 1-second units.
					  (e.g., '~237' → 23.7 seconds, '~13/8/8' → 1.3 seconds, 0.8 seconds, 0.8 seconds)

					- The beat always starts with '!' (page), and it's likely to begin with !home.

					- '/' shows time intervals when the same element is selected repeatedly. For example, ~13/8/8*button means ~13*button~8*button~8*button.

					- Beat syntax should be interpreted in two group units to understand the entire flow and write effectively.
					  The small group is from '!' (page) until the next '!' (page) appears.
					  The large group is from '___N' (tab switch) until the next '___N' (tab switch) appears.

					- Time interval notations like '~' or '/' that appear immediately after '___N' (tab switch) include the elapsed time while being away from that tab. That's why time elapsed descriptions are mandatory, as shown in the EXAMPLE.

					---

					## 3. PATTERN
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

					## 4. ISSUE
					Write in one line the conversion inhibitors or causes of metric distortion identified from the PATTERN.

					---

					## 5. ACTION
					Suggest one specific measure to resolve the ISSUE.`
				}, {
					role: 'user',
					content: body
				}];
				
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
	const score = [...raw.slice(0, sep).split('_'), raw.slice(sep)];
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

	// MachineGun - 200ms or less, 10+ consecutive
	const t1 = data.beat.match(/~(\d+)/g);
	if (t1 && t1.length >= 10) for (let i = 0, r = 0; i < t1.length; i++)
		if ((r = +t1[i].slice(1) <= 2 ? r + 1 : 0) >= 10) return `MachineGun:${r}`;

	// Metronome - same interval 8+ times
	const m = data.beat.match(/[.~](\d+)([.~]\1){7,}/);
	if (m) return `Metronome:${m[1]}`;

	// NoVariance - standard deviation < 2, need 4+ data points
	const t2 = data.beat.match(/~(\d+)/g);
	if (t2 && t2.length >= 4) {
		const n = t2.map(t => +t.slice(1)), a = n.reduce((x, y) => x + y) / n.length;
		const d = Math.sqrt(n.reduce((s, x) => s + (x - a) ** 2, 0) / n.length);
		if (d < 2 && a > 10) return `NoVariance:${d.toFixed(1)}`;
	}

	// Arithmetic - constant interval increase/decrease, 4+ points
	const t3 = data.beat.match(/~(\d+)/g);
	if (t3 && t3.length >= 4) {
		const n = t3.map(t => +t.slice(1)), d = n[1] - n[0];
		if (d && n.every((x, i) => !i || x - n[i - 1] === d)) return `Arithmetic:${d > 0 ? '+' : ''}${d}`;
	}

	// Geometric - constant multiplication ratio, 4+ points
	const t4 = data.beat.match(/~(\d+)/g);
	if (t4 && t4.length >= 4) {
		const n = t4.map(t => +t.slice(1));
		if (n[0] > 0 && n[1] > 0 && n[1] / n[0] !== 1) {
			const r = n[1] / n[0];
			if (n.every((x, i) => !i || (n[i - 1] > 0 && Math.abs(x / n[i - 1] - r) < 0.01))) return `Geometric:x${r.toFixed(1)}`;
		}
	}

	// PingPong - A-B-A-B page bounce, 3+ cycles (6 pages total)
	const p = data.beat.match(/!([^~*!]+)!([^~*!]+)(?:!\1!\2)+/);
	if (p && p[0].split('!').filter(Boolean).length >= 6) return `PingPong:${p[1]}-${p[2]}`;

	// Surface - DOM depth ≤2 is 90%+, need 10+ clicks
	const dep = data.beat.match(/\*(\d+)/g);
	if (dep && dep.length >= 10) {
		const sh = dep.filter(d => +d.slice(1) <= 2).length;
		if (sh / dep.length > 0.9) return `Surface:${sh}/${dep.length}`;
	}

	// Monotonous - diversity < 15%, need 20+ clicks
	const cl = data.beat.match(/\*[^!~]+/g);
	if (cl && cl.length >= 20) {
		const ty = new Set(cl).size;
		if (ty / cl.length < 0.15) return `Monotonous:${ty}t`;
	}

	return null;
}

// Listens for the RHYTHM of human BEAT (default: false)
function humanPattern(data) {

	// Use first digit of addon field (XOXXXXXXXX)
	// 🚨 Important: this implementation is an example
	// If *buy button clicked with 3+ time compression patterns (~30.50.20*buy), addon field changes to 100
	// addon-based behavior should be implemented client-side, help message can be displayed
	if (/~[^*]*\.[^*]*\.[^*]*\*buy/.test(data.beat)) return 1;

	if (false) return 2; // Use second digit of addon field (XXOXXXXXXX)
	if (false) return 3; // Use third digit of addon field (XXXOXXXXXX)
	if (false) return 4; // Use third digit of addon field (XXXXOXXXXX)
	if (false) return 5; // Use third digit of addon field (XXXXXOXXXX)
	if (false) return 6; // Use third digit of addon field (XXXXXXOXXX)
	if (false) return 7; // Use third digit of addon field (XXXXXXXOXX)
	if (false) return 8; // Use third digit of addon field (XXXXXXXXOX)
	if (false) return 9; // Use third digit of addon field (XXXXXXXXXO)
	return null;
}
