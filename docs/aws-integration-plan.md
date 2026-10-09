# AWS integration plan: Amazon Bedrock (NOT IMPLEMENTED)

> **Status: not built.** Today Tend uses no AWS service, and the Devpost form answer is "No / N/A".
> Do not paste anything from section 5 into Devpost until every box in section 4 is ticked and the code is merged to `main`.

## 1. What it would be
Opt-in, model-assisted **schedule understanding** through Amazon Bedrock. The deterministic parser stays the default and the safety net; Bedrock only widens what the user can say ("take the white one with breakfast and the other after dinner, weekdays only") and always returns a *proposal*, never a saved schedule.

| AWS service | Used for | Why this and not something else |
|---|---|---|
| Amazon Bedrock Runtime, `Converse` API (a Claude Haiku model through an inference profile) | Turn free text into the same `{name, time, days}` proposal the parser produces | One call, structured output, no servers to run |
| (optional, if time) Bedrock Guardrails | Second layer on top of our own word list for any text a model produced | Defence in depth; our guardrail remains the authority |
| AWS Budgets (cost control, not a feature) | Alert and hard cap so a bug can't run up a bill | Budgets alerts lag, so the real cap is in code |

## 2. Design (what changes in the code)
- `src/shared/bedrock.ts`: `converse(prompt)` with an 8 s total budget, `maxAttempts: 2`, JSON extraction and typed errors (timeout, throttled, malformed, refusal). Region and model/profile ID come from env vars; nothing is hard-coded.
- `src/server/parser.ts`: `parseSchedule(text, { llm })`. Order: deterministic parser first; if it fails to understand and `TEND_LLM=bedrock`, ask Bedrock; **validate the model's JSON with the same Zod schema and the same `validateItemName` guardrail**; show the proposal for confirmation as today. Any error falls back to the plain "I didn't understand" result.
- Call caps in code: `LLM_MAX_CALLS_PER_DAY` (default 100) and per session; over the cap the deterministic result is returned.
- The model never sees or returns anything that is stored without confirmation. Medication names stay user input and are never echoed unchecked.
- No dosing, no advice: the system prompt forbids it and the guardrail enforces it regardless.
- Default run path stays **no credentials needed**; judges can run the project without AWS.

## 3. Tests to add (so the claim is checkable)
- Unit tests with a stubbed Bedrock client: success, timeout, 429, malformed JSON, refusal, banned word in the model output, over the call cap.
- A poisoned-input test ("ignore previous instructions ...") through the model path.
- Golden set: the existing 10 parser cases plus 5 free-form cases, run on the deterministic path always and on Bedrock only when `TEND_LLM=bedrock`.
- README section: setup, IAM policy (least privilege: `bedrock:InvokeModel` on one model), cost estimate, how to turn it off.

## 4. Gate: tick every box before claiming it
- [ ] AWS account exists, Bedrock model access granted in the chosen region, one real `Converse` call succeeds (output pasted in `docs/aws-evidence.md`)
- [ ] An AWS Budgets alert is set (amount decided by the owner)
- [ ] `src/shared/bedrock.ts` and the parser change are on `main`, CI green
- [ ] Stub tests above pass; a real-Bedrock run of the golden set is recorded
- [ ] README documents the integration and how to disable it
- [ ] The demo video shows it (a new shot) or the write-up says it is not in the video
- [ ] The Devpost dropdown is switched to Yes and the N/A text is replaced by section 5

## 5. Devpost write-up DRAFT (valid only after section 4 is complete)

> **AWS services used:** Amazon Bedrock Runtime (the `Converse` API with a Claude Haiku model through an inference profile).
>
> **How:** Tend's schedule parser is deterministic by default. When the owner turns on `TEND_LLM=bedrock`, free-form requests the parser cannot understand are sent to Bedrock, which returns a structured schedule *proposal*. That output is validated with the same Zod schema and the same safety guardrail as the deterministic path, shown to the user for confirmation, and never saved without it. Any Bedrock error (timeout, throttling, malformed output, refusal) falls back to the deterministic result. A per-day and per-session call cap in code, an 8 second total budget, and an AWS Budgets alert bound the cost. The integration is documented in the README (`TEND_LLM`, IAM policy with `bedrock:InvokeModel` on one model, region and model ID variables) and covered by stubbed tests plus a recorded real-Bedrock run of the golden set (`docs/aws-evidence.md`). Tend keeps working with no AWS account at all.

## 6. Cost and effort (honest)
- Needs an AWS account with a payment method and Bedrock model access; the owner decides the budget. Development and one demo recording should be a few US dollars at most; there is no AWS free tier for Bedrock inference.
- Effort once the account exists: about half a day to build and test, plus a short extra video shot.
