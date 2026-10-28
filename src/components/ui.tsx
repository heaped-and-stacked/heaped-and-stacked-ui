import { Fragment, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { ApiError } from "@/api/client";

/**
 * The small set of building blocks every page is made of. Prefer these over
 * restyling raw elements, so the pixel look stays consistent.
 */

// ink: the usual primary button, in ink blue; pixel (green): the main action of a page.
const buttonVariants = {
  ink: "bg-blue text-card",
  pixel: "bg-pixel text-paper",
  paper: "bg-card text-ink",
  danger: "bg-danger text-paper",
} as const;

/**
 * Three sizes, so buttons that do the same kind of thing look the same on every page:
 * lg, a page's main action (SUBMIT SET, SAVE CHANGES); md, actions in a toolbar or the workout bar
 * (+ NEW MUSCLE, + NEW EXERCISE, START TRAINING); sm, actions on a row or in a side panel (EDIT,
 * TRY IT, BENCH, ACCEPT).
 */
const buttonSizes = {
  lg: "px-5 py-3 text-[10px]",
  md: "px-4 py-2.5 text-[9px]",
  sm: "shrink-0 px-3 py-2 text-[9px]",
} as const;

export type ButtonSize = keyof typeof buttonSizes;

export const buttonClass = (
  variant: keyof typeof buttonVariants = "ink",
  size: ButtonSize = "lg",
) =>
  `pixel-shadow-sm inline-flex items-center justify-center gap-2 border-2 border-line font-display leading-none transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50 ${buttonSizes[size]} ${buttonVariants[variant]}`;

export function Button({
  variant = "ink",
  size = "lg",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: ButtonSize;
}) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pixel-shadow border-2 border-line bg-card p-6 max-sm:p-4 ${className}`}>
      {children}
    </div>
  );
}

/** A big number with a short label under it, on a card: the rows of numbers (Past Workouts, Front Desk). */
export function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Card>
      <p className={`font-display text-2xl ${color}`}>{value}</p>
      <p className="mt-3 text-xs font-semibold text-faded">{label}</p>
    </Card>
  );
}

/**
 * Form fields are the soft part of the design: a thin, quiet border, slightly rounded corners
 * and a green focus ring, so typing feels calm. (Cards and buttons stay square and bold.)
 */
export const fieldFrameClass =
  "border border-ink/20 bg-paper transition-colors hover:border-ink/35 focus-within:border-pixel focus-within:ring-2 focus-within:ring-pixel/25";

export const inputClass = `mt-2 w-full ${fieldFrameClass} px-3 py-2.5 text-xs text-ink outline-none placeholder:text-ink/35`;

/** A labelled form field. `hint` is a short line under the input. */
export function Field({
  label,
  hint,
  optional = false,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="mt-5 block">
      <span className="font-display text-[9px] text-ink/70">
        {label}
        {optional && <span className="ml-2 font-body text-[10px] text-faded">(optional)</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-faded">{hint}</span>}
    </label>
  );
}

const badgeColors = {
  pixel: "bg-pixel text-paper",
  blue: "bg-blue-tint text-blue",
  amber: "bg-amber text-on-amber",
  muted: "bg-muted text-faded",
  ink: "bg-ink text-paper",
} as const;

export function Badge({
  color,
  children,
}: {
  color: keyof typeof badgeColors;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block border-2 border-line px-2 py-1 font-display text-[8px] leading-none ${badgeColors[color]}`}
    >
      {children}
    </span>
  );
}

/**
 * The brand mark: a barbell whose weights are code braces, {—}, drawn on a 16-pixel grid.
 * The braces take the accent colour and the bar the text colour, so it follows the theme.
 * Size it with `className` (e.g. "size-10"); decorative unless given a `title`.
 */
