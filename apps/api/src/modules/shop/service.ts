import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';

export async function getShop() {
  const result = await query<{
    name: string; city: string; district: string; address: string; timezone: string;
  }>('SELECT name, city, district, address, timezone FROM shop WHERE id = 1');
  return result.rows[0] ?? null;
}

export async function verifyShopTimezone(): Promise<void> {
  const shop = await getShop();
  if (shop && shop.timezone !== env.shopTimezone) {
    throw new Error('SHOP_TIMEZONE difere do fuso cadastrado na loja.');
  }
}
