/**
 * theGarden — Item Database
 * 花园主题物品模板库，萌系 Q 弹风格
 */
import { Color } from 'cc';

/** 物品模板（静态数据） */
export interface ItemTemplate {
    id: string;
    name: string;
    emoji: string;
    description: string;
    cost: number;
    rows: number;
    cols: number;
    cooldown: number;        // 秒，0 = 被动
    effectType: 'damage' | 'heal' | 'poison' | 'thorns' | 'boost' | 'gold' | 'haste' | 'shield';
    effectValue: number;
    effectDuration?: number; // 持续效果的秒数
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
    color: { r: number; g: number; b: number };  // 主题色
    tier: number;            // 1-3，用于商店等级池
}

/** 所有花园物品 */
export const ITEM_TEMPLATES: Record<string, ItemTemplate> = {
    sunflower: {
        id: 'sunflower', name: '向日葵', emoji: '🌻',
        description: '温暖的阳光治愈一切~', cost: 2,
        rows: 1, cols: 1, cooldown: 4,
        effectType: 'heal', effectValue: 3,
        rarity: 'common', color: { r: 255, g: 213, b: 79 }, tier: 1,
    },
    rose: {
        id: 'rose', name: '玫瑰刺', emoji: '🌹',
        description: '美丽却带刺，戳！', cost: 3,
        rows: 1, cols: 1, cooldown: 3,
        effectType: 'damage', effectValue: 4,
        rarity: 'common', color: { r: 244, g: 67, b: 54 }, tier: 1,
    },
    mushroom: {
        id: 'mushroom', name: '毒蘑菇', emoji: '🍄',
        description: '可爱的外表下藏着毒素', cost: 2,
        rows: 1, cols: 1, cooldown: 5,
        effectType: 'poison', effectValue: 2, effectDuration: 3,
        rarity: 'common', color: { r: 156, g: 39, b: 176 }, tier: 1,
    },
    bee: {
        id: 'bee', name: '小蜜蜂', emoji: '🐝',
        description: '嗡嗡嗡~快速叮咬！', cost: 3,
        rows: 1, cols: 1, cooldown: 1.5,
        effectType: 'damage', effectValue: 2,
        rarity: 'uncommon', color: { r: 255, g: 183, b: 77 }, tier: 1,
    },
    cactus: {
        id: 'cactus', name: '仙人掌', emoji: '🌵',
        description: '谁碰谁痛！', cost: 4,
        rows: 2, cols: 1, cooldown: 5,
        effectType: 'thorns', effectValue: 3,
        rarity: 'uncommon', color: { r: 76, g: 175, b: 80 }, tier: 2,
    },
    wateringCan: {
        id: 'wateringCan', name: '小水壶', emoji: '💧',
        description: '浇灌相邻植物，效果+50%', cost: 3,
        rows: 1, cols: 1, cooldown: 0,
        effectType: 'boost', effectValue: 50,
        rarity: 'uncommon', color: { r: 100, g: 181, b: 246 }, tier: 1,
    },
    clover: {
        id: 'clover', name: '四叶草', emoji: '🍀',
        description: '幸运加持，每场+1金币', cost: 2,
        rows: 1, cols: 1, cooldown: 0,
        effectType: 'gold', effectValue: 1,
        rarity: 'common', color: { r: 129, g: 199, b: 132 }, tier: 1,
    },
    butterfly: {
        id: 'butterfly', name: '蝴蝶仙子', emoji: '🦋',
        description: '翩翩起舞，加速周围伙伴', cost: 4,
        rows: 1, cols: 1, cooldown: 6,
        effectType: 'haste', effectValue: 50, effectDuration: 3,
        rarity: 'rare', color: { r: 186, g: 104, b: 200 }, tier: 2,
    },
    tulip: {
        id: 'tulip', name: '郁金香', emoji: '🌷',
        description: '优雅的花朵，生成护盾', cost: 3,
        rows: 1, cols: 1, cooldown: 5,
        effectType: 'shield', effectValue: 4,
        rarity: 'uncommon', color: { r: 240, g: 98, b: 146 }, tier: 2,
    },
    cherry: {
        id: 'cherry', name: '樱桃炸弹', emoji: '🍒',
        description: '甜蜜的爆炸伤害！', cost: 5,
        rows: 1, cols: 1, cooldown: 4,
        effectType: 'damage', effectValue: 7,
        rarity: 'rare', color: { r: 211, g: 47, b: 47 }, tier: 2,
    },
    ladybug: {
        id: 'ladybug', name: '瓢虫守护', emoji: '🐞',
        description: '可爱的小卫士，持续回复', cost: 4,
        rows: 1, cols: 1, cooldown: 3,
        effectType: 'heal', effectValue: 2,
        rarity: 'uncommon', color: { r: 229, g: 57, b: 53 }, tier: 2,
    },
    acorn: {
        id: 'acorn', name: '橡果', emoji: '🌰',
        description: '坚硬的橡果，砸！', cost: 1,
        rows: 1, cols: 1, cooldown: 2,
        effectType: 'damage', effectValue: 2,
        rarity: 'common', color: { r: 141, g: 110, b: 99 }, tier: 1,
    },
};

/** 按稀有度获取物品列表 */
export function getItemsByRarity(rarity: string): ItemTemplate[] {
    return Object.values(ITEM_TEMPLATES).filter(t => t.rarity === rarity);
}

/** 按等级池获取物品 */
export function getItemsByTier(tier: number): ItemTemplate[] {
    return Object.values(ITEM_TEMPLATES).filter(t => t.tier <= tier);
}

/** 随机选N个物品（不重复） */
export function pickRandomItems(pool: ItemTemplate[], count: number): ItemTemplate[] {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}
