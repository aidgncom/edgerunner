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

const STREAMING = {
	DEBUG: false,	// Debug mode shows live streaming logs every RHYTHM (default: false)
	BOT: true,		// Listens for the RHYTHM of bot BEAT (default: true)
	HUMAN: false,	// Listens for the RHYTHM of human BEAT (default: false)
};

const ARCHIVING = {
	AI: false,		// Enable AI insights of archived BEAT logs (default: false)
	MODEL: '@cf/mistral/mistral-7b-instruct-v0.1'	// Default AI model
};

export default { // Start Edge Runner
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const cookies = request.headers.get("Cookie") || "";
		
		// Debug mode shows live streaming logs every RHYTHM (default: false)
		if (STREAMING.DEBUG) ctx.waitUntil(console.log(cookies));

		// Live streaming handler
		if (url.pathname === "/rhythm/" && url.searchParams.has("livestreaming")) {
			const match = scan(cookies); // Score cookie: field_time_key___tabs
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
			const body = await request.text();

			// AI insights is optional, but best practice is to log-push raw data to Cloud Storage
			// and aggregate daily for bulk analysis with BigQuery or similar
			if (ARCHIVING.AI && env.AI) {
				const messages = [{
					role: 'system',
					content: `You are analyzing user journey data using BEAT (Behavior Encoding And Tracking) notation.
						
						CONTEXT: This is ONE PERSON's COMPLETE JOURNEY on the website.
						- Each rhythm_N represents a different browser tab
						- All tabs belong to the same person's single visit
						- ___N at end of BEAT means user switched from current tab to tab N
						- Data includes everything from first click to last action before leaving
						
						BEAT Grammar:
						! = Page transition
							!home = homepage (reserved for root /)
							!product, !checkout = mapped readable names
							!x3n4k = hashed URL (unmapped page)
							!.x3n4k = dot prefix avoids hash collision
						
						* = Element interaction  
							*buy, *nav-1 = mapped readable names
							*3div2 = unmapped (3=depth, div=tag, 2=position)
						
						~ = Time gap (unit: 100ms default)
							~30 = 3 seconds
							~1200 = 2 minutes
						
						. = Repetition compression
							~50.240.50*3div2 = repeated pattern (5s→24s→5s)
						
						Example interpretation:
						!home~30*3div2~120!product~50*buy___2
						= homepage → wait 3sec → click element → wait 12sec → product page → wait 5sec → buy button → switch to tab 2
						
						Metadata: echo_time_key_device_referrer_scrolls_clicks_duration_BEAT
						Echo: 0=active, 1=crashed, 2=completed
						Time: session start time (100ms units)
						Key: unique session identifier
						Device: 0=desktop, 1=mobile, 2=tablet
						Referrer: 0=direct, 1=internal, 2=unknown, 3+=specific domains
						Scrolls: scroll event count
						Clicks: click event count
						Duration: session duration (100ms units)`
				}, {
					role: 'user',
					content: `Analyze this user's complete journey: ${body}
						Structure your response as:
						JOURNEY: Brief chronological flow (2-3 sentences)
						PATTERN: Key behavioral pattern identified
						ISSUE: Main problem or abandonment reason
						ACTION: One specific improvement recommendation`
				}];
				const aiResponse = await env.AI.run(ARCHIVING.MODEL, {messages});
				console.log('♪', body + '\n' + aiResponse.response);
			} else {
				console.log('♪', body);
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

	// Use second digit of addon field (XXOXXXXXXX)
	if (false) return 2;

	// Use third digit of addon field (XXXOXXXXXX)
	if (false) return 3;

	// Use third digit of addon field (XXXXOXXXXX)
	if (false) return 4;

	// Use third digit of addon field (XXXXXOXXXX)
	if (false) return 5;

	// Use third digit of addon field (XXXXXXOXXX)
	if (false) return 6;

	// Use third digit of addon field (XXXXXXXOXX)
	if (false) return 7;

	// Use third digit of addon field (XXXXXXXXOX)
	if (false) return 8;

	// Use third digit of addon field (XXXXXXXXXO)
	if (false) return 9;

	return null;
}