// ===================================================================
// prices.js - Angel Group of Schools Price Matrices
// Uniforms & Granular Academic Books (2026-2027)
// ===================================================================

// 1. Regular Uniform Price Matrix
const UNIFORM_PRICE_MATRIX = {
  "Nursery": {
    "BOYS":  { "SET": 1560, "SHIRT & PANT": 950,  "BLAZZER": 0,    "SHOES & SOCKS": 650,  "ONLY SOCKS": 80, "BELT": 0 },
    "GIRLS": { "SET": 1560, "SHIRT & SKIRT": 950, "BLAZZER": 0,    "SHOES & SOCKS": 650,  "ONLY SOCKS": 80, "BELT": 0 }
  },
  "jr. kg.": {
    "BOYS":  { "SET": 1560, "SHIRT & PANT": 950,  "BLAZZER": 0,    "SHOES & SOCKS": 650,  "ONLY SOCKS": 80, "BELT": 0 },
    "GIRLS": { "SET": 1560, "SHIRT & SKIRT": 950, "BLAZZER": 0,    "SHOES & SOCKS": 650,  "ONLY SOCKS": 80, "BELT": 0 }
  },
  "sr. kg.": {
    "BOYS":  { "SET": 1560, "SHIRT & PANT": 950,  "BLAZZER": 0,    "SHOES & SOCKS": 650,  "ONLY SOCKS": 80, "BELT": 0 },
    "GIRLS": { "SET": 1560, "SHIRT & SKIRT": 950, "BLAZZER": 0,    "SHOES & SOCKS": 650,  "ONLY SOCKS": 80, "BELT": 0 }
  },
  "I": {
    "BOYS":  { "SET": 1540, "SHIRT & PANT": 900,  "BLAZZER": 0,    "SHOES & SOCKS": 800,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 1810, "SHIRT & SKIRT": 1200,"BLAZZER": 0,    "SHOES & SOCKS": 800,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "II": {
    "BOYS":  { "SET": 1540, "SHIRT & PANT": 900,  "BLAZZER": 0,    "SHOES & SOCKS": 800,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 1810, "SHIRT & SKIRT": 1200,"BLAZZER": 0,    "SHOES & SOCKS": 800,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "III": {
    "BOYS":  { "SET": 1660, "SHIRT & PANT": 1100, "BLAZZER": 0,    "SHOES & SOCKS": 850,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 2020, "SHIRT & SKIRT": 1400,"BLAZZER": 0,    "SHOES & SOCKS": 850,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "IV": {
    "BOYS":  { "SET": 1660, "SHIRT & PANT": 1100, "BLAZZER": 0,    "SHOES & SOCKS": 850,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 2020, "SHIRT & SKIRT": 1400,"BLAZZER": 0,    "SHOES & SOCKS": 850,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "V": {
    "BOYS":  { "SET": 1660, "SHIRT & PANT": 1100, "BLAZZER": 0,    "SHOES & SOCKS": 850,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 2020, "SHIRT & SKIRT": 1400,"BLAZZER": 0,    "SHOES & SOCKS": 850,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "VI": {
    "BOYS":  { "SET": 3630, "SHIRT & PANT": 1400, "BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 3740, "SHIRT & SKIRT": 1500,"BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "VII": {
    "BOYS":  { "SET": 3630, "SHIRT & PANT": 1400, "BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 3740, "SHIRT & SKIRT": 1500,"BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "VIII": {
    "BOYS":  { "SET": 3630, "SHIRT & PANT": 1400, "BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 3740, "SHIRT & SKIRT": 1500,"BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "IX": {
    "BOYS":  { "SET": 3860, "SHIRT & PANT": 1650, "BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 3870, "SHIRT & SKIRT": 1650,"BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "X": {
    "BOYS":  { "SET": 3860, "SHIRT & PANT": 1650, "BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 3870, "SHIRT & SKIRT": 1650,"BLAZZER": 1500, "SHOES & SOCKS": 950,  "ONLY SOCKS": 80, "BELT": 100 }
  },
  "XI": {
    "BOYS":  { "SET": 4000, "SHIRT & PANT": 1600, "BLAZZER": 1600, "SHOES & SOCKS": 1000, "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 4000, "SHIRT & SKIRT": 1600,"BLAZZER": 1600, "SHOES & SOCKS": 1000, "ONLY SOCKS": 80, "BELT": 100 }
  },
  "XII": {
    "BOYS":  { "SET": 4000, "SHIRT & PANT": 1600, "BLAZZER": 1600, "SHOES & SOCKS": 1000, "ONLY SOCKS": 80, "BELT": 100 },
    "GIRLS": { "SET": 4000, "SHIRT & SKIRT": 1600,"BLAZZER": 1600, "SHOES & SOCKS": 1000, "ONLY SOCKS": 80, "BELT": 100 }
  }
};

// 2. PT Uniform Price Matrix (By Size Only)
const PT_UNIFORM_PRICE_MATRIX = {
  "24": { "PT SHIRT": 420, "PT PANT": 450 },
  "26": { "PT SHIRT": 430, "PT PANT": 460 },
  "28": { "PT SHIRT": 440, "PT PANT": 480 },
  "30": { "PT SHIRT": 440, "PT PANT": 500 },
  "32": { "PT SHIRT": 450, "PT PANT": 520 },
  "34": { "PT SHIRT": 460, "PT PANT": 530 },
  "36": { "PT SHIRT": 470, "PT PANT": 550 },
  "38": { "PT SHIRT": 480, "PT PANT": 570 },
  "40": { "PT SHIRT": 490, "PT PANT": 580 },
  "42": { "PT SHIRT": 500, "PT PANT": 600 },
  "44": { "PT SHIRT": 510, "PT PANT": 620 },
  "46": { "PT SHIRT": 550, "PT PANT": 650 }
};

// 3. Books Price Matrix - Standard Bundles
const BOOKS_PRICE_MATRIX = {
  "NURSERY": { "TEXTBOOKS SET": 3749, "NOTEBOOK SET": 330,  "TOTAL AMOUNT": 4079 },
  "JR. KG":  { "TEXTBOOKS SET": 4049, "NOTEBOOK SET": 440,  "TOTAL AMOUNT": 4489 },
  "SR. KG":  { "TEXTBOOKS SET": 4249, "NOTEBOOK SET": 675,  "TOTAL AMOUNT": 4924 },
  "I":       { "TEXTBOOKS SET": 3917, "NOTEBOOK SET": 660,  "TOTAL AMOUNT": 4577 },
  "II":      { "TEXTBOOKS SET": 4062, "NOTEBOOK SET": 660,  "TOTAL AMOUNT": 4722 },
  "III":     { "TEXTBOOKS SET": 4251, "NOTEBOOK SET": 1115, "TOTAL AMOUNT": 5366 },
  "IV":      { "TEXTBOOKS SET": 4420, "NOTEBOOK SET": 1280, "TOTAL AMOUNT": 5700 },
  "V":       { "TEXTBOOKS SET": 4495, "NOTEBOOK SET": 1100, "TOTAL AMOUNT": 5595 },
  "VI":      { "TEXTBOOKS SET": 5590, "NOTEBOOK SET": 1345, "TOTAL AMOUNT": 6935 },
  "VII":     { "TEXTBOOKS SET": 5725, "NOTEBOOK SET": 2100, "TOTAL AMOUNT": 7825 },
  "VIII":    { "TEXTBOOKS SET": 5685, "NOTEBOOK SET": 1935, "TOTAL AMOUNT": 7620 },
  "IX":      { "TEXTBOOKS SET": 2798, "NOTEBOOK SET": 1020, "TOTAL AMOUNT": 3818 },
  "X":       { "TEXTBOOKS SET": 2263, "NOTEBOOK SET": 1020, "TOTAL AMOUNT": 3283 }
};

// 4. Granular Unit Prices (Individual Textbooks & Notebooks per standard)
const BOOK_ITEMS_BREAKDOWN = {
  "NURSERY": {
    "Calyx - Foundational Stage Nursery": 3199,
    "Magic English Language (Karadi Path)": 550,
    "Red & Blue Line 200 Pages": 55,
    "Square Line (Big) 200 Pages": 55,
    "Square Line (Medium) 200 Pages": 55
  },
  "JR. KG": {
    "Calyx - Foundational Stage LKG": 3499,
    "Magic English Language (Karadi Path)": 550,
    "Red & Blue Line 200 Pages": 55,
    "4 Square Line (Medium) 200 Pages": 55
  },
  "SR. KG": {
    "Calyx - Foundational Stage UKG": 3699,
    "Magic English Language (Karadi Path)": 550,
    "Red & Blue Line 200 Pages": 55,
    "Square Line 200 Pages": 55,
    "Red & Blue Line 100 Pages": 35,
    "Square Line 100 Pages": 35,
    "Double Line 200 Pages": 55
  },
  "I": {
    "Melons (Semester I)": 675,
    "Melons (Semester II)": 675,
    "Interactive Grammar & More": 299,
    "Bansuri (Hindi)": 350,
    "Shivai (Marathi)": 260,
    "Computer Project Booklet - 3 in 1": 360,
    "Artistic (Art & Activity)": 198,
    "Health Education": 550,
    "Magic English Language (Karadi Path)": 550,
    "Red & Blue Line 200 Pages": 55,
    "Square Line 200 Pages": 55,
    "Double Line 200 Pages": 55
  },
  "II": {
    "Melons (Semester I)": 695,
    "Melons (Semester II)": 695,
    "Interactive Grammar & More": 344,
    "Bansuri (Hindi)": 390,
    "Shivai (Marathi)": 270,
    "Computer Project Booklet - 3 in 1": 370,
    "Artistic (Art & Activity)": 198,
    "Health Education": 550,
    "Magic English Language (Karadi Path)": 550,
    "Red & Blue Line 200 Pages": 55,
    "Square Line 200 Pages": 55,
    "Double Line 200 Pages": 55
  },
  "III": {
    "Melons (Semester I)": 725,
    "Melons (Semester II)": 725,
    "Interactive Grammar & More": 379,
    "Bansuri (Hindi)": 430,
    "Shivai (Marathi)": 290,
    "Computer Project Booklet - 3 in 1": 395,
    "Artistic (Art & Activity)": 207,
    "Health Education": 550,
    "Magic English Language (Karadi Path)": 550,
    "Red & Blue Line 200 Pages": 55,
    "Square Line 200 Pages": 55,
    "Double Line 200 Pages": 55,
    "4 Line Book 100 Pages": 35
  },
  "IV": {
    "Melons (Semester I)": 775,
    "Melons (Semester II)": 775,
    "Interactive Grammar & More": 399,
    "Bansuri (Hindi)": 450,
    "Shivai (Marathi)": 290,
    "Computer Project Booklet - 3 in 1": 415,
    "Artistic (Art & Activity)": 216,
    "Health Education": 550,
    "Magic English Language (Karadi Path)": 550,
    "Red & Blue Line 200 Pages": 55,
    "Square Line 200 Pages": 55,
    "Double Line 200 Pages": 55,
    "4 Line Book 100 Pages": 35
  },
  "V": {
    "Melons (Semester I)": 795,
    "Melons (Semester II)": 795,
    "Interactive Grammar & More": 399,
    "Bansuri (Hindi)": 470,
    "Shivai (Marathi)": 300,
    "Computer Project Booklet - 3 in 1": 420,
    "Artistic (Art & Activity)": 216,
    "Health Education": 550,
    "Magic English Language (Karadi Path)": 550,
    "Single Line 200 Pages": 55
  },
  "VI": {
    "Communicate in English": 679,
    "Interactive Grammar & More": 424,
    "Bansuri (Hindi)": 490,
    "Shivai (Marathi)": 320,
    "New Direction Mathematics": 595,
    "New Direction Science": 595,
    "My Big Book of Social Science": 629,
    "Computer Project Booklet - 3 in 1": 460,
    "Artistic (Art & Activity)": 288,
    "Health Education": 550,
    "Sangita Marathi Vyakaran": 195,
    "Vyakran Samiksha Hindi": 365,
    "Single Line 200 Pages": 55,
    "Single Line 100 Pages": 35
  },
  "VII": {
    "Communicate in English": 689,
    "Interactive Grammar & More": 444,
    "Bansuri (Hindi)": 490,
    "Shivai (Marathi)": 320,
    "New Direction Mathematics": 595,
    "New Direction Science": 595,
    "My Big Book of Social Science": 699,
    "Computer Project Booklet - 3 in 1": 465,
    "Artistic (Art & Activity)": 288,
    "Health Education": 550,
    "Sangita Marathi Vyakaran": 215,
    "Vyakran Samiksha Hindi": 375,
    "Single Line 200 Pages": 75
  },
  "VIII": {
    "Communicate in English": 699,
    "Interactive Grammar & More": 444,
    "Bansuri (Hindi)": 490,
    "Shivai (Marathi)": 320,
    "New Direction Mathematics": 595,
    "New Direction Science": 595,
    "My Big Book of Social Science": 699,
    "Computer Project Booklet - 3 in 1": 475,
    "Artistic (Art & Activity)": 288,
    "Health Education": 550,
    "Sangita Marathi Vyakaran": 235,
    "Vyakran Samiksha Hindi": 295,
    "Single Line 200 Pages": 75,
    "Single Line 100 Pages": 45
  }
};