export function Logo({ className = "size-10", title }: { className?: string; title?: string }) {
  const brace = (x: number, mirror: boolean) => {
    // One brace, as pixel rows: [column offset, y, width, height]; mirrored for the right one.
    const rows: [number, number, number, number][] = [
      [2, 2, 2, 1],
      [1, 3, 1, 4],
      [0, 7, 1, 2],
      [1, 9, 1, 4],
      [2, 13, 2, 1],
    ];
    return rows.map(([dx, y, width, height]) => (
      <rect
        key={`${x}-${y}`}
        x={mirror ? x - dx - width + 1 : x + dx}
        y={y}
        width={width}
        height={height}
        className="fill-pixel"
      />
    ));
  };

  return (
    <svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {brace(2, false)}
      <rect x="4" y="7" width="8" height="2" className="fill-ink" />
      {brace(13, true)}
    </svg>
  );
}

/** "$ some --command" line with a blinking cursor, used above page headings. */
export function Prompt({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold text-faded">
      <span className="text-pixel">$</span> {children}
      <span className="animate-pixel-blink ml-1 inline-block h-3 w-2 bg-pixel align-middle" />
    </p>
  );
}

export function PageHeading({
  prompt,
  title,
  children,
}: {
  prompt: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header>
      <Prompt>{prompt}</Prompt>
      <h1 className="mt-6 font-display text-xl leading-relaxed md:text-2xl md:leading-relaxed">
        {title}
      </h1>
      {children && (
        <p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-ink/70">{children}</p>
      )}
    </header>
  );
}

/**
 * An error in a red box. When the API itself failed (5xx), its request id follows as "ref …": a
 * user who reports the problem can quote it, and it finds the matching log lines.
 */
export function ErrorMessage({ error }: { error: Error | null }) {
  if (!error) return null;
  const reference = error instanceof ApiError && error.status >= 500 ? error.requestId : null;
  return (
    <p
      role="alert"
      className="mt-4 border-2 border-danger bg-danger/10 px-3 py-2 text-xs font-semibold text-danger"
    >
      ! {error.message}
      {reference && <span className="ml-2 font-medium opacity-80">(ref {reference})</span>}
    </p>
  );
}

/** Rows per page in every paged list. */
export const PAGE_SIZE = 20;

/**
 * Under a long list: PREV / NEXT on the left, then "page X of Y". `page` counts from 0; nothing
 * shows while the list fits on one page. `label` names the list for screen readers, e.g.
 * "Pages of members".
 */
export function Pager({
  label,
  page,
  totalPages,
  onPage,
}: {
  label: string;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-3">
      <Button variant="paper" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        <span aria-hidden>◀</span> PREV
      </Button>
      <Button
        variant="paper"
        size="sm"
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
      >
        NEXT <span aria-hidden>▶</span>
      </Button>
      <span role="status" className="text-xs font-semibold text-faded">
        page <span className="text-ink">{page + 1}</span> of {totalPages}
      </span>
    </nav>
  );
}

export function Loading({ what = "loading" }: { what?: string }) {
  return <Prompt>{what}...</Prompt>;
}

/** The user's GitHub avatar, or their initial in a pixel box when there's no picture. */
export function Avatar({
  url,
  name,
  className = "size-8",
}: {
  url: string | null;
  name: string | null;
  className?: string;
}) {
  if (url) {
    return <img src={url} alt="" className={`pixelated border-2 border-line ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`grid place-items-center border-2 border-line bg-amber font-display text-[10px] text-on-amber ${className}`}
    >
      {(name ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Long text written by authors and athletes: keeps line breaks, and styles code the markdown
 * way. A line starting with ``` opens a code block (an optional language after the backticks
 * becomes its label) and the next ``` line closes it; `backticks` mark inline code, and
 * **double asterisks** bold (which may contain inline code).
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`grid gap-3 text-xs leading-relaxed break-words ${className}`}>
      {splitCodeBlocks(text).map((part, index) =>
        part.kind === "code" ? (
          <figure
            key={index}
            className="pixel-shadow-sm border-2 border-line bg-code text-code-ink"
          >
            {part.language && (
              <figcaption className="border-b-2 border-code-ink/15 px-3 py-1.5 font-display text-[8px] text-code-ink/60">
                {part.language.toUpperCase()}
              </figcaption>
            )}
            <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed">
              <code>{HIGHLIGHTERS[part.language.toLowerCase()]?.(part.text) ?? part.text}</code>
            </pre>
          </figure>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {/* Inline code is matched first at each position, so ** inside `code` stays as is. */}
            {part.text.split(/(`[^`\n]+`|\*\*[^\n]+?\*\*)/).map((piece, pieceIndex) =>
              /^\*\*[^\n]+\*\*$/.test(piece) ? (
                <strong key={pieceIndex} className="font-bold">
                  {withInlineCode(piece.slice(2, -2))}
                </strong>
              ) : (
                withInlineCode(piece, pieceIndex)
              ),
            )}
          </p>
        ),
      )}
    </div>
  );
}

