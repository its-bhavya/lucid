import FINANCE_TERMS from "../data/financeTerms";
import FinanceTerm from "../components/FinanceTerm";

// Build a sorted list of terms (longest first to avoid partial matches)
const SORTED_TERMS = Object.keys(FINANCE_TERMS).sort((a, b) => b.length - a.length);

// Build a single regex that matches any known term (case-insensitive)
const PATTERN = new RegExp(
  `(${SORTED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "gi"
);

/**
 * Takes a plain text string and returns JSX with known finance terms
 * auto-wrapped in <FinanceTerm> components.
 */
export default function wrapFinanceTerms(text) {
  if (!text || typeof text !== "string") return text;

  const parts = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  PATTERN.lastIndex = 0;

  // Track which terms we've already wrapped to avoid duplicate tooltips
  const wrapped = new Set();

  while ((match = PATTERN.exec(text)) !== null) {
    const matchedText = match[0];
    const matchStart = match.index;

    // Only wrap first occurrence of each term
    const termKey = matchedText.toLowerCase();
    if (wrapped.has(termKey)) {
      continue;
    }
    wrapped.add(termKey);

    // Add text before this match
    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    // Find the canonical term name for dictionary lookup
    const canonical = SORTED_TERMS.find((t) => t.toLowerCase() === termKey) || matchedText;

    parts.push(
      <FinanceTerm key={matchStart} term={matchedText} definition={FINANCE_TERMS[canonical]} />
    );

    lastIndex = matchStart + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
