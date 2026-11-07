# Design

An editor's calm with a gym's humour: programmer jokes, gym puns and pixel art, with few elements per
page, each one polished. The complete rules are in [CLAUDE.md](../CLAUDE.md); these are the ones to
know first.

## Themes and colours

Dark is the default, light the alternative. Colours are tokens in `src/styles.css`, named after their
role, with a value for each theme, so the same classes work in both. A new colour becomes a token;
components never use raw colour values.

| Token | Role |
| ----- | ---- |
| `paper`, `card`, `ink` | the page, a raised surface, the text |
| `line` | borders, dimmer than the text in both themes |
| `blue` | selected and clickable |
| `pixel` | progress, success and a page's main action |
| `amber` | waiting |
| `danger` | real problems only |
| `code` | code blocks, dark in both themes |

## Shape and type

- One corner radius everywhere. Cards, buttons, tabs and chips have 2px borders and offset shadows;
  form fields are the soft part, with thin borders and a focus ring.
- One font, JetBrains Mono. Its bold, spaced uppercase is for short headings, labels and buttons.
- Three button sizes: large for a page's main action, medium for toolbars, small for rows.

## Words

Buttons are uppercase verbs (EDIT, VERIFY). Links are lowercase and blue. Hints start with `//`, in
lowercase. Gym words stay in the app; the code that talks to the API uses the API's words.

## Accessibility

Text meets WCAG AA contrast (4.5:1) in both themes, everything works from the keyboard, and animations
respect reduced motion. A state is said in words, not only by dimming.

## Phones

Below 640 px, the top bar becomes two rows, the workout bar's muscles scroll sideways, and padding
tightens. Phone-only styles use Tailwind's `max-sm:` variant, so wider screens are unaffected.
