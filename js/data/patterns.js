/* ============================================================
   PATTERN DATA
   ============================================================ */
export let PATTERNS = [
  {
    // Made-to-measure: the PDF is generated from the customer's saved profile measurements
    // by the generate-pattern Edge Function (SeamScape parametric pattern).
    id:'aline-silk-dress', name:'SATC A-line Silk Dress', trend:'', difficulty:'Beginner', construction:'One Piece',
    time:'', fabric:'Medium weight duchess silk', image:'assets/images/aline-silk-dress.jpg', imagePosition:'50% 58%', emoji:'',
    // Reference body the pattern was drafted for (cm). Length is fixed at 39" (SeamScape version 9).
    base:{waist:68.07, hip:98.04, length:99.06},
    // Fabric estimate (js/lib/fabric.js) from the cutting layout in step 1: 53" fabric, selvages folded to the
    // centre, front and back each cut 1 on a fold, two bias strips from a single-layer end. Piece sizes measured
    // from version 9: every piece is 40.13" long when cut (½" allowances included, same at every size); each
    // half piece is widest at the hem corner, 10.74" from the fold at the 38.6" reference hip, or at the underarm,
    // 9.20" at the 33.9" reference bust; each grows by ¼ of the extra girth. Allowances: 1" at each end to
    // straighten the grain, 1" between sections.
    fabricLayout:{ widthIn:53, selvageIn:0.5, pieceLengthIn:40.13, widestHalfRefIn:10.74, refHipIn:38.6,
      underarmHalfRefIn:9.20, refBustIn:33.9,
      bias:{ lengthIn:22, widthIn:1.75 }, endsIn:1, gapIn:1 },
    personalized:{ patternId:'aline-silk-dress', papers:['A0','A4','Letter'] },
    // Seven-step guide for the unlined dress: French seams (shoulders, sides), baby hems (neckline, bottom),
    // narrow bias facing (armholes). Every finish uses the pattern's existing 1/2 in seam allowance.
    // Figures are drawn by js/lib/sewing-figures.js.
    steps:[
      {title:'Cut, mark and staystitch', diagram:'pin', tutorial:'cut-mark',
       text:'Download your pattern, print it at 100% and check the 2 in and 5 cm test squares before cutting.',
       details:[
         'Fold both selvages to the centre so the fabric has two folds. Place the front on one fold and the back on the other, and cut 1 of each. The ½ in seam allowance is already included on every edge except the folds.',
         'From the remaining single layer, cut 2 bias strips 1¾ in wide and 22 in long at 45° to the selvage, one for each armhole. Fold each in half lengthwise, wrong sides together, and press to ⅞ in without stretching.',
         'Mark the waist, hip and lower notches on both side seams, and the armhole notches (1 on the front, 2 on the back), with chalk or a small thread tack. If you clip, go no deeper than ⅛ in.',
         'The neckline notches (1 on the front, 2 on the back) belong to the lined version of this pattern and are not used here. Don’t clip them.',
         'Straight away, staystitch the neckline and both armholes ⅜ in from the cut edge, through a single layer, so the curved edges can’t stretch. On the neckline this line becomes the first row of the baby hem.'
       ],
       tips:['This guide is ILI’s unlined construction: French seams, bias-faced armholes and baby hems. The patternmaker’s own instructions are for a lined version of the dress.',
             'This pattern lists medium weight duchess silk. Lighter silks (crêpe de chine, charmeuse or habotai) give cleaner French seams and baby hems; duchess will feel firmer and a little bulkier at the seams.'],
       figures:[
         {id:'cutting-layout', caption:'Cutting layout: selvages folded to the centre, front and back each on a fold, two bias strips at 45°.'},
         {id:'mark-staystitch', caption:'Notches to mark, the unused neckline notches, and the ⅜ in staystitching on the neckline and armholes.'},
         {id:'bias-strips', caption:'Bias strips: cut 1¾ in on the true bias, fold in half to ⅞ in and press.'}
       ]},
      {title:'Sew the shoulder straps (French seams)', diagram:'seam', tutorial:'french-shoulder',
       text:'Join each front strap to its back strap with a French seam, so no raw edges show inside.',
       details:[
         'Place the front and back strap tops together, wrong sides together, edges matching. Stitch ¼ in from the edge across the 1½ in strap.',
         'Trim the allowance to ⅛ in and press it to one side.',
         'Fold right sides together along the seam, press, and stitch ¼ in from the fold, enclosing the raw edges. Press toward the back.'
       ],
       tips:['¼ in + ¼ in uses the full ½ in seam allowance, so the strap stays exactly 1½ in wide.'],
       figures:[
         {id:'shoulder-overview', caption:'Front strap tops matched to the back strap tops, wrong sides together.'},
         {id:'french-shoulder-1', caption:'Pass 1: wrong sides together, stitch ¼ in from the edge.'},
         {id:'french-shoulder-2', caption:'Trim the allowance to ⅛ in.'},
         {id:'french-shoulder-3', caption:'Pass 2: right sides together, stitch ¼ in from the fold, raw edges enclosed.'}
       ]},
      {title:'Baby hem the neckline', diagram:'hem', tutorial:'neck-hem',
       text:'The neckline is one continuous edge: back, over a strap, front, over the other strap.',
       details:[
         'Your ⅜ in staystitching is the first row. Press the edge to the wrong side right along that stitching.',
         'Trim the folded allowance close to the stitching, leaving about ⅛ in.',
         'Roll the edge under once more by ⅛ in, so the fold sits exactly on the pattern’s stitching line, and stitch through all layers. Ease gently around the curves without stretching.',
         'At the centre-front and centre-back V points, clip into the allowance at the point, up to (not through) the staystitching. Hem one side right up to the point, then the other, and secure the point with three hand stitches.',
         'Where the hem crosses the strap seams, flatten the French seam allowance and press it toward the back before rolling.'
       ],
       tips:['The front V (109°) is sharper than the back V (130°); go slowly at the front point.'],
       figures:[
         {id:'neckline-overview', caption:'One continuous neckline edge, with V points at centre front and centre back.'},
         {id:'babyhem-neck-1', caption:'Stitch ⅜ in from the edge (your staystitching), then press the allowance under along it.'},
         {id:'babyhem-neck-2', caption:'Trim the folded allowance to about ⅛ in.'},
         {id:'babyhem-neck-3', caption:'Roll under ⅛ in and stitch: the finished edge lands on the pattern’s stitching line.'},
         {id:'v-point', caption:'At each V point: clip to the staystitching, hem each side up to the point, secure by hand.'}
       ]},
      {title:'Face the armholes with bias strips', diagram:'attach', tutorial:'arm-facing',
       text:'Finish each armhole, including the outer edge of the strap, with one folded bias strip. Do this while the dress is still flat, before the side seams.',
       details:[
         'Lay a folded strip on the right side of the armhole, raw edges together, starting ½ in beyond the back underarm. Stitch ½ in from the edge, over the strap and down to ½ in beyond the front underarm. Ease the strip around the curve; don’t stretch the dress.',
         'Trim the allowances to ¼ in. Around the underarm curve, clip every ¼–½ in, stopping ⅛ in short of the stitching.',
         'Press the strip and the allowances away from the dress, then understitch ⅛ in from the seam through the strip and allowances only.',
         'Turn the strip completely to the inside so the seam rolls just inside the edge, press, and stitch it down ⅜ in from the edge, or slipstitch by hand for an invisible finish.'
       ],
       tips:['Bias stretches to follow the tight underarm curve, where a baby hem would ripple. The finished facing is ⅜ in wide and sits entirely inside.'],
       figures:[
         {id:'armhole-overview', caption:'Each armhole is one edge from back underarm, over the strap, to front underarm.'},
         {id:'bias-1', caption:'Folded strip on the right side, raw edges together; stitch ½ in from the edge.'},
         {id:'bias-2', caption:'Trim the allowance to ¼ in and clip around the underarm curve.'},
         {id:'bias-3', caption:'Understitch the facing to the allowances, ⅛ in from the seam.'},
         {id:'bias-4', caption:'Turn the facing inside and stitch it down ⅜ in from the edge.'}
       ]},
      {title:'Sew the side seams (French seams)', diagram:'seam', tutorial:'french-side',
       text:'Join front and back down both sides, from the underarm to the hem.',
       details:[
         'Place front and back wrong sides together. Match the faced armhole edges exactly at the underarm, then the waist, hip and lower notches. Stitch ¼ in from the edge.',
         'Trim the allowance to ⅛ in. Trim the bias strip ends at an angle to reduce bulk at the underarm.',
         'Fold right sides together along the seam, press, and stitch ¼ in from the fold, enclosing all raw edges and the strip ends. Press toward the back.'
       ],
       figures:[
         {id:'side-overview', caption:'Wrong sides together, underarms and notches matched; pass 1 runs ¼ in from the edge.'},
         {id:'french-side-1', caption:'Pass 1: wrong sides together, stitch ¼ in.'},
         {id:'french-side-2', caption:'Trim the allowance to ⅛ in.'},
         {id:'french-side-3', caption:'Pass 2: right sides together, stitch ¼ in from the fold.'},
         {id:'underarm-junction', caption:'At the underarm the faced edges meet exactly; the strip ends are enclosed in the seam.'}
       ]},
      {title:'Baby hem the bottom', diagram:'hem', tutorial:'bottom-hem',
       text:'Hem front and back in one continuous round.',
       details:[
         'Stitch ⅜ in from the bottom edge all the way round and press the edge to the wrong side along the stitching.',
         'Trim the folded allowance close to the stitching, leaving about ⅛ in.',
         'Roll under once more by ⅛ in and stitch. Press the French side seams toward the back where the hem crosses them.',
         'The finished length is 39 in from the neck point.'
       ],
       figures:[
         {id:'hem-overview', caption:'The baby hem runs all round the bottom edge; finished length 39 in.'},
         {id:'babyhem-hem-1', caption:'Stitch ⅜ in from the edge and press the allowance under along it.'},
         {id:'babyhem-hem-2', caption:'Trim the folded allowance to about ⅛ in.'},
         {id:'babyhem-hem-3', caption:'Roll under ⅛ in and stitch through all layers.'}
       ]},
      {title:'Press and finish', diagram:'pin', tutorial:'press-finish',
       text:'Give the dress a final careful press.',
       details:[
         'Use the silk setting with a dry iron and a silk organza press cloth. Test on a scrap of the same fabric first: duchess silk can water-mark and shine.',
         'Press with a lifting motion rather than sliding the iron. French seams go toward the back; the armhole facings lie flat to the inside.'
       ],
       figures:[
         {id:'pressing', caption:'Silk setting, dry iron, organza press cloth.'},
         {id:'finished-dress', caption:'The finished dress and where each finish sits.'}
       ]}
    ]
  },
  {
    id:'pattern-2', name:'White Mini Skirt', trend:'Clean Girl', difficulty:'Beginner',
    time:'2-3 hrs', fabric:'Lightweight cotton, twill, or denim', image:'assets/images/9efbbe16addf710e619484c72c59090f.jpg', emoji:'', yardageBase:1,
    base:{waist:76,hip:99,length:28,crotchHeight:74},
    pieces:[
      {
        label:'Front', cut:'Cut 1 on fold', sideSA:0.375, hemSA:0.5, tileOverlap:0.5,
        topFold:{x:0,y:0}, topSide:{x:7,y:0},
        hemFold:{x:0,y:11}, hemSide:{x:9.75,y:11},
        curves:[
          {p0:{x:7,y:0}, c1:{x:8.5156,y:2.5117}, c2:{x:8.7284,y:3.8949}, p3:{x:9,y:6.5}},
          {p0:{x:9,y:6.5}, c1:{x:9.2719,y:7.4721}, c2:{x:9.8226,y:10.2910}, p3:{x:9.75,y:11}}
        ]
      },
      {
        label:'Back', cut:'Cut 1 on fold', sideSA:0.5, hemSA:1, tileOverlap:0.25,
        topFold:{x:0,y:0}, topSide:{x:8,y:0},
        hemFold:{x:0,y:13}, hemSide:{x:10,y:13},
        curves:[
          {p0:{x:8,y:0}, c1:{x:10.9671,y:3.5427}, c2:{x:11.2890,y:9.2114}, p3:{x:10,y:13}}
        ]
      }
    ],
    files:[
      {label:'Front piece (US Letter, printable)', url:'assets/patterns/front_skirt_pattern_US_Letter.pdf'},
      {label:'Back piece (US Letter, printable)', url:'assets/patterns/back_skirt_us_letter_printable.pdf'}
    ],
    steps:[
      {title:'Cut your front piece', text:'Print the front pattern piece and check the 2"x2" test square before assembling the tiled pages. Fold your fabric and place Center Front on the fold. A 3/8" seam allowance is included at the waist and sides, with a 1/2" hem allowance. Cut 1 on the fold.', diagram:'pin'},
      {title:'Cut your back piece', text:'Print the back pattern piece and check the test square the same way. Fold your fabric and place Center Back on the fold. A 1/2" seam allowance is included at the waist and sides, with a 1" hem allowance. The back is drafted 2" longer than the front for a subtle dipped hem \u2014 cut 1 on the fold.', diagram:'pin'},
      {title:'Sew the side seams', text:'With right sides together, pin the front and back pieces along both side seams and stitch. Finish the raw edges (serge, zigzag, or pinking shears) to prevent fraying.', diagram:'seam'},
      {title:'Finish the waist', text:'Fold and press the waist seam allowance to the inside, then topstitch it down \u2014 or attach a separate waistband here if you\'d like one.', diagram:'attach'},
      {title:'Hem the skirt', text:'Fold and press the hem allowance on both front (1/2") and back (1") \u2014 the back\'s deeper hem is what gives the dipped-back silhouette. Stitch in place all the way around.', diagram:'hem'}
    ]
  },
  {
    // Made-to-measure: generated by the generate-pattern Edge Function from SeamScape pattern
    // "Zendaya Spider-Man Dress (Parametric)" version 5 (front + back bodice on the fold, two full ruffles
    // on the fold gathered about 7.3x onto the hem; no facings). Drafted on bust 86, waist 70, hip 98 cm.
    id:'pattern-1', name:'Zendaya Spiderman Dress', trend:'', difficulty:'', construction:'3 pattern pieces',
    time:'', fabric:'Stretch fabric', image:'assets/images/17554d3131e604eeb23e9f1c85e2f81b.jpg', emoji:'',
    // Reference body (cm). Fabric: on 150 cm wide fabric the two ruffles (cut along the lengthwise grain,
    // 252 cm each when unfolded at the reference size) sit beside the bodices and set the length: about 2.7 m.
    base:{waist:70, hip:98, length:114.6}, yardageBase:2.7,
    fabricNote:'This pattern is drafted to your saved measurements, so no fit adjustments are needed. Estimate based on fabric 59" (150 cm) wide; the two long ruffles set the length.',
    personalized:{ patternId:'pattern-1', papers:['A0','A4','Letter'],
      measurements:[['chest_girth','Bust'], ['waist_girth','Waist'], ['hip_girth','Hip']] },
    // Steps follow the patternmaker's sewing guide, without the facing steps (the facings were removed).
    steps:[
      {title:'Cut and mark', diagram:'pin',
       text:'Print your pattern at 100% and check the 2 in and 5 cm test squares. Cut the front bodice and the back bodice once each on the fold, and the ruffle twice on the fold, with the grainline running along the length of the fabric. Seam allowances (1 cm; 1.2 cm at the bodice hem; 2 cm at the ruffle ends) are included.'},
      {title:'Stabilise the edges', diagram:'pin',
       text:'Iron a ½" stay tape (paper stay) along the neckline, armholes, back neckline and hemline of the bodice. It keeps the stretch fabric from growing while you sew.'},
      {title:'Sew the side seams', diagram:'seam',
       text:'Place the back and front bodice right sides together and sew the side seams with a serger or zig-zag stitch, then sew a straight stitch to secure them.'},
      {title:'Finish the neckline and armholes', diagram:'seam',
       text:'The original pattern finished the keyhole neckline, armholes and back neckline with facings, which this version no longer includes. The finishing method for these edges is still to be confirmed.'},
      {title:'Join the halter neck', diagram:'seam',
       text:'Sew the two halter strap ends right sides together.'},
      {title:'Join the ruffles', diagram:'seam',
       text:'Sew the two ruffles right sides together at both short ends to make one loop.'},
      {title:'Gather the ruffle', diagram:'gather',
       text:'Set your machine to its widest stitch and sew two rows of stitching along one long edge of the ruffle.'},
      {title:'Hem the ruffle', diagram:'hem',
       text:'Fold the other long edge of the ruffle by 1 cm twice and edgestitch to enclose the raw edge.'},
      {title:'Attach the ruffle', diagram:'attach',
       text:'Measure the dress hem and pull the loose threads to gather the ruffle to fit. Place the right side of the ruffle on the right side of the dress hem, matching the ruffle seams to the side seams, and stitch all the way round.'}
    ]
  }
]
