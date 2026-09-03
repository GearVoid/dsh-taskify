export function normalizeDisplayWhitespace(value) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
}

export function anchorProvenanceForDisplay(anchor) {
  const evidence = typeof anchor?.evidence === 'string' ? anchor.evidence : ''
  if (
    normalizeDisplayWhitespace(evidence) === ''
    || normalizeDisplayWhitespace(anchor?.text) === normalizeDisplayWhitespace(evidence)
  ) return null

  return {
    title: '来自你的原话',
    evidence,
  }
}
