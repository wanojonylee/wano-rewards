/**
 * Demo SKU catalog used by `simulate-deposit` (DEMO_MODE) and by the seed.
 * GTINs are realistic EAN-13 values for well-known Brazilian products.
 */
import type { MaterialCode } from "../types.ts";

export interface DemoSku {
  gtin: string;
  material: MaterialCode;
  skuName: string;
  brand: string;
  weightGrams: number;
}

export const DEMO_SKUS: DemoSku[] = [
  { gtin: "7891000100103", material: "PET", skuName: "Água Crystal 500ml", brand: "Crystal", weightGrams: 28 },
  { gtin: "7894900011517", material: "PET", skuName: "Coca-Cola 2L", brand: "Coca-Cola", weightGrams: 48 },
  { gtin: "7891991000118", material: "PET", skuName: "Guaraná Antarctica 2L", brand: "Antarctica", weightGrams: 46 },
  { gtin: "7894900027013", material: "PET", skuName: "Fanta Laranja 2L", brand: "Fanta", weightGrams: 45 },
  { gtin: "7894900010015", material: "ALUMINUM", skuName: "Lata Coca-Cola 350ml", brand: "Coca-Cola", weightGrams: 15 },
  { gtin: "7891149100104", material: "ALUMINUM", skuName: "Lata Skol 350ml", brand: "Skol", weightGrams: 15 },
  { gtin: "9002490100070", material: "ALUMINUM", skuName: "Lata Red Bull 250ml", brand: "Red Bull", weightGrams: 13 },
  { gtin: "7896045500106", material: "GLASS", skuName: "Garrafa Heineken 330ml", brand: "Heineken", weightGrams: 300 },
  { gtin: "7896045500205", material: "GLASS", skuName: "Garrafa Stella Artois 275ml", brand: "Stella Artois", weightGrams: 280 },
  { gtin: "7891024100102", material: "HDPE", skuName: "Garrafa Danone 1L", brand: "Danone", weightGrams: 32 },
  { gtin: "7891024100201", material: "HDPE", skuName: "Garrafa Activia 1,5L", brand: "Danone", weightGrams: 38 },
  { gtin: "7891024100300", material: "PP", skuName: "Pote Danone 170g", brand: "Danone", weightGrams: 25 },
  { gtin: "7891000053508", material: "PP", skuName: "Pote de sorvete Kibon 1L", brand: "Kibon", weightGrams: 30 },
  { gtin: "7891000200100", material: "PS_HIPS", skuName: "Copo descartável 300ml", brand: "Copobras", weightGrams: 20 },
  { gtin: "7891000200209", material: "PS_HIPS", skuName: "Bandeja PS 500g", brand: "Copobras", weightGrams: 22 },
];

export function pickSku(material: MaterialCode, random = Math.random): DemoSku {
  const options = DEMO_SKUS.filter((sku) => sku.material === material);
  if (options.length === 0) return DEMO_SKUS[0] as DemoSku;
  return options[Math.floor(random() * options.length)] as DemoSku;
}

/** Slight natural variation around the SKU's nominal weight (±6%). */
export function jitterWeight(grams: number, random = Math.random): number {
  const delta = Math.round(grams * (random() * 0.12 - 0.06));
  return Math.max(1, grams + delta);
}
