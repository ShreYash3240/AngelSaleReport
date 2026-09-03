// prices.js - Angel Group of School Regular Uniform Price Matrix
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