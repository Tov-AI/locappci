# Working together on LOCAPPCI

Two people, one codebase. These rules keep us from overwriting each other's work and let either of us pick up where the other stopped.

## 1. One feature = one branch = one pull request

1. Pick the next feature in [docs/FEATURES.md](docs/FEATURES.md) and write your name next to it, so nobody else starts it.
2. Create a branch from `main`: `feature/<number>-<short-name>`, for example `feature/04-accueil`.
3. Commit small steps with clear messages: `feat(accueil): add product grid`, `fix(tabs): badge colour`.
4. Push the branch and open a pull request (PR) into `main`. Fill in the template.
5. The other person tests it on a simulator or phone and approves. Then merge.

Never commit straight to `main`.

## 2. The test loop

Build → test → explain the problem → improve → test again.

When a test fails, write in the PR: the screen, what you tapped, what you expected, what happened, and a screenshot.

## 3. Handing over mid-feature

If you stop before a feature is finished:

1. Commit and push everything, even if it is not working yet. Start the commit message with `wip:`.
2. In the PR description, fill in **"Where I stopped"**: what works, what doesn't, what's next.
3. The other person checks out the same branch and continues. No need to start a new one.

## 4. Splitting the work

The app and the gateway (the small server between the app and WordPress) only meet at the **API contract** in `src/api/contract.ts` (arrives in feature 3).

- Person A builds app screens against mock data.
- Person B builds the gateway so it returns exactly what the contract describes.
- Changing the contract needs both people's approval in the PR.

## 5. Rules for the code

- Colours, fonts, spacing: import from `@/theme`. No hex codes in screens.
- Text: use `AppText`, never raw `<Text>`.
- All interface copy in French.
- Install packages with `npx expo install <package>`, never `npm install <package>`.
- `npm run typecheck` must pass before you open a PR.
- If you make a design or architecture decision, add one line to [docs/DECISIONS.md](docs/DECISIONS.md).
