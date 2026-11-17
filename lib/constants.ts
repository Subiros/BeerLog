
export const TYPES: string[] = [
  "Estrella Damm",
  "Pilsner",
  "IPA",
  "Stout",
  "Trigo",
  "Sin alcohol",
  "Otra"
];

export const ABV: Record<string, number> = {
  "Estrella Damm": 5,
  "Pilsner": 5,
  "IPA": 6.5,
  "Stout": 5.5,
  "Trigo": 5,
  "Sin alcohol": 0.5,
  "Otra": 5
};

export const SIZES: [number, string][] = [
  [200, "200 ml"],
  [330, "Tercio 330 ml"],
  [500, "Media 500 ml"],
  [568, "Pinta 568 ml"],
  [1000, "Litro"]
];