/** Code block languages that get syntax colours; any other language shows as plain text. */
const HIGHLIGHTERS: Record<string, (code: string) => ReactNode[]> = {
  java: highlightJava,
  sql: highlightSql,
};
export const HIGHLIGHTED_LANGUAGES = Object.keys(HIGHLIGHTERS);

const JAVA_KEYWORDS = new Set(
  (
    "abstract assert boolean break byte case catch char class const continue default do double " +
    "else enum extends final finally float for goto if implements import instanceof int interface " +
    "long native new package private protected public return short static strictfp super switch " +
    "synchronized this throw throws transient try void volatile while var record sealed permits " +
    "yield true false null"
  ).split(" "),
);

/**
 * One pass over Java source, longest constructs first: comments, text blocks, strings and chars,
 * annotations, numbers, then words (keywords, and method names before a "("). Everything else
 * stays plain. Colours follow IntelliJ's Darcula theme (the code-* tokens in styles.css).
 */
const JAVA_TOKEN =
  /(\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*)|("""[\s\S]*?(?:"""|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(@[A-Za-z_][\w.]*)|(\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[lLfFdD]?\b)|\b([A-Za-z_$][\w$]*)\b/g;

function highlightJava(code: string): ReactNode[] {
  return colourTokens(code, JAVA_TOKEN, ([, comment, string, annotation, number, word], after) => {
    if (comment) return "text-code-comment italic";
    if (string) return "text-code-string";
    if (annotation) return "text-code-annotation";
    if (number) return "text-code-number";
    if (word && JAVA_KEYWORDS.has(word)) return "text-code-keyword";
    if (word && /^\s*\(/.test(after)) return "text-code-method";
    return null;
  });
}

const SQL_KEYWORDS = new Set(
  (
    "select from where and or not in is null as on join left right inner outer full cross group by " +
    "order having limit offset fetch next rows only insert into values update set delete create " +
    "table index unique primary key foreign references check default constraint alter add drop " +
    "column distinct union all exists case when then else end begin commit rollback with recursive " +
    "over partition window asc desc between like returning conflict do nothing for skip locked " +
    "nowait true false using concurrently include view trigger function returns language execute " +
    "each row after before of extension exclude lateral filter interval cast nulls first last " +
    "explain analyze vacuum grant revoke policy enable level security transaction isolation read " +
    "committed repeatable serializable bigint int integer smallint numeric decimal text varchar " +
    "char timestamptz timestamp date time boolean uuid serial bigserial jsonb json generated always " +
    "identity tstzrange"
  ).split(" "),
);

/**
 * One pass over SQL, longest constructs first: comments, strings, named parameters (`:amount`,
 * not the `::` of a cast), numbers, then words (keywords in any case, and function names before
 * a "("). The same colours as Java.
 */
const SQL_TOKEN =
  /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:''|[^'])*'?)|((?<!:):[A-Za-z_]\w*)|(\b\d+(?:\.\d+)?\b)|\b([A-Za-z_]\w*)\b/g;

function highlightSql(code: string): ReactNode[] {
  return colourTokens(code, SQL_TOKEN, ([, comment, string, parameter, number, word], after) => {
    if (comment) return "text-code-comment italic";
    if (string) return "text-code-string";
    if (parameter) return "text-code-annotation";
    if (number) return "text-code-number";
    if (word && SQL_KEYWORDS.has(word.toLowerCase())) return "text-code-keyword";
    if (word && /^\s*\(/.test(after)) return "text-code-method";
    return null;
  });
}

/**
 * Splits code into coloured spans: each match of `token` gets the class `classify` picks for it
 * (given the match and the code after it), or stays plain text when it returns null.
 */
function colourTokens(
  code: string,
  token: RegExp,
  classify: (match: RegExpExecArray, after: string) => string | null,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(token)) {
    const [text] = match;
    const start = match.index;
    const className = classify(match, code.slice(start + text.length));
    if (!className) continue;
    if (start > last) nodes.push(code.slice(last, start));
    nodes.push(
      <span key={start} className={className}>
        {text}
      </span>,
    );
    last = start + text.length;
  }
  nodes.push(code.slice(last));
  return nodes;
}

/** `backticks` in a piece of text become inline code; web addresses outside them become links. */
function withInlineCode(text: string, key?: number): ReactNode {
  return (
    <Fragment key={key}>
      {text.split(/(`[^`\n]+`)/).map((piece, index) =>
        /^`[^`\n]+`$/.test(piece) ? (
          <code key={index} className="bg-muted px-1 py-0.5 font-semibold">
            {piece.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={index}>{withLinks(piece)}</Fragment>
        ),
      )}
    </Fragment>
  );
}

/** An http(s) address, without punctuation that ends the sentence around it. */
const WEB_ADDRESS = /(https?:\/\/[^\s<>`]*[^\s<>`.,;:!?)'"])/;

/**
 * Example addresses in exercises (reserved example domains, internal names, IP addresses) aren't
 * real pages, so they stay plain text.
 */
function isExampleAddress(address: string): boolean {
  const host = new URL(address).hostname;
  return (
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    /(^|\.)(example(\.(com|org|net))?|test|invalid|localhost|internal)$/.test(host)
  );
}

/** Web addresses in a piece of text become links that open in a new tab. */
export function withLinks(text: string): ReactNode[] {
  return text.split(WEB_ADDRESS).map((piece, index) =>
    index % 2 === 1 && !isExampleAddress(piece) ? (
      <a
        key={index}
        href={piece}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-blue underline decoration-blue/40 underline-offset-2 hover:decoration-blue"
      >
        {piece}
      </a>
    ) : (
      piece
    ),
  );
}

type TextPart = { kind: "text"; text: string } | { kind: "code"; text: string; language: string };

/** The code blocks of a text written for RichText, without their ``` lines. */
export function codeBlocksOf(text: string): string[] {
  return splitCodeBlocks(text)
    .filter((part) => part.kind === "code")
    .map((part) => part.text);
}

/** An unclosed block runs to the end, the way markdown renders it. */
function splitCodeBlocks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lines: string[] = [];
  let code: { language: string } | null = null;

  const flush = () => {
    const joined = lines.join("\n");
    if (code) parts.push({ kind: "code", text: joined, language: code.language });
    else if (joined.trim() !== "") parts.push({ kind: "text", text: joined.trim() });
    lines = [];
  };

  for (const line of text.split("\n")) {
    const fence = line.trim().match(/^```\s*([\w+#.-]*)/);
    if (fence) {
      flush();
      code = code ? null : { language: fence[1] ?? "" };
    } else {
      lines.push(line);
    }
  }
  flush();
  return parts;
}

/**
 * For textareas that hold code: Tab inserts two spaces instead of leaving the field. Keyboard
 * users can always leave it, as in code editors: Esc, then Tab moves on; Shift+Tab moves back.
 */
export function indentOnTab(
  event: KeyboardEvent<HTMLTextAreaElement>,
  onChange: (value: string) => void,
) {
  const field = event.currentTarget;
  if (event.key === "Escape") {
    field.dataset.tabMovesOn = "true";
    return;
  }
  // Only the key right after Esc counts: anything else and Tab indents again.
  const movesOn = field.dataset.tabMovesOn === "true";
  delete field.dataset.tabMovesOn;
  if (event.key !== "Tab" || event.shiftKey || field.readOnly || movesOn) return;
  event.preventDefault();
  const { selectionStart, selectionEnd, value } = field;
  onChange(value.slice(0, selectionStart) + "  " + value.slice(selectionEnd));
  // Put the cursor after the inserted spaces once React has re-rendered the value.
  requestAnimationFrame(() => field.setSelectionRange(selectionStart + 2, selectionStart + 2));
}
