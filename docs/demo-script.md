# Demo script (single source for the video, the Playwright demo test, and the "2 am Friday" check)

Target length 2:30, hard cap 2:45 (the rules require under 3:00). Audio: own voice or silent with captions; no music unless original or licensed. Chrome or Edge for the voice take; if voice is unavailable, type the same phrase (every voice line has a typed fallback). Start state: `TEND_CLOCK=sim`, clock Fri 08:02, seeded synthetic data (see the Build contract in `docs/plans/PLAN.md`). The time chip is always visible; it adds "(skipped +X)" after a skip. The footer "Demo, not a medical device. Synthetic data." is visible in every on-screen UI shot (not in the terminal and repo shots).

| Time | Shot | Clock chip | What is on screen | Voice-over (plain, no hype) |
|---|---|---|---|---|
| 0:00-0:20 | Honest framing | Demo time 8:02 AM | `?view=demo`, top bar "Tend / Simulated Alexa+ demo", heading "Simulated Alexa+ display" | "Tend is a real MCP server for care coordination over Streamable HTTP, using the spec version recorded in the T0 check. Live Alexa+ access isn't available to hackathon participants, so the Alexa+ display and the router are simulated and labeled. The server, the state and the escalation logic are real." |
| 0:20-0:40 | Ask by voice | Demo time 8:02 AM | Say or type "What's due?"; Alexa line plus the Morning tablet card | "The display calls the MCP server through a client. The morning tablet is due now." |
| 0:40-1:05 | Skip and the miss | Demo time 9:02 AM (skipped +1 h) | Press "+1 hour". The panel turns Overdue; the spoken line plays: "It is 9:02. The 8:00 morning tablet is not logged yet." | "I'm skipping the clock so you don't wait an hour. The server applies its miss rule: 60 minutes of grace, then one escalation." |
| 1:05-1:30 | Caregiver side | Demo time 9:02 AM (skipped +1 h) | Status line, new alert, week strip (Fri AM Missed), rail with the clock-skipped marker | "Exactly one escalation per slot, enforced by a database key, so retries or polling can't send two. The message is a template; the template cannot add dosing text." |
| 1:30-1:55 | Late dose resolves | Demo time 9:17 AM (skipped +1 h 15 min) | Press "+15 min". Say or type "I took my morning pills". Follow-up line "Logged at 9:17 AM." No second notification | "The late dose resolves the alert instead of sending another." |
| 1:55-2:15 | The server is real | (terminal) | `npm run conformance`: the MCP Inspector connects, lists the 8 tools and calls each | "A standard MCP client, the Inspector, connects, lists the eight tools and calls them." |
| 2:15-2:30 | Close | (any) | Repo URL and MIT license on screen | "The product runs fully offline with no paid services. Source is MIT-licensed." |

Checks: no real names, drugs or accounts on screen; every on-screen "Alexa+" is labeled simulated; the script uses only controls that exist in the tray (+15 min, +1 hour, Next dose, Reset); reset then replay reproduces the same state.
