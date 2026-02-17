/**
 * TELEGRAM LINK MANAGER
 * Handles linking Telegram group chats to Defia brands.
 * Uses app_storage for temporary link codes and telegram_links table for persistent associations.
 */

import crypto from 'crypto';
import { getSupabaseClient } from '../agent/brandContext.js';

const LINK_CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ━━━ Link Code Generation ━━━

const generateLinkCode = async (supabase, brandId) => {
    if (!supabase || !brandId) throw new Error('Missing supabase or brandId');

    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);

    const storageKey = `telegram_link_code_${brandId.toLowerCase()}`;
    const { error } = await supabase
        .from('app_storage')
        .upsert({
            key: storageKey,
            value: { code, brandId, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
            updated_at: now.toISOString(),
        });

    if (error) throw new Error(`Failed to store link code: ${error.message}`);
    return code;
};

// ━━━ Validate & Link ━━━

const validateAndLink = async (supabase, code, chatId, chatTitle, chatType, linkedBy) => {
    if (!supabase || !code) return { error: 'Missing required parameters' };

    // Search for the code across all link code entries
    const { data: rows, error: searchError } = await supabase
        .from('app_storage')
        .select('key, value')
        .like('key', 'telegram_link_code_%');

    if (searchError || !rows || rows.length === 0) {
        return { error: 'Invalid or expired link code' };
    }

    // Find matching code
    const now = Date.now();
    const match = rows.find(row => {
        const val = row.value;
        if (!val || val.code !== code.toUpperCase()) return false;
        if (val.expiresAt && new Date(val.expiresAt).getTime() < now) return false;
        return true;
    });

    if (!match) return { error: 'Invalid or expired link code' };

    const brandId = match.value.brandId;

    // Check if already linked
    const { data: existing } = await supabase
        .from('telegram_links')
        .select('id')
        .eq('brand_id', brandId)
        .eq('chat_id', chatId)
        .maybeSingle();

    if (existing) {
        // Already linked — just update
        await supabase
            .from('telegram_links')
            .update({ chat_title: chatTitle, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
    } else {
        // Insert new link
        const { error: insertError } = await supabase
            .from('telegram_links')
            .insert({
                brand_id: brandId,
                chat_id: chatId,
                chat_title: chatTitle || null,
                chat_type: chatType || null,
                linked_by: linkedBy || null,
                link_code: code.toUpperCase(),
                notifications_enabled: true,
            });

        if (insertError) {
            return { error: `Failed to link: ${insertError.message}` };
        }
    }

    // Delete the used code
    await supabase.from('app_storage').delete().eq('key', match.key);

    // Resolve brand name for confirmation message
    let brandName = brandId;
    try {
        const { data: brandRow } = await supabase
            .from('brands')
            .select('config')
            .eq('id', brandId)
            .maybeSingle();
        if (brandRow?.config?.name) brandName = brandRow.config.name;
    } catch (_) { /* ignore */ }

    return { success: true, brandId, brandName };
};

// ━━━ Lookups ━━━

const getLinkedBrand = async (supabase, chatId) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('telegram_links')
        .select('brand_id, chat_title, notifications_enabled')
        .eq('chat_id', chatId)
        .maybeSingle();

    if (error || !data) return null;

    // Resolve brand name
    let brandName = data.brand_id;
    try {
        const { data: brandRow } = await supabase
            .from('brands')
            .select('config')
            .eq('id', data.brand_id)
            .maybeSingle();
        if (brandRow?.config?.name) brandName = brandRow.config.name;
    } catch (_) { /* ignore */ }

    return {
        brandId: data.brand_id,
        brandName,
        notificationsEnabled: data.notifications_enabled,
    };
};

const getLinkedChats = async (supabase, brandId) => {
    if (!supabase || !brandId) return [];

    const { data, error } = await supabase
        .from('telegram_links')
        .select('chat_id, chat_title, chat_type, linked_by, notifications_enabled, created_at')
        .eq('brand_id', brandId);

    if (error || !data) return [];
    return data;
};

// ━━━ Unlink ━━━

const unlinkChat = async (supabase, chatId) => {
    if (!supabase) return { error: 'Supabase not configured' };

    const { error } = await supabase
        .from('telegram_links')
        .delete()
        .eq('chat_id', chatId);

    if (error) return { error: error.message };
    return { success: true };
};

export {
    generateLinkCode,
    validateAndLink,
    getLinkedBrand,
    getLinkedChats,
    unlinkChat,
};
