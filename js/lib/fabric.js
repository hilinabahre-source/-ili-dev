/* ============================================================
   FABRIC ESTIMATE FROM THE CUTTING LAYOUT
   For patterns with a `fabricLayout`: the length of fabric the real layout uses, plus cutting
   allowances, rounded up to the next 10 cm. Pieces cut on the fold go one per fold with the
   selvages folded to the centre when both fit across the width; otherwise both go one after the
   other on a single lengthwise fold. Bias strips are cut from a single-layer section at the end.
   ============================================================ */

const IN_CM = 2.54;

export function fabricEstimate(p, hipCm, bustCm) {
  const L = p.fabricLayout;
  const hipIn = hipCm != null ? hipCm / IN_CM : L.refHipIn;
  const bustIn = bustCm != null ? bustCm / IN_CM : L.refBustIn;
  // Each half piece is widest at the hem corner or at the underarm; both grow by a quarter of the girth.
  const halfIn = Math.max(L.widestHalfRefIn + (hipIn - L.refHipIn) / 4, L.underarmHalfRefIn + (bustIn - L.refBustIn) / 4);
  const perFold = L.widthIn / 4 - L.selvageIn;           // selvages folded to meet in the centre
  const twoFolds = halfIn <= perFold;
  const piecesIn = twoFolds ? L.pieceLengthIn : 2 * L.pieceLengthIn + L.gapIn;
  // A strip cut at 45° takes (length + width) / √2 of the fabric's length; strips sit side by side.
  const biasIn = (L.bias.lengthIn + L.bias.widthIn) / Math.SQRT2;
  const allowIn = 2 * L.endsIn + L.gapIn;                // straighten both ends; gap before the strips
  const totalIn = piecesIn + biasIn + allowIn;
  return {
    metres: Math.ceil(totalIn * IN_CM / 10) / 10,
    twoFolds, halfIn, perFold, piecesIn, biasIn, allowIn, totalIn,
    maxHipTwoFoldsIn: L.refHipIn + (perFold - L.widestHalfRefIn) * 4,
    maxBustTwoFoldsIn: L.refBustIn + (perFold - L.underarmHalfRefIn) * 4
  };
}
